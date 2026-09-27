<script setup lang="ts">
// 首页即星球小镇（唯一入口，已合并原 /planet）：直接渲染 3D 场景 + 欢迎卡，并带站点级 WebSite 结构化数据。
// 页面 title / og（website、绝对 URL）由 app.vue 全局 head 提供。
// The homepage IS the planet town (only entry, /planet merged in): 3D scene + welcome card, with
// site-level WebSite structured data. Page title / og tags come from the global head in app.vue.
const { t, locale } = useI18n();
const localePath = useLocalePath();
const { data: site } = useSiteConfig();
const { data: concerts } = useConcerts();
const config = useRuntimeConfig();

const siteUrl = computed(() => site.value?.settings?.site_url || config.public.siteUrl || '');
// 互动数用真实点赞总和（构建/刷新时的快照），不再写死假数据
// interactionCount uses the real like total (snapshot at build/refresh time), no more hardcoded fake numbers
const totalLikes = computed(() => (concerts.value || []).reduce((s, c) => s + (c.likes || 0), 0));
const jsonLd = computed(() => {
  const langs = ['zh-CN', 'en', 'zh-Hant'];
  const homeUrl = siteUrl.value ? new URL(localePath('/'), siteUrl.value).href : localePath('/');
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.value?.seo?.site_title?.[locale.value] || t('brand'),
    url: siteUrl.value || undefined,
    inLanguage: langs,
    workExample: [{
      '@type': 'CreativeWork',
      name: t('planet.h1'),
      inLanguage: langs,
      url: homeUrl,
      interactionCount: String(totalLikes.value)
    }]
  };
});
// 安全：JSON.stringify 不转义 `<`，库内可配的 SEO 文案若含「script 闭合标签序列」会打断脚本块形成存储型 XSS；
// 把 `<` 转为 \u003c 后仍是合法 JSON，且 HTML 解析器不会再把它当闭合标签。
// Security: JSON.stringify does not escape `<`, so DB-editable SEO text containing a script closing
// tag sequence could break out of the script block (stored XSS). Replacing `<` with \u003c keeps the
// JSON valid while the HTML parser no longer sees a closing tag.
const jsonLdString = computed(() => JSON.stringify(jsonLd.value).replace(/</g, '\\u003c'));
// 首页 description 也走 DB（site_seo_i18n.site_description），与全局 / og:description 保持一致；
// 库未配置时回退到本地化文案 planet.intro，不降级为空。
// Homepage description also comes from the DB (site_seo_i18n.site_description) to stay consistent
// with the global / og:description; falls back to the localized planet.intro, never empty.
useSeoMeta({
  description: () => site.value?.seo?.site_description?.[locale.value] || t('planet.intro')
});
useHead({
  script: [{ type: 'application/ld+json', innerHTML: () => jsonLdString.value }]
});
</script>

<template>
  <PlanetScene />
  <PlanetWelcomeCard />
  <PlanetConcertList />
</template>
