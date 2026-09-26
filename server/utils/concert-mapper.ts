/**
 * 演唱会行 → 前端 DTO 的统一装配 · Concert row → card DTO mapping
 *
 * @module server/utils/concert-mapper
 * @description /api/concerts（列表）与 /api/concerts/:id（详情）共用一套列清单与映射逻辑，
 *              保证两端点返回完全相同的形状（songs/tags/liked 由调用方注入）。
 *              类型定义在 shared/types/concert.ts（#shared），前端直接复用。
 *              List and detail endpoints share one column list and one mapping logic, so both
 *              return the exact same shape (songs/tags/liked injected by the caller).
 */
import { parseI18n, parseTags } from './i18n-field';
import type { ConcertCard, ConcertSong } from '#shared/types/concert';

/** libsql Row 的最小抽象（值均先按 unknown 处理，经 str()/num() 收窄）· Minimal libsql Row (values narrowed via str()/num()) */
export type RowLike = Record<string, unknown>;

/** 显式列清单：避免 SELECT * 随表结构漂移，只取 DTO 需要的列 · Explicit column list (no SELECT *), only DTO columns */
export const CONCERT_COLUMNS = [
  'id', 'seq', 'artist_i18n', 'concert_name_i18n', 'theme_i18n', 'country_i18n', 'province_i18n',
  'city_i18n', 'venue_i18n', 'seat_i18n', 'price_i18n', 'date', 'time',
  'description_i18n', 'video_i18n', 'video_url_i18n', 'likes'
].join(', ');

const str = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => Number(v) || 0;

/**
 * 单行 concerts → ConcertCard（songs/tags/liked 由调用方注入）。
 * One concerts row → ConcertCard (songs/tags/liked injected by the caller).
 */
export function mapConcertRow(
  r: RowLike,
  locale: string,
  extra: Partial<Pick<ConcertCard, 'songs' | 'tags' | 'liked'>> = {}
): ConcertCard {
  return {
    id: num(r.id),
    seq: num(r.seq),
    name: parseI18n(r.concert_name_i18n, locale),
    artist: parseI18n(r.artist_i18n, locale),
    theme: parseI18n(r.theme_i18n, locale),
    country: parseI18n(r.country_i18n, locale),
    province: parseI18n(r.province_i18n, locale),
    city: parseI18n(r.city_i18n, locale),
    venue: parseI18n(r.venue_i18n, locale),
    seat: parseI18n(r.seat_i18n, locale),
    price: parseI18n(r.price_i18n, locale),
    date: str(r.date),
    time: str(r.time),
    description: parseI18n(r.description_i18n, locale),
    video: parseI18n(r.video_i18n, locale),
    videoUrl: parseI18n(r.video_url_i18n, locale),
    songs: extra.songs ?? [],
    tags: extra.tags ?? [],
    likes: num(r.likes),
    liked: extra.liked ?? false
  };
}

/** 单行 concert_songlist → { name, link } · one songlist row to { name, link } */
export function mapSong(row: RowLike, locale: string): ConcertSong {
  return { name: parseI18n(row.i18n, locale), link: str(row.link) };
}

/**
 * concert_songlist 行数组 → 歌单（调用方负责按 seq, id 排序）
 * Songlist rows → songs (caller sorts by seq, id)
 */
export function mapSongs(rows: RowLike[], locale: string): ConcertSong[] {
  return rows.map((r) => mapSong(r, locale));
}

/**
 * concert_tags 行 → 去重标签集：每行 i18n 值可为字符串或数组，逐行解析并跨行去重。
 * concert_tags rows → de-duplicated tag list; each row's i18n may be a string or an array.
 */
export function collectTags(rows: RowLike[], locale: string): string[] {
  const tags: string[] = [];
  for (const r of rows) {
    for (const t of parseTags(r.i18n, locale)) if (!tags.includes(t)) tags.push(t);
  }
  return tags;
}

/** 子表行按 concert_id 分组（列表端点一次性取全量后本地装配，避免 N+1）· Group child rows by concert_id (avoids N+1) */
export function groupByConcert(rows: RowLike[]): Map<number, RowLike[]> {
  const m = new Map<number, RowLike[]>();
  for (const r of rows) {
    const cid = Number(r.concert_id);
    const arr = m.get(cid);
    if (arr) arr.push(r);
    else m.set(cid, [r]);
  }
  return m;
}
