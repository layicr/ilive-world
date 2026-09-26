// 站点级 SEO 配置（site_settings + 三语 site_seo_i18n），SSR/预渲染期从 Nitro API 拉取。
// Site-level SEO config (site_settings + trilingual site_seo_i18n), fetched during SSR/prerender.
export interface SiteConfigData {
  settings: Record<string, string | null>;
  seo: Record<string, Record<string, string>>;   // key -> 按 locale 的文案 · key -> text per locale { 'zh-CN', 'en', 'zh-Hant' }
}

export function useSiteConfig() {
  return useFetch<SiteConfigData>('/api/site-config', {
    key: 'site-config',
    default: () => ({ settings: {}, seo: {} })
  });
}
