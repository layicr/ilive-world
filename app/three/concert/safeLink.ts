// @ts-nocheck
/* =====================================================================
 * safeLink.ts —— 卡片/弹窗共用的纯工具：HTML 转义 + 外链安全白名单 + 视频地址拼接
 * 由拆分前的单文件 concert 逐段搬移而来，逻辑未变。
 * safeLink.ts — shared pure helpers for the card/modal: HTML escaping + external-link allowlist + video URL builders.
 * Moved verbatim from the pre-split single concert file; logic unchanged.
 * ===================================================================== */

/** HTML 文本/属性转义 · Escape HTML text/attribute values */
export function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// 外链安全白名单：跳转 / 嵌入只接受 http(s) 且主机在名单内（防开放重定向与恶意嵌入）
// External-link allowlist: navigation / embed accept only http(s) with an allowlisted host (blocks open redirect & malicious embeds)
export const URL_ALLOW = ['bilibili.com', '163.com', 'iliveworld.lyc.la'];
export function safeUrl(u) {
  try {
    const x = new URL(String(u), window.location.origin);
    if (x.protocol !== 'https:' && x.protocol !== 'http:') return '';
    if (!URL_ALLOW.some(d => x.hostname === d || x.hostname.endsWith('.' + d))) return '';
    return x.href;
  } catch { return ''; }
}

// Bilibili 视频：从存储值（可为 bvid / 完整 watch 链接 / player 链接）提取 BV 号；
// “观看视频”弹窗统一用播放器地址，“打开视频”跳转观看页。
// Bilibili video: extract the BV id from the stored value (bvid / full watch link / player link);
// "watch video" modal always uses the player URL, "open video" jumps to the watch page.
export function pickBvid(v) {
  const m = String(v || '').match(/BV[0-9A-Za-z]+/i);
  return m ? m[0] : '';
}
export function videoEmbedUrl(url, alt) {
  const bvid = pickBvid(url) || pickBvid(alt);   // BV 号可能在 videoUrl，也可能在 video 字段 · BV id may live in videoUrl or the video field
  if (bvid) return 'https://player.bilibili.com/player.html?bvid=' + bvid + '&autoplay=1';
  return String(url || '').trim();   // 非 BV（如其它平台完整 URL）原样嵌入 · non-BV (e.g. full URL from other platforms) embedded as-is
}
export function videoPageUrl(url, alt) {
  const bvid = pickBvid(url) || pickBvid(alt);
  if (bvid) return 'https://www.bilibili.com/video/' + bvid;
  return String(url || '').trim();
}
