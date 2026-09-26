<script setup lang="ts">
// 星球小镇 3D 场景：演唱会数据 + 全屏画布（Three.js 由 PlanetCanvas 动态 import npm 包，不再走 CDN）。
// 由首页 index.vue 渲染（唯一入口，已合并原 /planet），保证「一打开即见星球」。
// Planet-town 3D scene: concert data + full-screen canvas (Three.js is dynamically imported
// from npm by PlanetCanvas, no CDN). Rendered by index.vue (the only entry, /planet merged in),
// so the planet is visible immediately on open.
const { t, messages, locale } = useI18n();
const { data: concerts } = useConcerts();

// 舞台数量 = 数据库实际演唱会条数（不截断）；引擎按此条数均匀铺满球面
// Stage count = actual concert rows from the DB (untruncated); the engine spreads them evenly on the sphere
const stageInfos = computed(() => concerts.value || []);

// 信息卡文案：自动发现当前语言 card 组的键（不手维护键列表，新增文案只改 locale JSON），
// 但每个键都经 t() 求值取回真正的字符串——直接 spread messages.value[locale].card 拿到的是
// @nuxtjs/i18n v10 编译后的消息 AST 节点（{type,start,end,...}），拼字符串会抛错。
// Card labels: auto-discover the current locale's `card` keys (no hand-maintained list; new labels
// only touch the locale JSON), but resolve each key through t() to get a real string — spreading
// messages.value[locale].card would yield @nuxtjs/i18n v10's compiled message AST nodes
// ({type,start,end,...}), which throw when concatenated.
const labels = computed<Record<string, string>>(() => {
  // 消息树类型对任意分组键不设约束，这里按约定收窄 · the message tree is unconstrained per group key; narrow by convention here
  const tree = messages.value as unknown as Record<string, { card?: Record<string, unknown> }>;
  const keys = Object.keys(tree[locale.value]?.card ?? {});
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = t(`card.${k}`);
  return out;
});
</script>

<template>
  <div class="planet-wrap">
    <ClientOnly>
      <PlanetCanvas :stage-infos="stageInfos" :labels="labels" :loading="t('planet.loading')" />
      <template #fallback>
        <div class="canvas-shell"><div class="canvas-loading">{{ t('planet.loading') }}</div></div>
      </template>
    </ClientOnly>

    <!-- 页面级附加内容插槽（预留）注入到场景容器内 -->
    <slot />
  </div>
</template>
