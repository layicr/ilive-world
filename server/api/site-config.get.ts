import { defineEventHandler } from 'h3';
import { getSiteConfig } from '../utils/site-config';
import { parseI18n } from '../utils/i18n-field';

/**
 * 站点级 SEO 配置：site_settings（与语言无关）+ site_seo_i18n（三语）。
 * 输出把 *_i18n 预解析成按 locale 的映射，前端直接取用。
 * Site-level SEO config: site_settings (locale-free) + site_seo_i18n (3 locales).
 * Output pre-resolves every *_i18n into a locale-keyed map the frontend can use directly.
 */
export default defineEventHandler(async () => {
  const { settings, seo } = await getSiteConfig();
  const locales = ['zh-CN', 'en', 'zh-Hant'];
  const seoResolved: Record<string, Record<string, string>> = {};
  for (const key of Object.keys(seo)) {
    const per: Record<string, string> = {};
    for (const loc of locales) per[loc] = parseI18n(seo[key], loc);
    seoResolved[key] = per;
  }
  return { settings, seo: seoResolved };
});
