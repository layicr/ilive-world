<script setup lang="ts">
// 首页欢迎卡：浮层覆盖在 3D 画布之上，定位到星球左侧、垂直居中。
// 点 X 或 CTA 均可关闭；搜索聚焦某场演唱会时也会自动收起（共享 useWelcomeCard 状态）。
// Homepage welcome card: an overlay above the 3D canvas, pinned left and vertically centered.
// Closed by X or CTA; also auto-collapses when a search focuses a concert (shared useWelcomeCard state).
const { t } = useI18n();
const { visible, collapse: dismiss } = useWelcomeCard();
// 第一行：从数据库实时读取演唱会总数（/api/concerts，与 PlanetScene 共享 useFetch 缓存）
// Row 1: live concert total from the DB (/api/concerts, useFetch cache shared with PlanetScene)
const { data: concerts } = useConcerts();
const concertCount = computed(() => (concerts.value || []).length);
// 第二行：艺人总数（数据库去重）· Row 2: distinct artists (deduped from the DB)
const artistCount = computed(() => new Set((concerts.value || []).map((c) => c.artist)).size);
// 第三行：城市总数（数据库去重）· Row 3: distinct cities (deduped from the DB)
const cityCount = computed(() => new Set((concerts.value || []).map((c) => c.city)).size);
const controls = computed(() => [
  { k: t('welcome.ctrl1Val'), v: String(concertCount.value) },
  { k: t('welcome.ctrl2Val'), v: String(artistCount.value) },
  { k: t('welcome.ctrl3Val'), v: String(cityCount.value) }
]);
</script>

<template>
  <Transition name="wc-fade">
    <aside v-if="visible" class="welcome-card" aria-label="welcome">
      <button class="wc-close" type="button" :aria-label="t('welcome.close')" @click="dismiss">✕</button>
      <div class="wc-badge" aria-hidden="true">✿</div>
      <p class="wc-eyebrow">{{ t('welcome.eyebrow') }}</p>
      <h2 class="wc-title">{{ t('welcome.title') }}</h2>
      <p class="wc-body">{{ t('welcome.body') }}</p>

      <dl class="wc-controls">
        <div v-for="(c, i) in controls" :key="i" class="wc-row">
          <dt>{{ c.k }}</dt>
          <dd>{{ c.v }}</dd>
        </div>
      </dl>

      <button class="wc-cta" type="button" @click="dismiss">
        <span>{{ t('welcome.cta') }}</span>
        <span class="wc-cta-arrow" aria-hidden="true">→</span>
      </button>
      <p class="wc-hint">{{ t('welcome.hint') }}</p>
    </aside>
  </Transition>
</template>

<!-- 样式已迁至 app/assets/css/main.css（本就是非 scoped 全局样式，集中管理）
     Styles moved to app/assets/css/main.css (they were unscoped/global anyway; kept in one place) -->
