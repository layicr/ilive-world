/**
 * 演唱会共享数据快照 · Shared concert-data snapshot
 *
 * @module server/utils/concert-snapshot
 * @description 列表接口每次都全量拉 concerts / songlist / tags 三张表；这些数据仅经 seed
 *              或后台写库、变更极低频，而部署在 Turso 云时每张表都是一次网络往返。
 *              这里按 site-config 同款模式做 60s 进程内快照：三路查询并行取一次、缓存原始行，
 *              「当前 IP 的点赞集合」不进快照（按访客实时查）。
 *              代价：点赞后 concerts.likes 冗余列的变化最多延迟 60s 出现在列表里
 *              （点赞接口即时返回权威计数，客户端乐观更新，感知不到）。
 *
 *              The list endpoint used to full-scan concerts/songlist/tags on every request, but
 *              this data changes rarely (seed / admin writes only) and each table is a network
 *              round-trip on Turso. Cache the raw rows for 60s in-process (same pattern as
 *              site-config); the per-client "liked" set is still queried live. Trade-off: like
 *              counts on the list lag up to 60s — invisible to users, since the like endpoint
 *              returns the authoritative count immediately.
 */
import { useDb } from './db';
import { CONCERT_COLUMNS, type RowLike } from './concert-mapper';

/** 一次快照携带的原始行 · raw rows carried by one snapshot */
export interface ConcertsSnapshot {
  concerts: RowLike[];
  songs: RowLike[];
  /** 标签表缺失（未迁移）→ null 视为无标签 · missing tags table (not migrated) → null means "no tags" */
  tags: RowLike[] | null;
}

let _cache: { at: number; data: ConcertsSnapshot } | null = null;
const TTL = 60_000;          // 60s 内存快照 · 60s in-process snapshot
const MAX_ROWS = 500;        // 与原列表接口上限一致 · same cap as the old list query

/**
 * 取共享数据快照（命中缓存则直接返回）· Get the shared snapshot (cache-first)
 * @param force 跳过缓存强制重查（预留给后台写库后的失效钩子）· bypass cache (hook for future admin-write invalidation)
 */
export async function getConcertsSnapshot(force = false): Promise<ConcertsSnapshot> {
  if (!force && _cache && Date.now() - _cache.at < TTL) return _cache.data;
  const db = useDb();
  // 三路查询互不依赖，并行发出 · three independent queries in parallel
  const [concerts, songRows, tagRows] = await Promise.all([
    db.execute({
      sql: `SELECT ${CONCERT_COLUMNS} FROM concerts ORDER BY seq, id LIMIT ?`,
      args: [MAX_ROWS]
    }),
    db.execute('SELECT concert_id, i18n, link FROM concert_songlist ORDER BY seq, id'),
    // 表缺失（未迁移）→ 视为无标签，不阻断列表 · missing table (not migrated) → no tags, never blocks the list
    db.execute('SELECT concert_id, i18n FROM concert_tags ORDER BY seq, id').catch(() => null)
  ]);
  const data: ConcertsSnapshot = {
    concerts: concerts.rows as unknown as RowLike[],
    songs: songRows.rows as unknown as RowLike[],
    tags: tagRows ? (tagRows.rows as unknown as RowLike[]) : null
  };
  _cache = { at: Date.now(), data };
  return data;
}
