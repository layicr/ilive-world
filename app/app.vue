<script setup lang="ts">
const { locale } = useI18n();
const route = useRoute();
const config = useRuntimeConfig();
const { data: site } = useSiteConfig();

// 站点正式域名：库 site_settings.site_url → NUXT_PUBLIC_SITE_URL
// Canonical site URL: DB site_settings.site_url → NUXT_PUBLIC_SITE_URL
const siteUrl = computed(
  () => site.value?.settings?.site_url || config.public.siteUrl || ''
);
const siteTitle = computed(
  () => site.value?.seo?.site_title?.[locale.value]|| ''
);
const siteDesc = computed(
  () => site.value?.seo?.site_description?.[locale.value] || ''
);
const siteKeywords = computed(
  () => site.value?.seo?.keywords?.[locale.value] || ''
);

// 多语言信号：hreflang alternates + og:locale（useLocaleHead 内含）
// i18n signals: hreflang alternates + og:locale (both produced by useLocaleHead)
const localeHead = useLocaleHead({ addSeoAttributes: true, dir: false });
useHead(localeHead);

// 标题模板：页面短标题 + 站点名；等于站点名时不重复
// Title template: page title + site name; no duplication when they are equal
useHead({
  titleTemplate: (title: string | undefined) => {
    const base = siteTitle.value;
    return title && title !== base ? `${title} | ${base}` : base;
  }
});

// canonical：当前本地化路径 + 正式域名 · canonical: current localized path on the canonical domain
const canonical = computed(() => {
  if (!siteUrl.value) return undefined;
  try { return new URL(route.fullPath, siteUrl.value).href; }
  catch { return undefined; }
});
// og 图：库可配相对/绝对路径，统一解成绝对 URL · og image: DB value may be relative or absolute; always resolved to absolute
const ogImage = computed(() => {
  const img = site.value?.settings?.og_image || '/img/og-image.svg';
  if (!siteUrl.value) return img;
  try { return new URL(img, siteUrl.value).href; } catch { return img; }
});

useHead({
  link: () => canonical.value
    ? [{ rel: 'canonical', href: canonical.value }]
    : []
});

// keywords 未包含在 useSeoMeta 的类型定义内，直接用 useHead 输出 <meta name="keywords">
// keywords is not typed in useSeoMeta, so emit the meta tag through useHead directly
useHead({
  meta: () => (siteKeywords.value ? [{ name: 'keywords', content: siteKeywords.value }] : [])
});

useSeoMeta({
  description: () => siteDesc.value,
  ogSiteName: () => siteTitle.value,
  ogTitle: () => siteTitle.value,
  ogDescription: () => siteDesc.value,
  ogType: 'website',
  ogImage: () => ogImage.value,
  ogUrl: () => canonical.value,
  twitterCard: 'summary_large_image',
  twitterSite: () => site.value?.settings?.twitter_site || undefined,
  twitterCreator: () => site.value?.settings?.twitter_creator || undefined,
  author: () => site.value?.settings?.author || undefined,
  robots: () => site.value?.settings?.robots || 'index, follow'
});
</script>

<template>
  <div class="app-shell">
    <SiteHeader />
    <main>
      <!-- 稳定 key：仅语言前缀不同（/ 与 /en/ 等）复用同一页面实例，避免切换语言时重建整个 Three.js 场景而卡顿 -->
      <!-- Stable key: pages differing only by locale prefix (/, /en/, ...) reuse one instance,
           so switching language never rebuilds the whole Three.js scene (no jank) -->
      <NuxtPage :page-key="() => 'app'" />
    </main>
  </div>
</template>
