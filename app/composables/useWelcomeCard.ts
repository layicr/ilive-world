// 首页欢迎卡的显示状态（客户端共享，基于 useState，SSR 每请求独立、无跨请求泄漏）。
// 供 WelcomeCard 读取显隐，PlanetCanvas 在搜索聚焦某场演唱会时调用 collapse() 自动收起。
// Shared visibility state of the homepage welcome card (useState-based; per-request on SSR, no leaks).
// WelcomeCard reads it; PlanetCanvas calls collapse() when a search result focuses a concert.
export function useWelcomeCard() {
  const visible = useState<boolean>('welcome-card-visible', () => true);
  function collapse() { visible.value = false; }   // 收起欢迎卡 · collapse the card
  return { visible, collapse };
}
