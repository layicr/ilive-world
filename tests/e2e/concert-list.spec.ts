import { test, expect } from '@playwright/test';

/* =====================================================================
 * concert-list.spec.ts —— 右侧演唱会列表浮层（初始 3 条 + 伸缩）
 * 覆盖：默认收起仅 3 条、计数胶囊 3 / 总数、展开显全部、可再收起、主题摘要不超 35 字、
 * 全列表按日期倒序（最近在前）、最小化飘出黄金云并可点云恢复。
 * Covers: collapsed to 3 rows by default, "3 / total" count pill, expand shows all,
 * collapse again, theme excerpts never exceed 35 chars, the full list is date-descending,
 * and minimize releases a golden cloud that restores the panel on click.
 * ===================================================================== */
test.describe('右侧演唱会列表 · right-side concert list', () => {
  test('初始 3 条，可展开可收起 · starts with 3 rows, expands and collapses', async ({ page }) => {
    test.setTimeout(90000);   // dev 首屏要懒编译整个 three 引擎，留足时间 · dev first paint lazy-compiles the whole three engine
    await page.goto('/', { waitUntil: 'load', timeout: 60000 });
    // 伸缩依赖 Vue 水合完成（dev 首次访问时引擎懒编译会显著拖慢水合）
    // Toggling requires hydration; on first dev visit the lazy three.js compile delays it a lot
    await page.waitForFunction(() => !!(document.getElementById('__nuxt') as any)?.__vue_app__);
    const panel = page.locator('.concert-list');
    await expect(panel).toBeVisible({ timeout: 30000 });

    // 收起态：恰好 3 条，计数胶囊显示 3 / 总数 · collapsed: exactly 3 rows with a "3 / total" pill
    const rows = panel.locator('.cl-items li');          // 每个 li 解析一次，链式计数须用 li · resolve per li for chained counts
    const items = panel.locator('.cl-item');
    await expect(rows).toHaveCount(3);
    await expect(panel.locator('.cl-count')).toHaveText(/^3 \/ \d+$/);

    // 每条含时间（YYYY-MM-DD）、艺人、主题摘要；摘要超 35 字必带省略号
    // Each row carries time (YYYY-MM-DD), artist and a theme excerpt; >35 chars must end with …
    const first = await items.first().innerText();
    expect(first).toMatch(/\d{4}-\d{2}-\d{2}/);
    for (const text of await panel.locator('.cl-theme').allInnerTexts()) {
      const v = text.trim();
      expect(v.length).toBeLessThanOrEqual(36);   // 35 字 + 省略号 · 35 chars + ellipsis
      if (v.length === 36) expect(v.endsWith('…')).toBeTruthy();
    }

    // 展开：条数超过 3（数据 >3 场），计数胶囊同步 · expand: more than 3 rows, pill in sync
    const toggle = panel.locator('.cl-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false', { timeout: 30000 });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 30000 });
    const expandedCount = await rows.count();
    expect(expandedCount).toBeGreaterThan(3);
    await expect(panel.locator('.cl-count')).toHaveText(`${expandedCount} / ${expandedCount}`);

    // 排序：展开后全列表日期倒序（YYYY-MM-DD 字典序即时间序）
    // Ordering: with everything visible, dates must be descending (ISO dates sort lexically)
    const dates = (await panel.locator('.cl-meta').allInnerTexts())
      .map((s) => (s.trim().match(/\d{4}-\d{2}-\d{2}/) ?? [''])[0]);
    expect(dates).toHaveLength(expandedCount);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);

    // 收起：回到 3 条 · collapse: back to 3 rows
    await toggle.click();
    await expect(rows).toHaveCount(3);
  });

  test('最小化飘出黄金云，点云恢复列表 · minimize releases a golden cloud; clicking it restores the panel', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => !!(document.getElementById('__nuxt') as any)?.__vue_app__);
    const panel = page.locator('.concert-list');
    // 面板依赖 useConcerts 异步返回（total>0 才渲染），dev/Turso 偏慢时给宽裕超时
    // The panel renders only once useConcerts resolves (total>0); allow generous time on slow dev/Turso
    await expect(panel).toBeVisible({ timeout: 30000 });
    // 点右上角最小化：面板隐去、黄金云浮现 · click minimize: panel gone, golden cloud appears
    await panel.locator('.cl-min').click();
    await expect(panel).toHaveCount(0);
    const cloud = page.locator('.golden-cloud');
    await expect(cloud).toBeVisible();

    // 点黄金云：列表回来、云隐去 · click the cloud: panel returns, cloud vanishes
    // force 跳过持续漂移动画的“稳定性”等待 · force skips the stability wait for the drifting animation
    await cloud.click({ force: true });
    await expect(panel).toBeVisible();
    await expect(cloud).toHaveCount(0);
  });

  test('黄金云由 6 颗团泡组成（不对称蓬松轮廓）· the golden cloud is built from 6 puffs (asymmetric fluffy silhouette)', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => !!(document.getElementById('__nuxt') as any)?.__vue_app__);
    const panel = page.locator('.concert-list');
    await expect(panel).toBeVisible({ timeout: 30000 });
    await panel.locator('.cl-min').click();
    const cloud = page.locator('.golden-cloud');
    await expect(cloud).toBeVisible();
    // 主团(1) + 右侧大团(2) 在前，左侧团(3)/左尾泡(4)/两个顶部鼓包(5,6) 在其后（z-index:-1）
    // main(1) + right(2) in front; left(3) / tail(4) / two top bumps(5,6) behind
    await expect(cloud.locator('.gc-puff')).toHaveCount(6);
    await expect(cloud.locator('.gc-puff-1, .gc-puff-2')).toHaveCount(2);
    await expect(cloud.locator('.gc-puff-3, .gc-puff-4, .gc-puff-5, .gc-puff-6')).toHaveCount(4);
  });
});
