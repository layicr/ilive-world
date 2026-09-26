import { test, expect } from '@playwright/test';

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;

test.describe('/api/concerts', () => {
  // 条数随线上内容浮动（演唱会由运营在库中维护），故只断言接口契约 + 语言选择是否生效，
  // 不锁死绝对条数；“名称”常保留原文（可能拉丁文），改用一定被本地化的“国家/城市”验证 locale。
  // The row count tracks live operator-managed content, so assert the endpoint contract and that
  // locale selection works rather than a hard-coded count; concert "name" is often kept in its
  // original (sometimes Latin) form, so verify i18n via "country", which is always localized.
  test('locale=en 结构合法且本地化字段为英文', async ({ request }) => {
    const res = await request.get('/api/concerts?locale=en');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);
    const first = data[0];
    expect(first.id).toBeTruthy();
    expect(first.name && first.name.length).toBeGreaterThan(0);
    expect(typeof first.likes).toBe('number');
    expect(Array.isArray(first.songs)).toBeTruthy();
    expect(CJK.test(String(first.country ?? ''))).toBeFalsy();   // 英文下“国家”无中日韩字 · English country has no CJK
  });

  test('locale=zh-CN 本地化字段为中文', async ({ request }) => {
    const data = await (await request.get('/api/concerts?locale=zh-CN')).json();
    expect(data.length).toBeGreaterThan(0);
    expect(CJK.test(String(data[0].country))).toBeTruthy();        // 中文下“国家”含中日韩字 · Chinese country contains CJK
  });
});

test.describe('/ 星球 3D 运行时', () => {
  test('WebGL 画布挂载并渲染出 canvas', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    // three npm 包动态 import + 引擎 mount 后向 .canvas-shell 注入 <canvas>
    // After the three npm package is dynamically imported and the engine mounts, a canvas is injected into .canvas-shell
    const canvas = page.locator('.canvas-shell canvas');
    await expect(canvas).toBeVisible({ timeout: 45000 });
    // 画布具备实际尺寸 · the canvas has a real size
    const box = await canvas.boundingBox();
    expect(box && box.width).toBeGreaterThan(50);
  });

  test('点击舞台弹出信息卡（数据来自 /api/concerts），可点赞', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    const canvas = page.locator('.canvas-shell canvas');
    await expect(canvas).toBeVisible({ timeout: 45000 });
    const box = (await canvas.boundingBox())!;

    // 扫描网格寻找可命中的舞台（点击命中即弹出 .concert-card.show；悬浮不再弹卡）
    // Sweep a grid to find a hittable stage (a hit pops .concert-card.show; hover no longer opens the card)
    const card = page.locator('.concert-card.show');
    let found = false;
    outer: for (let gy = 0.25; gy <= 0.8; gy += 0.08) {
      for (let gx = 0.15; gx <= 0.85; gx += 0.06) {
        const px = box.x + box.width * gx, py = box.y + box.height * gy;
        await page.mouse.click(px, py);
        await page.waitForTimeout(80);
        if (await card.isVisible().catch(() => false)) { found = true; break outer; }
      }
    }
    expect(found, '未能在画布上点击到任何舞台信息卡').toBeTruthy();

    // 卡片标题非空（演唱会名称来自 DB）· card title is non-empty (concert name comes from the DB)
    await expect(card.locator('.cc-title')).not.toBeEmpty();

    // 点赞：卡内 DB 来源演唱会展示点赞按钮，点击后应切换为已赞态
    // Like: DB-backed cards show a like button; clicking should toggle it to the liked state
    const like = card.locator('.cc-like');
    if (await like.isVisible().catch(() => false)) {
      const before = (await like.textContent()) || '';
      await like.click();
      await page.waitForTimeout(600);
      const after = (await like.textContent()) || '';
      expect(after).not.toBe(before);
    }
  });

  test('轮播标签可见；点击 × 可收起信息卡（UI/UE）· marquee shows; the × button collapses the card', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    const canvas = page.locator('.canvas-shell canvas');
    await expect(canvas).toBeVisible({ timeout: 45000 });

    // 回归守卫：轮播标签文案取自已修复的 card 字符串（曾因 i18n 编译 AST 抛错而不渲染）
    // Regression guard: the marquee copy comes from the now-fixed card strings (it used to throw
    // on i18n's compiled AST and never rendered).
    await expect(page.locator('.stage-marquee')).toBeVisible({ timeout: 10000 });

    // 扫描到一张弹出的信息卡 · sweep until a card pops
    const box = (await canvas.boundingBox())!;
    const card = page.locator('.concert-card.show');
    let found = false;
    outer: for (let gy = 0.25; gy <= 0.8; gy += 0.08) {
      for (let gx = 0.15; gx <= 0.85; gx += 0.06) {
        await page.mouse.click(box.x + box.width * gx, box.y + box.height * gy);
        await page.waitForTimeout(80);
        if (await card.isVisible().catch(() => false)) { found = true; break outer; }
      }
    }
    expect(found, '未能点击到任何舞台信息卡').toBeTruthy();

    // UE：卡片自带 × 关闭按钮，点击后移除 .show（hitTest 之外另一条可靠的收起路径）
    // UE: the card ships a × close button; clicking it removes .show (a reliable collapse path
    // independent of pixel hit-testing).
    await card.locator('.cc-close').click();
    await expect(card).toHaveCount(0);
  });
});
