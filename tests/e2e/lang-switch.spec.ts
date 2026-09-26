import { test, expect } from '@playwright/test';

/* =====================================================================
 * lang-switch.spec.ts —— 语言切换时就地刷新已打开的信息卡（回归）
 * 页面实例在切换语言时被复用（引擎不重挂载），setLang 需把已打开的卡片重绘成新语言；
 * 曾因 shownStageIdx 仅在搜索聚焦路径赋值、点击开卡时为 -1 而漏刷（时好时坏的根因）。
 * lang-switch.spec.ts — an already-open card must be repainted on language switch (regression).
 * The page instance is reused across locale changes (engine is not remounted), so setLang has to
 * repaint the open card. This once failed intermittently because shownStageIdx was only set on the
 * search-focus path, leaving it -1 for click-opened cards so the refresh was skipped.
 * ===================================================================== */
const CJK_LABEL = /艺人|时间|场馆|票价/;      // 中文卡片行标签 · Chinese card row labels
const EN_LABEL = /Artist|Time|Venue|Price/;   // 英文卡片行标签 · English card row labels

async function openAnyCard(page: import('@playwright/test').Page) {
  const canvas = page.locator('.canvas-shell canvas');
  await expect(canvas).toBeVisible({ timeout: 45000 });
  const box = (await canvas.boundingBox())!;
  const card = page.locator('.concert-card.show');
  for (let gy = 0.25; gy <= 0.8; gy += 0.08) {
    for (let gx = 0.15; gx <= 0.85; gx += 0.06) {
      await page.mouse.click(box.x + box.width * gx, box.y + box.height * gy);
      await page.waitForTimeout(80);
      if (await card.isVisible().catch(() => false)) return card;
    }
  }
  throw new Error('未能在星球上点开任何信息卡 · failed to open any card by clicking');
}

test('切换语言时就地刷新已打开的信息卡 · repaint an open card on locale switch', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/');
  const card = await openAnyCard(page);

  // 卡片初始为中文（默认 locale zh-CN）· card starts in Chinese (default locale zh-CN)
  const zhRows = await card.locator('.cc-rows').innerText();
  expect(CJK_LABEL.test(zhRows), '初始卡片应为中文标签').toBeTruthy();

  // 客户端切到英文（NuxtLink 路由跳转，复用引擎、不整页 reload）
  // Switch to English via the client-side link (route nav reuses the engine, no full reload)
  await page.waitForFunction(() => !!(document.getElementById('__nuxt') as any)?.__vue_app__);
  await page.locator('.locale-btn').click();
  await expect(page.locator('.locale-menu')).toBeVisible();
  await page.getByRole('link', { name: 'English' }).click();
  await page.waitForURL(/\/en\/?$/, { timeout: 15000 });
  await page.waitForTimeout(2500);   // 等文案 + 数据两帧刷新 · wait for the labels + data refresh

  // 引擎被复用：卡片仍在且已重绘为英文，不残留中文
  // Engine reused: the card is still open and repainted to English, with no Chinese left over
  await expect(card).toBeVisible();
  const enRows = await card.locator('.cc-rows').innerText();
  expect(EN_LABEL.test(enRows), '切换后卡片应为英文标签').toBeTruthy();
  expect(CJK_LABEL.test(enRows), '切换后卡片不应残留中文标签').toBeFalsy();
});
