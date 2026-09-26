// 演唱会列表（/api/concerts），随当前 locale 取多语言文案；首页据此注入 3D 引擎的信息卡数据。
// Concert list from /api/concerts, localized to the current locale; feeds the 3D engine's card data.
import type { ConcertCard } from '#shared/types/concert';

export type { ConcertCard };

// 首页是预渲染的：构建时把 /api/concerts 结果烘进静态 payload（likes 是快照、liked 全 false）。
// hydration 完成后、首屏就绪时全局补刷一次，拿到实时计数与当前访客的点赞态；
// 不用 getCachedData 跳过 payload：那会让首屏短暂空数据，3D 场景要重建舞台。
// The homepage is prerendered: build-time payload holds stale likes and liked=false for everyone.
// After hydration we refresh once so visitors see live counts and their own like state.
// We do NOT skip the payload via getCachedData: that would flash an empty first paint and force the
// 3D scene to rebuild every stage.
let staleRefreshScheduled = false;

export function useConcerts() {
  const { locale } = useI18n();
  const res = useFetch<ConcertCard[]>('/api/concerts', {
    query: { locale },
    key: 'concerts',
    default: () => []
  });
  if (import.meta.client && !staleRefreshScheduled) {
    staleRefreshScheduled = true;
    // 多组件共用本 composable，模块级标记保证整页只刷一次；onNuxtReady 避免阻塞 hydration
    // Shared by several components; the module flag keeps it to one refresh per page, and
    // onNuxtReady defers it so hydration is never blocked.
    onNuxtReady(() => { void res.refresh(); });
  }
  return res;
}
