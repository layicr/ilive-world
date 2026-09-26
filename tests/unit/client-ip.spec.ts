import { describe, it, expect } from 'vitest';
import { getClientIp, resolveClientIp } from '../../server/utils/concertLikes';
import type { H3Event } from 'h3';

// 最小可用假事件：只需要 getRequestHeader / getRequestIP 实际读到的字段
// （context.clientAddress 会被 getRequestIP 优先读取，必须留空；socket.remoteAddress 是最终兜底）
// Minimal fake event: only the fields getRequestHeader / getRequestIP actually read
// (context.clientAddress is preferred by getRequestIP so it must stay empty; socket.remoteAddress is the last fallback)
function makeEvent(headers: Record<string, string>, remoteAddress = '10.0.0.9'): H3Event {
  return {
    context: {},
    node: { req: { headers, socket: { remoteAddress } } }
  } as unknown as H3Event;
}

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try { return fn(); } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe('resolveClientIp（HMAC 哈希）', () => {
  it('空值 / 缺失兜底为 unknown', () => {
    expect(resolveClientIp(null)).toBe('unknown');
    expect(resolveClientIp(undefined)).toBe('unknown');
    expect(resolveClientIp('   ')).toBe('unknown');
  });

  it('正常 IP 输出稳定的 64 位十六进制哈希，不回显明文', () => {
    const hashed = resolveClientIp('203.0.113.7');
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed).toBe(resolveClientIp('203.0.113.7'));      // 同 IP 同键（去重语义不变）
    expect(hashed).not.toBe(resolveClientIp('203.0.113.8'));  // 不同 IP 不同键
    expect(hashed).not.toContain('203.0.113.7');
  });

  it('超长异常头同样被哈希，长度天然有界、不再截断明文', () => {
    expect(resolveClientIp('a'.repeat(100))).toMatch(/^[0-9a-f]{64}$/);
  });

  it('盐值参与哈希：换 NUXT_IP_SALT 后同一 IP 得到不同键', () => {
    const before = withEnv({ NUXT_IP_SALT: 'salt-a' }, () => resolveClientIp('1.2.3.4'));
    const after = withEnv({ NUXT_IP_SALT: 'salt-b' }, () => resolveClientIp('1.2.3.4'));
    expect(before).not.toBe(after);
  });
});

describe('getClientIp 信任链（返回值已哈希，用 resolveClientIp 折算期望值）', () => {
  it('默认（无开关）：只信 socket 对端地址，忽略可伪造的转发头', () => {
    withEnv({ VERCEL: undefined, NUXT_TRUST_PROXY: undefined }, () => {
      const event = makeEvent(
        { 'x-forwarded-for': '1.2.3.4', 'cf-connecting-ip': '5.6.7.8', 'x-real-ip': '9.10.11.12' },
        '10.0.0.9'
      );
      expect(getClientIp(event)).toBe(resolveClientIp('10.0.0.9'));
    });
  });

  it('NUXT_TRUST_PROXY=true：优先取最左 XFF', () => {
    withEnv({ VERCEL: undefined, NUXT_TRUST_PROXY: 'true' }, () => {
      const event = makeEvent({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' });
      expect(getClientIp(event)).toBe(resolveClientIp('203.0.113.7'));
    });
  });

  it('NUXT_TRUST_PROXY=true：无 XFF 时退到 cf-connecting-ip', () => {
    withEnv({ VERCEL: undefined, NUXT_TRUST_PROXY: 'true' }, () => {
      const event = makeEvent({ 'cf-connecting-ip': '198.51.100.23' });
      expect(getClientIp(event)).toBe(resolveClientIp('198.51.100.23'));
    });
  });

  it('NUXT_TRUST_PROXY=true：无 XFF/cf 时退到 x-real-ip', () => {
    withEnv({ VERCEL: undefined, NUXT_TRUST_PROXY: 'true' }, () => {
      const event = makeEvent({ 'x-real-ip': '192.0.2.66' });
      expect(getClientIp(event)).toBe(resolveClientIp('192.0.2.66'));
    });
  });

  it('NUXT_TRUST_PROXY=true 但三个转发头都缺失：仍兜底 socket 地址', () => {
    withEnv({ VERCEL: undefined, NUXT_TRUST_PROXY: 'true' }, () => {
      const event = makeEvent({}, '10.0.0.9');
      expect(getClientIp(event)).toBe(resolveClientIp('10.0.0.9'));
    });
  });

  it('Vercel：优先用平台覆写的 x-vercel-forwarded-for', () => {
    withEnv({ VERCEL: '1' }, () => {
      const event = makeEvent({
        'x-vercel-forwarded-for': '198.51.100.10',
        'x-forwarded-for': '203.0.113.9'
      });
      expect(getClientIp(event)).toBe(resolveClientIp('198.51.100.10'));
    });
  });
});
