<script setup lang="ts">
// 右侧演唱会列表浮层：默认收起只显示 3 条（时间 / 艺人 / 主题摘要，超 35 字截断加省略号），
// 点「展开全部 / 收起」伸缩；点任意一条经 ?concert=<id> 让 3D 引擎把镜头转到对应舞台
// （复用 PlanetCanvas 既有的聚焦机制，与搜索框同一链路）。数据与欢迎卡共享 useConcerts 缓存。
// Right-side concert list overlay: collapsed by default to 3 rows (time / artist / theme excerpt,
// truncated past 35 chars). A toggle expands/collapses the full list; clicking a row pushes
// ?concert=<id> so the 3D engine flies to that stage (the same mechanism the search box uses).
// Data comes from useConcerts, whose cache is shared with the welcome card / PlanetScene.
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { data: concerts } = useConcerts();

const COLLAPSED_COUNT = 3;   // 收起态显示条数 · rows visible while collapsed
const THEME_MAX = 35;        // 主题摘要截断长度 · theme excerpt truncation length

const expanded = ref(false);
// 最小化：点右上角按钮收起整个列表，界面飘出一朵可移动的黄金云；点云则恢复列表并隐去云。
// Minimize: the top-right button hides the panel and releases a drifting golden cloud;
// clicking the cloud restores the panel and makes the cloud vanish.
const minimized = ref(false);
// 列表按日期倒序（最近在前）。只对副本排序：concerts 是与 PlanetScene / 欢迎卡
// 共享的 useFetch 缓存，而 3D 舞台按数组下标对齐 stageInfos，原地 sort 会打乱舞台顺序。
// Sort by date desc (newest first) on a copy: `concerts` is the useFetch cache shared with
// PlanetScene / the welcome card, and 3D stages align by array index, so an in-place sort
// would scramble stage order.
const all = computed(() => [...(concerts.value || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')));
const total = computed(() => all.value.length);
const visible = computed(() => (expanded.value ? all.value : all.value.slice(0, COLLAPSED_COUNT)));

// 主题超 35 字截断加省略号；主题为空回退演唱会名 · truncate past 35 chars; fall back to the name
function excerpt(s?: string) {
  const v = (s || '').trim();
  return v.length > THEME_MAX ? `${v.slice(0, THEME_MAX)}…` : v;
}

// 聚焦对应舞台：写 ?concert=<id>，PlanetCanvas 的 watch 会接手转动镜头并弹卡
// Focus the stage: write ?concert=<id>; PlanetCanvas's watch turns the camera and pops the card
function focusConcert(id: number) {
  router.push({ query: { ...route.query, concert: String(id) } });
}
</script>

<template>
  <aside v-if="total && !minimized" class="concert-list" :aria-label="t('concertList.title')">
    <!-- 用 div 而非 header：页面已有全站唯一的 <header class="site-header">，
         再引入第二个 header 会破坏以 header 为锚点的严格选择器（含 e2e）
         Plain div: the page already owns the single <header class="site-header">; a second one
         would break strict selectors anchored on `header` (including e2e). -->
    <div class="cl-head">
      <span class="cl-badge" aria-hidden="true">♪</span>
      <h3 class="cl-title">{{ t('concertList.title') }}</h3>
      <span class="cl-count">{{ visible.length }} / {{ total }}</span>
      <button class="cl-min" type="button" :aria-label="t('concertList.minimize')" :title="t('concertList.minimize')" @click="minimized = true">
        <span aria-hidden="true">─</span>
      </button>
    </div>

    <ul class="cl-items">
      <li v-for="c in visible" :key="c.id">
        <button class="cl-item" type="button" @click="focusConcert(c.id)">
          <span class="cl-meta">{{ c.date }}<template v-if="c.time"> {{ c.time }}</template></span>
          <span class="cl-artist">{{ c.artist }}</span>
          <span class="cl-theme">{{ excerpt(c.theme || c.name) }}</span>
        </button>
      </li>
    </ul>

    <button class="cl-toggle" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
      <span>{{ expanded ? t('concertList.collapse') : t('concertList.expand') }}</span>
      <span class="cl-arrow" :class="{ up: expanded }" aria-hidden="true">▾</span>
    </button>
  </aside>

  <!-- 黄金云：列表最小化后漂浮移动，点击恢复列表 · golden cloud: drifts after minimize, click to restore -->
  <Transition name="cl-cloud">
    <div v-if="total && minimized" class="golden-cloud-wrap">
      <button
        class="golden-cloud"
        type="button"
        :aria-label="t('concertList.restore')"
        :title="t('concertList.restore')"
        @click="minimized = false"
      >
        <span class="gc-puff gc-puff-1" aria-hidden="true"></span>
        <span class="gc-puff gc-puff-2" aria-hidden="true"></span>
        <span class="gc-puff gc-puff-3" aria-hidden="true"></span>
        <span class="gc-puff gc-puff-4" aria-hidden="true"></span>
        <span class="gc-puff gc-puff-5" aria-hidden="true"></span>
        <span class="gc-puff gc-puff-6" aria-hidden="true"></span>
      </button>
    </div>
  </Transition>
</template>

<!-- 样式集中于 app/assets/css/main.css（与欢迎卡同一管理策略）
     Styles live in app/assets/css/main.css (same centralization as the welcome card) -->
