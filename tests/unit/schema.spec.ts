import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@libsql/client';

// 校验 schema.sql 可执行、四表齐全，且 concerts / concert_songlist 列名与冻结清单一致。
// Verify schema.sql runs, all four tables exist, and concerts / concert_songlist columns match the frozen list.
let db: ReturnType<typeof createClient>;

beforeAll(async () => {
  db = createClient({ url: ':memory:' });
  const schema = readFileSync(resolve(process.cwd(), 'schema.sql'), 'utf8');
  await db.executeMultiple(schema);
});

async function tables() {
  const r = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
  return (r.rows as any[]).map(x => x.name).sort();
}
async function columns(table: string) {
  const r = await db.execute(`PRAGMA table_info(${table})`);
  return (r.rows as any[]).map(x => x.name);
}

describe('schema.sql', () => {
  it('建出四张表', async () => {
    const t = await tables();
    expect(t).toEqual(expect.arrayContaining(['concerts', 'concert_songlist', 'site_settings', 'site_seo_i18n']));
  });

  it('concerts 列名与冻结清单完全一致', async () => {
    expect(await columns('concerts').then(c => c.slice().sort())).toEqual([
      'artist_i18n', 'concert_name_i18n', 'country_i18n', 'date', 'description_i18n', 'id',
      'likes', 'poster', 'price_i18n', 'province_i18n', 'seat_i18n', 'seq', 'theme_i18n',
      'time', 'venue_i18n', 'video_i18n', 'video_url_i18n', 'city_i18n'
    ].sort());
  });

  it('concert_songlist 列名与冻结清单完全一致', async () => {
    expect((await columns('concert_songlist')).sort()).toEqual(['concert_id', 'id', 'i18n', 'link', 'seq'].sort());
  });

  it('内置种子写入 site_settings 单行 + 三语 site_seo_i18n', async () => {
    const s = await db.execute('SELECT COUNT(*) c FROM site_settings');
    expect(Number((s.rows as any[])[0].c)).toBe(1);
    const seo = await db.execute('SELECT key FROM site_seo_i18n');
    expect((seo.rows as any[]).map(r => r.key).sort()).toEqual(['keywords', 'site_description', 'site_title']);
  });
});
