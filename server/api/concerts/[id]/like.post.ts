import { defineEventHandler, getRouterParam, readBody, createError } from 'h3';
import { useDb } from '../../../utils/db';
import { getClientIp, setConcertLike } from '../../../utils/concertLikes';
import { checkRateLimit, envInt } from '../../../utils/rateLimit';

/**
 * 点赞 / 取消点赞 · Like / unlike
 *
 * @description 客户端传入「期望状态」`{ liked: boolean }`，服务端据此把 (concert_id, ip) 落到
 *              `concert_likes` 表（UNIQUE 去重），并在交互式事务内只在真实增删行时把冗余列
 *              `concerts.likes` ±1（见 utils/concertLikes 的 setConcertLike / applyLikeDelta）。相比旧版「读列 ±1 写回」，
 *              这里以真实行变更为准、天然幂等，并发/重试/双击都不会让计数漂移。
 *              返回权威 `{ id, likes, liked }`，客户端乐观更新后采用服务端结果。
 *              The client sends the *desired* state `{ liked: boolean }`; the server upserts the
 *              (concert_id, ip) row into `concert_likes` (UNIQUE dedup) and keeps the denormalized
 *              `concerts.likes` in sync inside an interactive transaction (see setConcertLike).
 *              Idempotent by design: concurrency / retries / double-clicks never drift the count.
 *              Returns the authoritative `{ id, likes, liked }` for the client's optimistic update.
 */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid concert id' });
  }

  // 按归一化 IP 的软限流（先于 DB 操作，拒绝刷量成本更低）；ip 只解析一次，限流与写入共用
  // Per-IP soft rate limit (before DB, cheaper to reject abuse); resolve the IP once, shared by limiter and write
  const ip = getClientIp(event);
  const limit = checkRateLimit({
    key: 'like',
    id: ip,
    // envInt 专治旧写法 Number(x) || 30 吞掉 0（"完全关闭"）的缺陷 · envInt fixes the old Number(x) || 30 swallowing of 0 ("fully disabled")
    max: envInt('NUXT_RATELIMIT_LIKE_MAX', 30),
    windowMs: envInt('NUXT_RATELIMIT_LIKE_WINDOW_MS', 60_000)
  });
  if (!limit.ok) {
    event.node.res.setHeader('Retry-After', String(limit.retryAfterSec));
    throw createError({ statusCode: 429, statusMessage: 'Too many like requests, slow down' });
  }

  // readBody 解析失败（畸形体 / 超大体型等）属无效请求，直接 400，不再静默按“点赞”处理
  // A readBody failure (malformed / oversized payload) is an invalid request: 400, not a silent "like".
  let body: { liked?: boolean } | null | undefined;
  try {
    body = await readBody<{ liked?: boolean }>(event);
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }
  // 缺省/空负载仍视为点赞（保留原有设计）· missing/empty payload still defaults to "like" (original design)
  const liked = body ? body.liked !== false : true;

  const db = useDb();

  // 先确认演唱会存在，避免给不存在的 id 写入孤立的 (concert_id, ip) 行
  // Existence check first: never write orphan (concert_id, ip) rows for a missing id
  const exists = await db.execute({ sql: 'SELECT 1 FROM concerts WHERE id = ?', args: [id] });
  if (!exists.rows.length) {
    throw createError({ statusCode: 404, statusMessage: 'Concert not found' });
  }

  try {
    const res = await setConcertLike(db, id, ip, liked);
    return { id, likes: res.likes, liked: res.liked };
  } catch (e) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update like', cause: e });
  }
});
