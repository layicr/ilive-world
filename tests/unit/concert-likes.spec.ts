import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createClient, type Client } from '@libsql/client';
import {
  setConcertLike, fetchLikedConcertIds, isConcertLiked, resolveClientIp
} from '../../server/utils/concertLikes';

// 点赞写入 setConcertLike 的功能 / 数据层测试（进程内内存库，直测不依赖 Nitro）
// Functional / data-layer tests for setConcertLike against an in-process in-memory DB (no Nitro runtime).
// 覆盖三条核心不变量：① UNIQUE(concert_id, ip) 天然去重、幂等；② concerts.likes 冗余列只按
// 「真实行变更」±1，基线热度不被 COUNT 冲没；③ 计数下限 0，取消不会减成负数。
// It covers three invariants: (1) UNIQUE(concert_id, ip) dedup / idempotency; (2) the denormalized
// concerts.likes moves ±1 only on real row changes so the seeded baseline is never wiped by COUNT;
// (3) the count floors at 0 — unliking cannot drive it negative.
let db: Client;
const DB_PATH = join(tmpdir(), `ilive-likes-test_${process.pid}_${Date.now()}.db`);
const IP_A = resolveClientIp('203.0.113.7');
const IP_B = resolveClientIp('198.51.100.9');

async function likes(id: number): Promise<number> {
  const r = await db.execute({ sql: 'SELECT likes FROM concerts WHERE id = ?', args: [id] });
  return Number((r.rows[0] as unknown as { likes: number }).likes);
}
async function rowCount(id: number): Promise<number> {
  const r = await db.execute({ sql: 'SELECT COUNT(*) n FROM concert_likes WHERE concert_id = ?', args: [id] });
  return Number((r.rows[0] as unknown as { n: number }).n);
}

beforeAll(async () => {
  // 用临时文件库（而非 ':memory:'）：vitest 下 sqlite3 驱动的内存连接在钩子边界会
  // 被回收成空库，导致 beforeAll 能读到表、后续钩子却报「no such table」。与真机
  // 一致走 file: 连接，彻底避开该陷阱；跨连接始终指向同一物理库。
  // Use a temp FILE db instead of ':memory:': under vitest the sqlite3 driver's in-memory
  // connection is recycled to an empty DB across hook boundaries (beforeAll sees the tables,
  // later hooks throw "no such table"). A file: connection matches production and always points
  // at the same physical DB.
  db = createClient({ url: 'file:' + DB_PATH });
  await db.executeMultiple(readFileSync(resolve(process.cwd(), 'schema.sql'), 'utf8'));
  // 两场基线热度：id=1 起点 40（模拟 seed 写入的既有点赞），id=2 起点 0
  // Two baseline counts: id 1 starts at 40 (the seeded heat), id 2 at 0.
  await db.execute({
    sql: `INSERT INTO concerts (id, artist_i18n, concert_name_i18n, date, likes) VALUES
      (1, '{"zh-CN":"A"}', '{"zh-CN":"演唱会一"}', '2026-01-01', 40),
      (2, '{"zh-CN":"B"}', '{"zh-CN":"演唱会二"}', '2026-02-02', 0)`
  });
});
afterAll(async () => { await db.close(); try { rmSync(DB_PATH, { force: true }); } catch { /* ignore */ } });

// 每个用例从干净点赞表出发，互不影响 · each case starts from a clean likes table
beforeEach(async () => {
  await db.execute('DELETE FROM concert_likes');
  await db.execute({ sql: 'UPDATE concerts SET likes = 40 WHERE id = 1' });
  await db.execute({ sql: 'UPDATE concerts SET likes = 0 WHERE id = 2' });
});

describe('setConcertLike —— 幂等去重 + 冗余计数 · idempotent dedup + denormalized count', () => {
  it('首次点赞：写一行并把冗余列 +1（40 → 41）· first like inserts one row and bumps the total', async () => {
    const res = await setConcertLike(db, 1, IP_A, true);
    expect(res).toEqual({ likes: 41, liked: true });
    expect(await rowCount(1)).toBe(1);
    expect(await likes(1)).toBe(41);
  });

  it('重复点赞同 IP：幂等，行数与计数都不变（基线不被 COUNT 冲没）· repeated like is idempotent, baseline survives', async () => {
    await setConcertLike(db, 1, IP_A, true);
    const again = await setConcertLike(db, 1, IP_A, true);
    expect(again).toEqual({ likes: 41, liked: true });
    expect(await rowCount(1)).toBe(1);
  });

  it('取消点赞：删行并回落（41 → 40），再次取消仍幂等 · unlike removes the row and reverts, second unlike is a no-op', async () => {
    await setConcertLike(db, 1, IP_A, true);
    const off = await setConcertLike(db, 1, IP_A, false);
    expect(off).toEqual({ likes: 40, liked: false });
    expect(await rowCount(1)).toBe(0);
    const off2 = await setConcertLike(db, 1, IP_A, false);
    expect(off2).toEqual({ likes: 40, liked: false });
  });

  it('不同 IP 各自独立计数，互不串扰 · distinct IPs count independently', async () => {
    await setConcertLike(db, 1, IP_A, true);   // 41
    const b = await setConcertLike(db, 1, IP_B, true);   // 42
    expect(b.likes).toBe(42);
    expect(await rowCount(1)).toBe(2);
    const aOff = await setConcertLike(db, 1, IP_A, false);   // A 取消 → 41 · A unlike -> 41
    expect(aOff).toEqual({ likes: 41, liked: false });
  });

  it('计数下限 0：库中行与冗余列不一致时，取消也只减到 0，绝不出现负数 · count floors at 0, never negative', async () => {
    // 直接塞一行（绕过 +1），使 likes 仍为 0 但存在点赞行 · force a row without bumping likes
    await db.execute({ sql: 'INSERT INTO concert_likes (concert_id, ip) VALUES (2, ?)', args: [IP_A] });
    const res = await setConcertLike(db, 2, IP_A, false);   // 删行 → delta -1 → CASE 兜底到 0 · delete -> delta -1 -> floored
    expect(res.likes).toBe(0);
    expect(await likes(2)).toBe(0);
  });

  it('缺省 liked=true（接口对空负载的处理）：显式 true 落库 · explicit true persists', async () => {
    const res = await setConcertLike(db, 2, IP_A, true);   // 0 → 1
    expect(res).toEqual({ likes: 1, liked: true });
  });
});

describe('读装配 fetchLikedConcertIds / isConcertLiked · read helpers', () => {
  it('点赞集合与单场判定随写入状态变化 · the liked set and per-concert check track writes', async () => {
    expect(await isConcertLiked(db, 1, IP_A)).toBe(false);
    await setConcertLike(db, 1, IP_A, true);
    await setConcertLike(db, 2, IP_A, true);
    expect(await isConcertLiked(db, 1, IP_A)).toBe(true);
    const set = await fetchLikedConcertIds(db, IP_A);
    expect([...set].sort()).toEqual([1, 2]);
    // 另一 IP 看不到 A 的点赞 · another IP does not see A's likes
    expect(await fetchLikedConcertIds(db, IP_B).then(s => s.size)).toBe(0);
  });

  it('未迁移库（无 concert_likes 表）时读操作安全视为「无点赞」· reads safely treat a missing table as "no likes"', async () => {
    const bare = createClient({ url: ':memory:' });
    expect(await isConcertLiked(bare, 1, IP_A)).toBe(false);       // 表不存在 → false · missing table -> false
    expect((await fetchLikedConcertIds(bare, IP_A)).size).toBe(0);
    await bare.close();
  });
});
