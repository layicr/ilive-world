import { createClient, type Client } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

let _db: Client | null = null;

/**
 * 解析数据库连接（server 与 scripts/seed.mjs 保持同规则），统一由 DATABASE_URL 决定：
 * Resolve the DB connection (same rule as scripts/seed.mjs), driven entirely by DATABASE_URL:
 *  1) DATABASE_URL 为 libsql:// 或 http(s):// → 连 Turso 云，带 TURSO_AUTH_TOKEN · Turso cloud URL, authenticated
 *  2) DATABASE_URL 为其他值（本地路径，可带 file: 前缀，相对或绝对）→ 本地 SQLite 文件 · local SQLite file (optional file: prefix)
 *  3) DATABASE_URL 为空 → 默认本地 file:./data/planet.db（开发零配置可跑）· empty → local default, zero-config dev
 *     · 本地相对路径按进程工作目录解析为绝对路径，并确保父目录存在 · relative paths resolved against cwd; parent dir created
 */
function toFileUrl(spec: string): string {
  const abs = resolve(process.cwd(), spec.replace(/^file:/, ''));
  try { mkdirSync(dirname(abs), { recursive: true }); } catch { /* ignore */ }
  return 'file:' + abs;
}

function connection(): { url: string; authToken?: string } {
  const raw = (process.env.DATABASE_URL || '').trim();
  const auth = process.env.TURSO_AUTH_TOKEN;
  if (/^(libsql|https?):\/\//.test(raw)) {
    return { url: raw, authToken: auth || undefined };
  }
  return { url: toFileUrl(raw || 'data/planet.db') };
}

export function useDb(): Client {
  if (!_db) _db = createClient(connection());
  return _db;
}
