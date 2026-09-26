export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  future: { compatibilityVersion: 4 },

  modules: ['@nuxtjs/i18n'],

  css: ['~/assets/css/main.css'],

  // 构建期不做全量类型检查（编辑器 / vue-tsc 仍走 tsconfig strict）
  // No full type-check at build time (editor / vue-tsc still use tsconfig strict)
  typescript: {
    typeCheck: false,
    strict: true
  },

  // 站点正式地址：优先 .env 的 NUXT_PUBLIC_SITE_URL；库内 site_settings.site_url 覆盖
  // （也是导航 ilive 外链 / 背景音乐的站点基址）
  // Canonical site URL: prefers NUXT_PUBLIC_SITE_URL from .env; overridden by DB site_settings.site_url
  // (also the base for the ilive nav external link and the background music)
  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://iliveworld.lyc.la'
    }
  },

  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
    }
  },

  i18n: {
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://iliveworld.lyc.la',
    locales: [
      { code: 'zh-CN', language: 'zh-CN', file: 'zh-CN.json', name: '简体中文' },
      { code: 'en', language: 'en-US', file: 'en.json', name: 'English' },
      { code: 'zh-Hant', language: 'zh-Hant', file: 'zh-Hant.json', name: '繁體中文' }
    ],
    defaultLocale: 'zh-CN',
    strategy: 'prefix_except_default',
    // langDir 相对 i18n restructure 目录（i18nDir，默认 <root>/i18n）解析，
    // 因此 'locales' 实际指向 i18n/locales/（见 @nuxtjs/i18n 的 resolve(i18nDir, langDir)）。
    // langDir is resolved against the i18n restructure dir (i18nDir = <root>/i18n by default),
    // so 'locales' already resolves to i18n/locales/.
    langDir: 'locales',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      redirectOn: 'root'
    }
  },

  routeRules: {
    '/': { prerender: true }
  },

  nitro: {
    prerender: {
      crawlLinks: false,
      routes: ['/', '/en/', '/zh-Hant/']
    }
  }
});
