import { test, expect } from '@playwright/test';

const SITE = 'https://iliveworld.lyc.la';

// SEO 信号：title / canonical / hreflang / og / JSON-LD / robots / sitemap / 404
// SEO signals: title / canonical / hreflang / og / JSON-LD / robots / sitemap / 404
test.describe('SEO meta & 结构化数据', () => {
  test('中文首页 title 来自 site_settings（库），canonical 为绝对 URL', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Layicr演唱会足迹');
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', `${SITE}/`);
  });

  test('英文首页 title 与 canonical 随 locale 变化', async ({ page }) => {
    await page.goto('/en/');
    await expect(page).toHaveTitle('Layicr Concert Journey');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE}/en/`);
  });

  test('繁体首页 title 随 locale 变化', async ({ page }) => {
    await page.goto('/zh-Hant/');
    await expect(page).toHaveTitle('Layicr演唱會足跡');
  });

  test('hreflang alternates 齐全（3 语言 + x-default，绝对 URL）', async ({ page }) => {
    await page.goto('/');
    const alts = page.locator('link[rel="alternate"][hreflang]');
    expect(await alts.count()).toBeGreaterThanOrEqual(4);
    const langs = (await alts.evaluateAll((els) => els.map((e) => e.getAttribute('hreflang')))) as string[];
    expect(langs).toContain('x-default');
    for (const l of ['zh-CN', 'en', 'zh-Hant']) {
      expect(langs.some((h) => h && h.toLowerCase().startsWith(l.split('-')[0]))).toBeTruthy();
    }
    // 全部绝对 · all absolute URLs
    for (const href of await alts.evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
      expect(href).toMatch(/^https?:\/\//);
    }
  });

  test('og:locale 与 og:type / og:image / twitter 标签存在', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', /zh/);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new RegExp(`${SITE}/img/og-image\\.svg`));
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('meta[name="twitter:site"]')).toHaveAttribute('content', '@layicr');
  });

  test('首页 JSON-LD 可解析为 WebSite', async ({ page }) => {
    await page.goto('/');
    const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
    const ld = JSON.parse(raw || '{}');
    expect(ld['@type']).toBe('WebSite');
    expect(Array.isArray(ld.inLanguage)).toBeTruthy();
  });

  test('/robots.txt 可访问且声明 Sitemap', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/Allow: \//);
    expect(text).toContain(`${SITE}/sitemap.xml`);
  });

  test('/sitemap.xml 含 3 个 URL', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect((text.match(/<url>/g) || []).length).toBe(3);
    expect((text.match(/<loc>/g) || []).length).toBe(3);
  });

  test('404 页面返回真实 404 且带 noindex', async ({ request }) => {
    const res = await request.get('/no-such-page-xyz', { headers: { accept: 'text/html' } });
    expect(res.status()).toBe(404);
    const html = await res.text();
    expect(html).toMatch(/name="robots"[^>]*content="[^"]*noindex/i);
  });
});
