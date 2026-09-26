/**
 * 轻量内存速率限制器 · In-memory rate limiter（固定窗口计数）
 *
 * @module server/utils/rateLimit
 * @description 面向「写接口」（如点赞）的软限流：按 `维度 + 客户端标识（通常是归一化 IP）`
 *              在固定时间窗口内计数，超过上限即拒绝。纯内存、单进程，零依赖，便于单测。
 *
 *              适用边界：长驻 Nitro / 单机部署下精确有效；Serverless（如 Vercel 多实例、冷启动）
 *              每个实例各自计数，作为「软限流」仍能挡住绝大多数单点刷量，但不是全局精确配额。
 *              需要跨实例强一致时，应换成 Redis /  Upstash 等集中式存储。
 *
 *              Lightweight fixed-window limiter for write endpoints. In-memory & per-process:
 *              exact on a single long-running instance, best-effort ("soft") on serverless where
 *              each instance counts independently. Use a shared store (Redis/Upstash) for strict limits.
 */

interface Bucket {
  count: number;
  resetAt: number;   // 本窗口结束时间戳（ms）· end timestamp of the current window (ms)
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** 维度标识，隔离不同接口，如 'like' · feature/bucket namespace, e.g. 'like' */
  key: string;
  /** 客户端标识，通常取自 getClientIp() · client id, usually normalized IP */
  id: string;
  /** 窗口内允许的最大请求数 · max requests allowed per window */
  max: number;
  /** 窗口长度（毫秒）· window length in ms */
  windowMs: number;
}

export interface RateLimitResult {
  /** 是否放行 · whether the request is allowed */
  ok: boolean;
  /** 窗口内剩余配额（拒绝时为 0）· remaining quota in this window (0 when blocked) */
  remaining: number;
  /** 命中上限时建议的重试等待秒数（放行为 0）· suggested Retry-After seconds (0 when allowed) */
  retryAfterSec: number;
}

// 过期桶的懒清理：距上次清扫超过 cleanupMs 才遍历一次，避免每次请求都全表扫描。
// Lazy cleanup of expired buckets: sweep at most once per cleanupMs, avoiding a full scan per request.
let lastSweep = 0;
const CLEANUP_MS = 60_000;
function sweep(now: number): void {
  if (now - lastSweep < CLEANUP_MS) return;
  lastSweep = now;
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

/**
 * 检查并消费一次配额 · Check and consume one unit of quota
 * @description 命中窗口则计数 +1；窗口过期则重置为新窗口。副作用：会写入 / 刷新对应桶。
 *              Counts +1 inside a live window, resets it when expired. Side effect: writes/refreshes the bucket.
 */
export function checkRateLimit({ key, id, max, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const bucketKey = key + ':' + id;
  const found = buckets.get(bucketKey);

  // 无桶或窗口已过期 → 视为新窗口（计数从 0 起）
  // No bucket or window expired → start a fresh window (count from 0)
  const b: Bucket = found && found.resetAt > now ? found : { count: 0, resetAt: now + windowMs };
  b.count++;                       // 先消费一次配额 · consume one unit first
  buckets.set(bucketKey, b);

  const ok = b.count <= max;       // max<=0 时首个请求即被拒（语义：完全关闭）· max<=0 blocks even the first request (fully disabled)
  return {
    ok,
    remaining: Math.max(0, max - b.count),
    retryAfterSec: ok ? 0 : Math.max(1, Math.ceil((b.resetAt - now) / 1000))
  };
}

/** 重置所有计数（仅测试用）· Reset all buckets (test only) */
export function __resetRateLimit(): void {
  buckets.clear();
  lastSweep = 0;
}

/**
 * 读整数型环境变量 · Read an integer env var
 * @description 不能用 Number(env) || 默认值：那样 0（"完全关闭"的合法语义）会被 || 吞成默认值，
 *              安全开关按预期外方向失效。此处仅「未设置 / 空串 / 非有限数」才回退默认，0 原样生效。
 *              Never use `Number(env) || default`: that swallows 0 (a legal "fully disabled" value)
 *              into the default, failing the switch in the wrong direction. Only unset / empty /
 *              non-finite inputs fall back; 0 passes through as-is.
 */
export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
