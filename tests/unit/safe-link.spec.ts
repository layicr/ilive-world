import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  esc, URL_ALLOW, safeUrl, pickBvid, videoEmbedUrl, videoPageUrl
} from '../../app/three/concert/safeLink';

// safeLink 单元 / 安全测试：卡片·弹窗共用的 HTML 转义 + 外链白名单 + 视频地址拼接
// 这些纯函数是本次从拆分前的单文件 concert 抽出的安全边界，直接决定 XSS / 开放重定向 /
// 恶意嵌入是否成立，故单独覆盖。safeUrl 读 window.location.origin，而 vitest 跑在
// node 环境（environment:'node'，无 window），这里装一个最小 window 桩，测后还原。
// Unit / security tests for safeLink: the escaping + external-link allowlist + video URL builders
// extracted from the pre-split single concert file during the module split. They are the security boundary for XSS /
// open-redirect / malicious embeds, so they get dedicated coverage. safeUrl reads
// window.location.origin; vitest runs in a node environment (no window), so a minimal stub is
// installed here and restored afterwards.
const ORIGIN = 'https://iliveworld.lyc.la';
const realGlobal = globalThis as any;
let hadWindow: boolean;

beforeAll(() => {
  hadWindow = 'window' in realGlobal;
  realGlobal.window = { location: { origin: ORIGIN } };
});
afterAll(() => {
  if (hadWindow) realGlobal.window = (realGlobal as any).__origWindow;
  else delete realGlobal.window;
});

describe('esc —— HTML 转义（防 XSS）· HTML escaping (XSS defense)', () => {
  it('转义全部危险字符 & < > " \'', () => {
    expect(esc('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('中和脚本注入：尖括号不再构成标签', () => {
    expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('对已是实体的文本再次转义（& 永远被转，杜绝双重解码）· re-escaping an entity always turns & ', () => {
    expect(esc('&amp;')).toBe('&amp;amp;');
  });

  it('非字符串入参先 String() 化 · non-strings are coerced via String()', () => {
    expect(esc(123)).toBe('123');
    expect(esc(null)).toBe('null');
  });
});

describe('URL_ALLOW —— 外链白名单常量 · external-link allowlist', () => {
  it('仅收录既定三域，不含通配 / 空项 · only the three known hosts, no wildcard / blank entry', () => {
    expect(URL_ALLOW).toEqual(['bilibili.com', '163.com', 'iliveworld.lyc.la']);
    expect(URL_ALLOW.every(d => /^[a-z0-9.-]+$/i.test(d) && !d.includes('*'))).toBeTruthy();
  });
});

describe('safeUrl —— 协议 + 主机白名单校验（防开放重定向 / 恶意嵌入）· scheme + host allowlist', () => {
  it('放行白名单内的精确主机与任意子域 · allow exact hosts and any subdomain', () => {
    expect(safeUrl('https://www.bilibili.com/video/BV1xx411c7mD')).toBe('https://www.bilibili.com/video/BV1xx411c7mD');
    expect(safeUrl('https://music.163.com/#/song?id=1')).toContain('music.163.com');
    expect(safeUrl('https://iliveworld.lyc.la/about')).toBe('https://iliveworld.lyc.la/about');
    expect(safeUrl('http://bilibili.com/')).toContain('bilibili.com');
  });

  it('拒绝非白名单主机 · reject hosts off the allowlist', () => {
    expect(safeUrl('https://evil.com/')).toBe('');
    expect(safeUrl('https://google.com/search?q=bilibili.com')).toBe('');   // 仅路径/查询命中不算命中 · a match only in path/query does not count
  });

  it('拒绝后缀伪装主机（bilibili.com.evil.com / evilbilibili.com）· reject suffix/prefix spoofing', () => {
    expect(safeUrl('https://bilibili.com.evil.com/')).toBe('');
    expect(safeUrl('https://notbilibili.com/')).toBe('');
  });

  it('拒绝 javascript: / data: / file: 等危险伪协议 · reject dangerous pseudo-protocols', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(safeUrl('file:///etc/passwd')).toBe('');
  });

  it('拒绝协议相对地址（//evil.com）· reject protocol-relative URLs', () => {
    expect(safeUrl('//evil.com/x')).toBe('');
  });

  it('站内相对地址按当前 origin 解析并放行 · same-origin relative URLs resolve against origin', () => {
    expect(safeUrl('/api/concerts')).toBe(`${ORIGIN}/api/concerts`);
  });

  it('残缺 / 非法地址安全兜底为空串 · malformed or invalid URLs safely yield empty string', () => {
    expect(safeUrl('http://')).toBe('');      // special scheme 无主机 → new URL 抛错 → 捕获回空 · scheme without a host throws
    expect(safeUrl('https://')).toBe('');
  });
});

describe('pickBvid —— 从任意存储值提取 BV 号 · extract the BV id from any stored value', () => {
  it('裸 BV 号 / watch 链接均可提取 · bare id and watch link both work', () => {
    expect(pickBvid('BV1xx411c7mD')).toBe('BV1xx411c7mD');
    expect(pickBvid('https://www.bilibili.com/video/BV1xx411c7mD?p=1')).toBe('BV1xx411c7mD');
  });

  it('大小写不敏感且区分边界（BV 前缀）· case-insensitive on the BV prefix', () => {
    expect(pickBvid('bv1Ab23cD')).toBe('bv1Ab23cD');
  });

  it('无 BV 号返回空串 · returns empty string when absent', () => {
    expect(pickBvid('https://music.163.com/x')).toBe('');
    expect(pickBvid('')).toBe('');
    expect(pickBvid(undefined)).toBe('');
  });
});

describe('videoEmbedUrl / videoPageUrl —— 视频地址拼接 · video URL builders', () => {
  it('BV 号（正序或回退到 alt 字段）拼出播放器 / 观看页地址 · BV id (or its alt fallback) builds player / watch URLs', () => {
    expect(videoEmbedUrl('BV1xx411c7mD', '')).toBe('https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&autoplay=1');
    expect(videoEmbedUrl('', 'BV1alt99z0yX')).toBe('https://player.bilibili.com/player.html?bvid=BV1alt99z0yX&autoplay=1');
    expect(videoPageUrl('BV1xx411c7mD', '')).toBe('https://www.bilibili.com/video/BV1xx411c7mD');
    expect(videoPageUrl('', 'BV1alt99z0yX')).toBe('https://www.bilibili.com/video/BV1alt99z0yX');
  });

  it('非 BV（其它平台完整链接）原样透传并 trim · non-BV (full URL elsewhere) passes through trimmed', () => {
    expect(videoEmbedUrl('  https://example.com/watch/123  ', '')).toBe('https://example.com/watch/123');
    expect(videoPageUrl('https://example.com/watch/123', 'no-id-here')).toBe('https://example.com/watch/123');
  });

  it('两者皆空返回空串 · both empty yields empty string', () => {
    expect(videoEmbedUrl('', '')).toBe('');
    expect(videoPageUrl(undefined, undefined)).toBe('');
  });
});
