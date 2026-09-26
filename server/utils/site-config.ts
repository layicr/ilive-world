import { useDb } from './db';

interface SiteConfig {
  settings: Record<string, string | null>;
  seo: Record<string, string>;   // key -> 原始 *_i18n JSON 文本 · key -> raw *_i18n JSON text
}

let _cache: { at: number; data: SiteConfig } | null = null;
const TTL = 60_000;   // 60s 内存缓存 · 60s in-process cache

/** site_settings 中前端真正用到的列（显式清单，不用 SELECT *，与 concert-mapper 同一原则）
 *  Explicit list of site_settings columns actually used by the frontend (no SELECT *, same rule as concert-mapper) */
const SETTING_KEYS = ['og_image', 'twitter_site', 'twitter_creator', 'author', 'robots', 'site_url'] as const;

/**
 * 读取站点级 SEO 配置（site_settings 单行 + site_seo_i18n）。失败返回空对象，交由调用方兜底。
 * Read site-level SEO config (single site_settings row + site_seo_i18n). Returns empty on failure; caller falls back.
 */
export async function getSiteConfig(force = false): Promise<SiteConfig> {
  if (!force && _cache && Date.now() - _cache.at < TTL) return _cache.data;
  const empty: SiteConfig = { settings: {}, seo: {} };
  try {
    const db = useDb();
    // 两路查询互不依赖，并行发出 · two independent queries in parallel
    const [s, seoRows] = await Promise.all([
      db.execute(`SELECT ${SETTING_KEYS.join(', ')} FROM site_settings WHERE id = 1`),
      db.execute('SELECT key, value_i18n FROM site_seo_i18n')
    ]);
    const settings: Record<string, string | null> = {};
    const row = s.rows[0] as unknown as Record<string, unknown> | undefined;
    if (row) {
      for (const k of SETTING_KEYS) {
        settings[k] = row[k] != null ? String(row[k]) : null;
      }
    }
    const seo: Record<string, string> = {};
    for (const r of seoRows.rows as unknown as { key: unknown; value_i18n: unknown }[]) {
      if (r.key != null && r.value_i18n != null) seo[String(r.key)] = String(r.value_i18n);
    }
    const data: SiteConfig = { settings, seo };
    _cache = { at: Date.now(), data };
    return data;
  } catch {
    return empty;
  }
}
