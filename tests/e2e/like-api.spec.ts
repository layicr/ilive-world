import { test, expect } from '@playwright/test';

// 点赞接口的 HTTP 边界校验（功能 + 安全）：非法 id / 不存在 id / 正常往返。
// 幂等去重与冗余计数逻辑已在 tests/unit/concert-likes.spec.ts 以内存库直测覆盖，这里
// 只验接口层（400/404/权威返回），请求数极少以免占用与 planet.spec 共享的每 IP 限流窗口。
// HTTP-boundary validation of the like endpoint (functional + security): invalid id / missing id /
// a normal round-trip. Idempotent dedup and the denormalized count are already unit-tested against an
// in-memory DB in tests/unit/concert-likes.spec.ts; this only checks the API layer (400/404/authoritative
// response) with a handful of requests so it never eats the per-IP rate-limit budget shared with planet.spec.
test.describe('/api/concerts/:id/like 接口校验', () => {
  let firstId: number;

  test.beforeAll(async ({ request }) => {
    const data = await (await request.get('/api/concerts?locale=zh-CN')).json();
    firstId = data[0].id;
    expect(firstId).toBeTruthy();
  });

  test('id 非法（0 / 非数字）→ 400', async ({ request }) => {
    expect((await request.post('/api/concerts/0/like', { data: { liked: true } })).status()).toBe(400);
    expect((await request.post('/api/concerts/abc/like', { data: { liked: true } })).status()).toBe(400);
  });

  test('id 不存在 → 404（不写入孤立点赞行）', async ({ request }) => {
    expect((await request.post('/api/concerts/99999999/like', { data: { liked: true } })).status()).toBe(404);
  });

  test('正常点赞 → 返回权威 { id, likes, liked }，取消后回落一场', async ({ request }) => {
    const on = await (await request.post(`/api/concerts/${firstId}/like`, { data: { liked: true } })).json();
    expect(on.id).toBe(firstId);
    expect(on.liked).toBe(true);
    expect(typeof on.likes).toBe('number');

    const off = await (await request.post(`/api/concerts/${firstId}/like`, { data: { liked: false } })).json();
    expect(off.liked).toBe(false);
    // 相对上一步恰好回落 1（单测试客户端 IP 稳定，UNIQUE 去重生效）· exactly one lower than the like step
    expect(off.likes).toBe(on.likes - 1);
  });
});
