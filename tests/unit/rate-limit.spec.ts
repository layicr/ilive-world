import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkRateLimit, __resetRateLimit, envInt } from '../../server/utils/rateLimit';

describe('checkRateLimit 固定窗口限流', () => {
  beforeEach(() => __resetRateLimit());

  it('窗口内未超上限放行，超限拒绝并给出 Retry-After', () => {
    const opt = { key: 'like', id: '1.1.1.1', max: 3, windowMs: 60_000 };
    expect(checkRateLimit(opt)).toMatchObject({ ok: true, remaining: 2 });
    expect(checkRateLimit(opt).ok).toBe(true);   // 第 2 次 · 2nd call
    expect(checkRateLimit(opt).ok).toBe(true);   // 第 3 次 = 上限 · 3rd call = at the cap
    const blocked = checkRateLimit(opt);          // 第 4 次超 · 4th exceeds
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it('不同 key / 不同 IP 各自独立计数', () => {
    const base = { max: 1, windowMs: 60_000 };
    expect(checkRateLimit({ ...base, key: 'like', id: 'a' }).ok).toBe(true);
    expect(checkRateLimit({ ...base, key: 'like', id: 'a' }).ok).toBe(false); // 同 IP 超 · same IP exceeds
    expect(checkRateLimit({ ...base, key: 'like', id: 'b' }).ok).toBe(true);  // 另一 IP 不受影响 · another IP is unaffected
    expect(checkRateLimit({ ...base, key: 'other', id: 'a' }).ok).toBe(true); // 另一维度不受影响 · another dimension is unaffected
  });

  it('窗口过期后重置为新窗口', () => {
    // windowMs 极小，等待后应重新放行 · tiny windowMs: after waiting it should allow again
    const opt = { key: 'like', id: '2.2.2.2', max: 1, windowMs: 5 };
    expect(checkRateLimit(opt).ok).toBe(true);
    expect(checkRateLimit(opt).ok).toBe(false);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(checkRateLimit(opt).ok).toBe(true); // 窗口已过 → 重置 · window elapsed -> reset
        resolve();
      }, 10);
    });
  });

  it('max<=0 时首个请求即被拒（计数 1 仍 > 上限）', () => {
    const r = checkRateLimit({ key: 'like', id: '3.3.3.3', max: 0, windowMs: 60_000 });
    expect(r.ok).toBe(false);
  });
});

describe('envInt 环境变量整数解析', () => {
  const NAME = 'TEST_ENV_INT_X';
  afterEach(() => delete process.env[NAME]);

  it('未设置 / 空串 / 非数字均回退默认值', () => {
    delete process.env[NAME];
    expect(envInt(NAME, 30)).toBe(30);
    process.env[NAME] = '   ';
    expect(envInt(NAME, 30)).toBe(30);
    process.env[NAME] = 'abc';
    expect(envInt(NAME, 30)).toBe(30);
  });

  it('0 原样生效（不被默认值吞掉；旧写法 Number(x) || 30 的缺陷）', () => {
    process.env[NAME] = '0';
    expect(envInt(NAME, 30)).toBe(0);
  });

  it('正常正整数字符串解析', () => {
    process.env[NAME] = '120';
    expect(envInt(NAME, 30)).toBe(120);
  });
});
