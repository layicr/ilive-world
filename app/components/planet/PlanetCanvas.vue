<script setup lang="ts">
// 3D 画布容器：唯一与 Three.js 引擎交互的 Vue 组件（挂载/卸载/暂停/语言切换/搜索聚焦）。
// Vue wrapper around the planet engine: mount/unmount, pause on hidden, language sync, search focus.
import { createPlanetTown } from '~/three/planetTown';
import type { ConcertCard } from '#shared/types/concert';

const props = defineProps<{
  stageInfos?: ConcertCard[];   // 演唱会数据（每个摆一座舞台）· concerts, one stage each
  labels?: Record<string, any>; // 信息卡多语言文案 · localized card labels
  loading?: string;             // 加载态文案 · loading placeholder text
}>();

const el = ref<HTMLElement | null>(null);
const ready = ref(false);
const failed = ref(false);
// 引擎句柄（只用到这几个方法，不做完整类型约束）· engine handle (only these methods are used)
let engine: { unmount?: () => void; pause?: () => void; resume?: () => void; setLang?: (l: any, s: any) => void; focusConcert?: (id: number) => boolean } | null = null;
let io: IntersectionObserver | null = null;
let onVis: (() => void) | null = null;

// 搜索框点结果跳转带来的 ?concert=<id>：引擎就绪后把镜头转到该演唱会并弹卡，消费后清除 query
// ?concert=<id> from the search box: once the engine is ready, fly the camera to that concert,
// show its card, then strip the query.
const route = useRoute();
const router = useRouter();
const { collapse: collapseWelcome } = useWelcomeCard();
function tryFocusFromQuery() {
  const raw = route.query.concert;
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!id || !engine?.focusConcert) return;
  if (engine.focusConcert(id)) {
    collapseWelcome();   // 聚焦某场时自动收起首页欢迎卡，避免遮挡 · collapse the welcome card so it can't cover the popup
    const q = { ...route.query };
    delete (q as Record<string, unknown>).concert;   // 已消费，回写干净 URL · consumed: clean the URL back up
    router.replace({ path: route.path, query: q });
  }
}

// Three.js 改由 npm 包动态 import（锁 0.128，与原 CDN r128 同源）：
// 不再依赖第三方 CDN 脚本（无供应链/可用性风险），引擎仍读全局 window.THREE
// Three.js now comes from the pinned npm package via a dynamic import (same r128 code as the old CDN):
// no third-party script tag (no supply-chain / availability risk); engines still read global window.THREE.
function ensureThree(): Promise<void> {
  const w = window as any;
  if (w.THREE) return Promise.resolve();
  return import('three').then((mod) => { w.THREE = mod; });
}

onMounted(() => {
  ensureThree().then(() => {
    if (!el.value) return;
    try {
      engine = createPlanetTown(el.value, {
        stageInfos: props.stageInfos || [],
        labels: props.labels
      });
      ready.value = true;
      tryFocusFromQuery();   // 若带 ?concert 进入，挂载完即聚焦该演唱会 · honor ?concert=<id> right after mount
      // 不可见即暂停：标签页隐藏或 canvas 滚出视口时停掉 rAF，回来再恢复（省 GPU / 耗电）
      // Pause when hidden: stop rAF while the tab is hidden or the canvas scrolls out of view (saves GPU/battery)
      onVis = () => { if (document.hidden) engine?.pause?.(); else engine?.resume?.(); };
      document.addEventListener('visibilitychange', onVis);
      if (typeof IntersectionObserver !== 'undefined' && el.value) {
        io = new IntersectionObserver(entries => {
          for (const e of entries) { if (e.isIntersecting) engine?.resume?.(); else engine?.pause?.(); }
        }, { threshold: 0 });
        io.observe(el.value);
      }
    } catch { failed.value = true; }
  }, () => { failed.value = true; });
});

// 卸载：断开观察器/监听，再让引擎自行清理 DOM 与全局绑定
// Teardown: disconnect observers/listeners, then let the engine clean up its DOM and global bindings
onBeforeUnmount(() => {
  io?.disconnect(); io = null;
  if (onVis) { document.removeEventListener('visibilitychange', onVis); onVis = null; }
  try { engine?.unmount?.(); } catch { /* ignore */ }
  engine = null;
});

// 语言切换：页面实例被复用（不重挂载），把新的文案/数据直接推给引擎刷新信息卡，避免重建整个场景
// Language switch: the page instance is reused (no remount); push new labels/data into the engine
// to refresh cards instead of rebuilding the whole scene.
watch([() => props.labels, () => props.stageInfos], () => {
  engine?.setLang?.(props.labels, props.stageInfos);
});

// 已在星球页时点搜索结果：query 变化即聚焦（不重挂载）
// Already on the planet page when a result is picked: focus on query change (no remount).
watch(() => route.query.concert, () => tryFocusFromQuery());
</script>

<template>
  <div ref="el" class="canvas-shell">
    <div v-if="!ready" class="canvas-loading">
      {{ failed ? '' : (loading || 'Loading…') }}
    </div>
  </div>
</template>
