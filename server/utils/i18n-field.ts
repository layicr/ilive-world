/**
 * 解析 `*_i18n` 列（TEXT 存 JSON `{"zh-CN":..,"en":..,"zh-Hant":..}`）。
 * 回退顺序：当前 locale → zh-CN → 任意非空值。
 * 非 JSON 字符串（如价格原文）原样返回。
 *
 * Parse a `*_i18n` column (TEXT holding a locale-keyed JSON object).
 * Fallback order: requested locale → zh-CN → any non-empty value.
 * Non-JSON strings (e.g. a raw price) are returned as-is.
 */
export function parseI18n(value: unknown, locale: string): string {
  if (value == null) return '';
  let obj: Record<string, unknown>;
  if (typeof value === 'object') {
    obj = value as Record<string, unknown>;
  } else {
    const s = String(value);
    try { obj = JSON.parse(s); } catch { return s; }
  }
  if (!obj || typeof obj !== 'object') return '';
  for (const key of [locale, 'zh-CN']) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

/**
 * 解析 `concert_tags.i18n` 列：每语言的值可为「字符串」或「字符串数组」，两种均兼容。
 * 回退顺序同 parseI18n：当前 locale → zh-CN → 任意非空值；返回去空白、去空串后的标签数组。
 * 非 JSON 字符串（如整行就是一个标签）原样作为单元素数组返回。
 *
 * Parse `concert_tags.i18n`: each locale value may be a string or an array of strings.
 * Same fallback order as parseI18n; returns trimmed, non-empty tags.
 * A non-JSON string (the whole row being one tag) becomes a single-element array.
 */
export function parseTags(value: unknown, locale: string): string[] {
  if (value == null) return [];
  let obj: Record<string, unknown>;
  if (typeof value === 'object') {
    obj = value as Record<string, unknown>;
  } else {
    const s = String(value);
    try { obj = JSON.parse(s); } catch { return s.trim() ? [s.trim()] : []; }
  }
  if (!obj || typeof obj !== 'object') return [];
  const pick = (v: unknown): string[] => {
    if (typeof v === 'string') return v.trim() ? [v.trim()] : [];
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    return [];
  };
  for (const key of [locale, 'zh-CN']) {
    const r = pick(obj[key]);
    if (r.length) return r;
  }
  for (const key of Object.keys(obj)) {
    const r = pick(obj[key]);
    if (r.length) return r;
  }
  return [];
}
