import { describe, it, expect } from 'vitest';
import { parseI18n } from '../../server/utils/i18n-field';

describe('parseI18n', () => {
  const json = JSON.stringify({ 'zh-CN': '演唱会', en: 'Concert', 'zh-Hant': '演唱會' });

  it('命中当前 locale', () => {
    expect(parseI18n(json, 'en')).toBe('Concert');
    expect(parseI18n(json, 'zh-Hant')).toBe('演唱會');
  });

  it('缺失 locale 回退 zh-CN', () => {
    expect(parseI18n(json, 'fr')).toBe('演唱会');
  });

  it('无 zh-CN 时回退任意非空值', () => {
    const onlyEn = JSON.stringify({ en: 'Only EN' });
    expect(parseI18n(onlyEn, 'zh-Hant')).toBe('Only EN');
  });

  it('跳过空字符串，选取后面的非空值', () => {
    const withEmpty = JSON.stringify({ 'zh-CN': '', en: 'EN value' });
    expect(parseI18n(withEmpty, 'zh-Hant')).toBe('EN value');
  });

  it('非 JSON 原文返回（如价格）', () => {
    expect(parseI18n('¥ 380', 'en')).toBe('¥ 380');
  });

  it('null / 空值返回空串', () => {
    expect(parseI18n(null, 'zh-CN')).toBe('');
    expect(parseI18n(undefined, 'en')).toBe('');
    expect(parseI18n(JSON.stringify({ en: '  ' }), 'fr')).toBe('');
  });
});
