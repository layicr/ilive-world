import { test, expect } from '@playwright/test';

// 首页即星球小镇 & i18n 前缀路由（全部走 SSR，可离线断言）
// Home is the planet town & i18n prefixed routes (all SSR, assertable offline)
test.describe('首页星球 & 多语言路由', () => {
  test('/ 渲染中文星球首页（头部含艺人搜索框）', async ({ page }) => {
    await page.goto('/');
    // 一打开即见星球：SSR 输出画布 loading 兑底 · planet shows on open: SSR emits the canvas loading fallback
    await expect(page.locator('.canvas-loading')).toContainText('正在点亮星球');
    // 导航中存在艺人搜索框 · an artist search box exists in the nav
    await expect(page.locator('.artist-search .as-input')).toBeVisible();
    await expect(page.locator('header')).toBeVisible();
  });

  test('/en/ 前缀生效并显示英文星球首页', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('.canvas-loading')).toContainText('Lighting up the planet');
    await expect(page).toHaveURL(/\/en\/?$/);
  });

  test('/zh-Hant/ 前缀生效并显示繁体星球首页', async ({ page }) => {
    await page.goto('/zh-Hant/');
    await expect(page.locator('.canvas-loading')).toContainText('正在點亮星球');
  });

  test('语言切换器可切换到英文', async ({ page }) => {
    // 并行跑时 3D 引擎主线程初始化会拖慢客户端路由跳转，给足超时避免偶发假阴
    // Under parallel load the WebGL engine's main-thread init delays the client-side route nav; give it room to avoid flaky false-negatives.
    test.setTimeout(60000);
    await page.goto('/');
    // 等 Vue 水合完成，确保下拉按钮的 @click 已绑定 · wait for Vue hydration so the dropdown's @click is bound
    await page.waitForFunction(() => !!(document.getElementById('__nuxt') as any)?.__vue_app__);
    await page.locator('.locale-btn').click();
    await expect(page.locator('.locale-menu')).toBeVisible();
    // waitForURL 按导航超时重试，比轮询的 toHaveURL 更稳 · waitForURL retries on the navigation timeout, steadier than polling toHaveURL
    await Promise.all([
      page.waitForURL(/\/en\/?$/, { timeout: 30000 }),
      page.getByRole('link', { name: 'English' }).click()
    ]);
  });
});
