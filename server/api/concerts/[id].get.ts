import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3';
import { useDb } from '../../utils/db';
import { getClientIp, isConcertLiked } from '../../utils/concertLikes';
import {
  CONCERT_COLUMNS, collectTags, mapConcertRow, mapSongs, type RowLike
} from '../../utils/concert-mapper';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid concert id' });
  }
  const locale = String(getQuery(event).locale || 'zh-CN');
  const db = useDb();

  // 四路查询互不依赖，并行发出；标签表缺失（未迁移）视为无标签，不阻断详情
  // Four independent queries in parallel; a missing tags table (not migrated) means "no tags", never blocks.
  const [res, songRes, tagRes, liked] = await Promise.all([
    db.execute({ sql: `SELECT ${CONCERT_COLUMNS} FROM concerts WHERE id = ?`, args: [id] }),
    db.execute({
      sql: 'SELECT i18n, link FROM concert_songlist WHERE concert_id = ? ORDER BY seq, id',
      args: [id]
    }),
    db.execute({
      sql: 'SELECT i18n FROM concert_tags WHERE concert_id = ? ORDER BY seq, id',
      args: [id]
    }).catch(() => null),
    isConcertLiked(db, id, getClientIp(event))
  ]);

  const r: unknown = res.rows[0];
  if (!r) throw createError({ statusCode: 404, statusMessage: 'Concert not found' });

  // 与列表端点同形状（songs: { name, link }），前端共用一份 ConcertCard 类型
  // Same shape as the list endpoint (songs: { name, link }), so the frontend shares one ConcertCard type
  return mapConcertRow(r as RowLike, locale, {
    songs: mapSongs(songRes.rows as unknown as RowLike[], locale),
    tags: collectTags((tagRes?.rows ?? []) as unknown as RowLike[], locale),
    liked
  });
});
