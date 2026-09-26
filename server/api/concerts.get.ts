import { defineEventHandler, getQuery } from 'h3';
import { useDb } from '../utils/db';
import { getClientIp, fetchLikedConcertIds } from '../utils/concertLikes';
import { getConcertsSnapshot } from '../utils/concert-snapshot';
import {
  collectTags, groupByConcert, mapConcertRow, mapSong, type RowLike
} from '../utils/concert-mapper';

export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  const locale = String(q.locale || 'zh-CN');
  const limit = Math.min(500, Math.max(1, Number(q.limit) || 500));   // 抬高上限，保证“全部渲染”不被截断 · high cap so all stages render

  // 共享数据（concerts/songs/tags）走 60s 快照（见 utils/concert-snapshot），
  // 只有「当前 IP 点赞集合」按访客实时查；Turso 远程部署时 4 次往返降为 2 次
  // Shared rows come from the 60s snapshot (see utils/concert-snapshot); only the per-client liked
  // set is queried live: 4 round-trips become 2 on remote Turso.
  const [snap, likedSet] = await Promise.all([
    getConcertsSnapshot(),
    fetchLikedConcertIds(useDb(), getClientIp(event))
  ]);

  const songsByConcert = groupByConcert(snap.songs);
  const tagsByConcert = snap.tags ? groupByConcert(snap.tags) : new Map<number, RowLike[]>();

  // limit 在内存切片（快照已按 seq, id 有序）· slice in memory (snapshot rows are pre-sorted by seq, id)
  return snap.concerts.slice(0, limit).map((r) => {
    const cid = Number(r.id);
    return mapConcertRow(r, locale, {
      songs: (songsByConcert.get(cid) || []).map((s) => mapSong(s, locale)),
      tags: collectTags(tagsByConcert.get(cid) || [], locale),
      liked: likedSet.has(cid)
    });
  });
});
