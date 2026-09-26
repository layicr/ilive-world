import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function load(f: string) {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'i18n/locales', f), 'utf8'));
}
function keyPaths(obj: any, prefix = ''): string[] {
  const out: string[] = [];
  for (const k of Object.keys(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...keyPaths(v, p));
    else out.push(p);
  }
  return out.sort();
}

describe('i18n locale 文件 key 一致性', () => {
  const zh = load('zh-CN.json');
  const en = load('en.json');
  const hant = load('zh-Hant.json');
  const zhKeys = keyPaths(zh);

  it('zh / en / zh-Hant 的 key 集合完全一致', () => {
    expect(keyPaths(en)).toEqual(zhKeys);
    expect(keyPaths(hant)).toEqual(zhKeys);
  });

  it('无空字符串文案', () => {
    for (const [name, obj] of [['zh', zh], ['en', en], ['zh-Hant', hant]] as const) {
      for (const p of keyPaths(obj)) {
        const val = p.split('.').reduce((o: any, k) => (Array.isArray(o) ? o[Number(k)] : o[k]), obj);
        expect(typeof val === 'string' ? val.trim().length > 0 : true, `${name}:${p} 为空`).toBeTruthy();
      }
    }
  });
});
