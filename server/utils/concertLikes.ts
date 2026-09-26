/**
 * 演唱会点赞读写 · Concert likes (data access)
 *
 * @module server/utils/concertLikes
 * @description `concert_likes` 表（自增 id / concert_id / ip / created_at）的读写封装：
 *              · 读：`fetchLikedConcertIds`（当前 IP 已点赞集合，列表接口）、`isConcertLiked`（单场），
 *                    供 /api/concerts 与单场接口装配，避免 N+1；总数直接读冗余列 concerts.likes，
 *                    不再按行 COUNT。
 *              · 写：`setConcertLike` —— 依赖 UNIQUE(concert_id, ip) 天然去重，仅当真实插入/删除了
 *                    一行时才把冗余列 concerts.likes ±1（见 applyLikeDelta）。**整个「判定 + 写行 +
 *                    调整计数」在交互式事务（BEGIN IMMEDIATE）内原子完成**，并发/双击/重试不会漂移。
 *              · 隐私：`ip` 列不存明文，存的是 HMAC-SHA256(盐, IP) 哈希（见 resolveClientIp），
 *                    去重/限流语义不变。
 *
 *              容错：`concert_likes` 表缺失（未迁移）时读操作视为「无点赞」，绝不阻断页面；
 *              写操作会抛错，由接口层转为 5xx。
 *
 *              注意：本模块不依赖 Nitro 运行时（只用 @libsql/client + node:crypto），
 *              因此可被 vitest 直接单测。
 *
 *              Read/write wrapper for the `concert_likes` table. Reads are per-client (hashed IP);
 *              writes run inside a write transaction and keep the denormalized concerts.likes in sync.
 *              Fault tolerance: a missing table (not migrated) makes reads return "no likes" without
 *              breaking the page; writes throw and the API layer turns that into a 5xx.
 */

import { createHmac } from 'node:crypto';
import type { Client, Transaction } from '@libsql/client';
import { getRequestHeader, getRequestIP, type H3Event } from 'h3';

/**
 * 执行器抽象 · Executor abstraction
 * @description `Client` 与 `Transaction` 都提供同签名的 `execute`，把点赞切换的步骤抽成纯步骤函数后
 *              既能在事务内跑，也能在不支持事务的客户端上顺序跑。
 *              Both Client and Transaction expose the same `execute` signature, so the toggle steps can run
 *              inside a transaction or sequentially on clients without transaction support.
 */
export type LikeExecutor = Pick<Client, 'execute'>;

/** 点赞操作结果 · Result of a like write */
export interface LikeToggleResult {
  /** 该场演唱会最新点赞总数 · latest like count of the concert */
  likes: number;
  /** 本次操作后当前 IP 是否已点赞 · whether the current IP has liked after this toggle */
  liked: boolean;
}

/**
 * 哈希客户端标识 · Hash a client IP into a stable, non-reversible key
 * @description 取不到 IP（如本地开发、代理未透传）时兜底为 `'unknown'`，保证点赞功能可用。
 *              其余一律输出 HMAC-SHA256 十六进制（64 字符）：库中/限流键不再出现明文 IP（个人数据），
 *              长度天然有界，无需再截断超长异常头。
 *              盐来自 `NUXT_IP_SALT`：**生产必须设置且不可再变更**（换盐 = 全部用户的点赞去重失效）。
 * @param raw `getRequestIP()` 等取到的原始 IP · raw IP from getRequestIP() etc.
 */
export function resolveClientIp(raw: string | null | undefined): string {
  const ip = (raw ?? '').trim();
  if (!ip) return 'unknown';
  return createHmac('sha256', process.env.NUXT_IP_SALT || 'ilive-world-dev-salt').update(ip).digest('hex');
}

/**
 * 从请求取得「归一化」客户端 IP · Resolve & normalize the client IP from the request
 * @description 安全要点（递进信任链）：
 *              · 部署在 Vercel（`VERCEL=1`）时，优先取平台注入的 `x-vercel-forwarded-for`
 *                （单一真实客户端 IP，由平台覆写、客户端无法伪造）；并把转发头纳入信任。
 *              · 其它可信反代 / CDN（Cloudflare、nginx）后，仅当显式 `NUXT_TRUST_PROXY=true`
 *                （且反代**覆写**转发头为真实客户端 IP）时才采信；依次尝试
 *                `x-forwarded-for` / `cf-connecting-ip`（Cloudflare）/ `x-real-ip`（nginx）。
 *                h3 自带的 `getRequestIP(..., {xForwardedFor:true})` 只识别 `x-forwarded-for`，
 *                若反代只写入了 `cf-connecting-ip` 或 `x-real-ip`（很常见的默认配置）就会漏判为
 *                socket 对端地址（通常是反代自身的内网 IP），导致所有真实用户被误判成同一个 IP。
 *              · 否则（默认，含直连部署）使用 TCP 对端 socket 地址，客户端无法伪造。
 *              旧写法 `getRequestIP(event, { xForwardedFor: true })` 无条件读取最左 XFF，
 *              直连部署下会被随意伪造 IP，进而无限刷赞 / 污染判定，故已移除。
 *
 *              Trust chain (defense in depth): on Vercel prefer the platform-overwritten
 *              x-vercel-forwarded-for; elsewhere only trust forwarding headers (XFF / cf-connecting-ip /
 *              x-real-ip) behind an explicit NUXT_TRUST_PROXY; otherwise the socket address.
 *
 * @param event Nitro 事件 · Nitro event
 */
export function getClientIp(event: H3Event): string {
  // Vercel 平台：优先用平台覆写的 x-vercel-forwarded-for（单值真实客户端 IP，最可信）
  // Vercel: prefer the platform-overwritten x-vercel-forwarded-for (single, trusted client IP)
  if (process.env.VERCEL === '1') {
    const vff = getRequestHeader(event, 'x-vercel-forwarded-for')
    if (vff) return resolveClientIp(String(vff).split(',')[0])
  }
  // 仅显式声明「在可信反代后」或在 Vercel 上时，才采信转发头；否则用不可伪造的 socket 地址。
  // Trust forwarding headers only behind a trusted proxy (NUXT_TRUST_PROXY) or on Vercel; else the socket address.
  const trustProxy = process.env.NUXT_TRUST_PROXY === 'true' || process.env.VERCEL === '1'
  if (trustProxy) {
    for (const h of ['x-forwarded-for', 'cf-connecting-ip', 'x-real-ip']) {
      const v = getRequestHeader(event, h);
      if (v) return resolveClientIp(String(v).split(',')[0]);
    }
  }
  return resolveClientIp(getRequestIP(event))
}

/**
 * 当前 IP（已哈希）点赞过的演唱会编号集合 · Concert ids liked by the given client key
 * @param client LibSQL 客户端 · client
 * @param ip 客户端标识（经 resolveClientIp 哈希）· hashed client key
 */
export async function fetchLikedConcertIds(client: Client, ip: string): Promise<Set<number>> {
  const set = new Set<number>();
  try {
    const r = await client.execute({
      sql: 'SELECT concert_id FROM concert_likes WHERE ip = ?',
      args: [ip]
    });
    for (const row of r.rows as unknown as { concert_id: number }[]) {
      set.add(Number(row.concert_id));
    }
  } catch {
    // 表不存在（未迁移）→ 视为未点赞 · missing table (not migrated) → treat as "not liked"
  }
  return set;
}

/**
 * 判断某 IP 是否点赞了「某一场」演唱会（单场 EXISTS 查询）· Whether an IP liked one concert
 * @description 单场接口（/api/concerts/:id）只需知道这一场是否被点赞，用 `LIMIT 1` 的 EXISTS 式查询，
 *              比 `fetchLikedConcertIds` 拉取整张 IP 点赞集合更省（尤其该 IP 点赞很多场时）。
 * @param client LibSQL 客户端 · client
 * @param concertId 演唱会编号 · concert id
 * @param ip 客户端标识（经 resolveClientIp 哈希）· hashed client key
 */
export async function isConcertLiked(client: Client, concertId: number, ip: string): Promise<boolean> {
  try {
    const r = await client.execute({
      sql: 'SELECT 1 FROM concert_likes WHERE concert_id = ? AND ip = ? LIMIT 1',
      args: [concertId, ip]
    })
    return r.rows.length > 0
  } catch {
    return false
  }
}

/** 该 (concert_id, ip) 行是否存在 · whether the like row exists */
async function likeRowExists(exec: LikeExecutor, concertId: number, ip: string): Promise<boolean> {
  const r = await exec.execute({
    sql: 'SELECT 1 FROM concert_likes WHERE concert_id = ? AND ip = ? LIMIT 1',
    args: [concertId, ip]
  });
  return r.rows.length > 0;
}

/** 单场实时 COUNT(*)：仅供未迁移库（无 concerts.likes 列）回退使用 · Live COUNT(*): fallback only for unmigrated DBs (no concerts.likes column) */
async function fetchLikeCount(client: LikeExecutor, concertId: number): Promise<number> {
  try {
    const r = await client.execute({
      sql: 'SELECT COUNT(*) AS n FROM concert_likes WHERE concert_id = ?',
      args: [concertId]
    });
    return Number((r.rows[0] as unknown as { n: number } | undefined)?.n ?? 0) || 0;
  } catch {
    return 0;
  }
}

/**
 * 按「真实行变更」对 concerts.likes 冗余列做 ±1 · Apply a ±1 delta tied to an actual row change
 * @description 计数 = seed 写入的基线热度 + 真实点赞行。基线只存在于 concerts.likes、并无对应的
 *              concert_likes 行，所以**不能**用 COUNT(*) 重算（那样一点赞就会把基线冲没，40→1）。
 *              调用方仅在「确实插入/删除了一行」时才传非 0 的 delta，故计数天然与去重一致、不漂移；
 *              下限 0 防止异常取消把计数减成负数。
 *
 *              未迁移库没有 `concerts.likes` 列，属预期回退，退用实时 COUNT(*)；
 *              **其它失败必须向上抛**，否则冗余列会长期不一致且无人察觉。
 */
async function applyLikeDelta(exec: LikeExecutor, concertId: number, delta: number): Promise<number> {
  try {
    if (delta !== 0) {
      await exec.execute({
        sql: 'UPDATE concerts SET likes = CASE WHEN likes + ? < 0 THEN 0 ELSE likes + ? END WHERE id = ?',
        args: [delta, delta, concertId]
      });
    }
    const r = await exec.execute({
      sql: 'SELECT likes FROM concerts WHERE id = ?',
      args: [concertId]
    });
    return Number((r.rows[0] as unknown as { likes: number } | undefined)?.likes ?? 0) || 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/no such column|has no column|no column named/i.test(msg)) throw e;
    return fetchLikeCount(exec, concertId);
  }
}

/**
 * 设为期望点赞状态的步骤（事务内外共用）· Set-to-desired steps (shared inside/outside the transaction)
 * @description 幂等，供 setConcertLike 复用 · idempotent, reused by setConcertLike
 */
async function runSet(exec: LikeExecutor, concertId: number, ip: string, liked: boolean): Promise<LikeToggleResult> {
  const exists = await likeRowExists(exec, concertId, ip);
  let delta = 0;
  if (liked && !exists) {
    const ins = await exec.execute({
      sql: 'INSERT OR IGNORE INTO concert_likes (concert_id, ip) VALUES (?, ?)',
      args: [concertId, ip]
    });
    if (Number(ins.rowsAffected ?? 0) > 0) delta = 1;
  } else if (!liked && exists) {
    const del = await exec.execute({
      sql: 'DELETE FROM concert_likes WHERE concert_id = ? AND ip = ?',
      args: [concertId, ip]
    });
    if (Number(del.rowsAffected ?? 0) > 0) delta = -1;
  }
  const nowLiked = await likeRowExists(exec, concertId, ip);   // 以库中真实行状态为准 · trust the actual row state in DB
  return { likes: await applyLikeDelta(exec, concertId, delta), liked: nowLiked };
}

/**
 * 在交互式事务（BEGIN IMMEDIATE）内执行一段点赞写入，失败整体回滚 · Run like writes in a write transaction
 * @description 不支持事务的极简客户端 / 远程端→降级为顺序执行，保证点赞功能可用。
 *              Clients without transaction support (or remote endpoints) fall back to sequential
 *              execution so the like feature always works.
 */
async function withLikeTx<T>(client: Client, fn: (exec: LikeExecutor) => Promise<T>): Promise<T> {
  if (typeof client.transaction !== 'function') {
    return fn(client);
  }
  let tx: Transaction;
  try {
    tx = await client.transaction('write');
  } catch {
    return fn(client);
  }
  try {
    const res = await fn(tx as unknown as LikeExecutor);
    await tx.commit();
    return res;
  } catch (e) {
    try {
      await tx.rollback();
    } catch {
      /* 事务已失效，原始错误才是关键 · tx already dead; the original error is the one that matters */
    }
    throw e;
  } finally {
    tx.close();
  }
}

/**
 * 将点赞设为期望状态（幂等）· Set the like to the desired state (idempotent)
 * @description 客户端做乐观更新时比 toggle 更安全：即便初始 `liked` 因 SSR 阶段 IP 不可靠而显示不准，
 *              POST desired=true 也只会「点赞」，不会误取消。同样依赖 UNIQUE(concert_id, ip) 与事务，
 *              天然去重、原子维护 concerts.likes 冗余列，返回以库中真实行状态为准的 { likes, liked }。
 *
 *              Atomicity: the read-modify-write sequence runs inside an interactive transaction
 *              (`"write"` = BEGIN IMMEDIATE) and rolls back on any error.
 */
export async function setConcertLike(
  client: Client,
  concertId: number,
  ip: string,
  liked: boolean
): Promise<LikeToggleResult> {
  return withLikeTx(client, exec => runSet(exec, concertId, ip, liked));
}
