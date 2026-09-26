// @ts-nocheck
/* =====================================================================
 * modal.ts —— 轻量弹窗（完整歌单 / 内嵌视频）的 DOM 与开合逻辑
 * 由拆分前的单文件 concert 逐段搬移而来，逻辑未变。L 为卡片文案对象引用：
 * setLang 用 Object.assign 原地突变，故所有读取都发生在调用时刻。
 * modal.ts — DOM and open/close logic of the lightweight modal (full setlist / embedded video).
 * Moved verbatim from the pre-split single concert file; logic unchanged. L is the shared card-copy object reference:
 * setLang mutates it in place via Object.assign, so every read happens at call time.
 * ===================================================================== */
export function createModal({ L }) {
  const modal = document.createElement('div');
  modal.className = 'cc-modal';
  modal.innerHTML = '<div class="cc-modal-box"><span class="cc-modal-max" role="button" aria-label="maximize">⤢</span><span class="cc-modal-close" role="button" aria-label="close">×</span><div class="cc-modal-title"></div><div class="cc-modal-body"></div></div>';
  document.body.appendChild(modal);
  const modalTitle = modal.querySelector('.cc-modal-title');
  const modalBody = modal.querySelector('.cc-modal-body');
  function openModal(title, bodyHtml) {
    modalTitle.textContent = title || '';
    modalBody.innerHTML = bodyHtml;
    const box = modal.querySelector('.cc-modal-box');
    box.classList.remove('maximized');
    syncMaxBtn(box);
    modal.classList.add('show');
  }
  function closeModal() {
    modal.classList.remove('show');
    modalBody.innerHTML = '';   // 关闭即销毁 iframe，停止播放 · destroy the iframe on close to stop playback
  }
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });   // 点遮罩关闭 · click the backdrop to close
  modal.addEventListener('pointerdown', e => e.stopPropagation());
  modal.addEventListener('pointerup', e => e.stopPropagation());
  modal.querySelector('.cc-modal-close').addEventListener('click', e => { e.stopPropagation(); closeModal(); });
  // 最大化/还原：切换弹窗尺寸（视频与长歌单均可用）；syncMaxBtn 为函数声明，openModal 可前向调用
  // Maximize/restore: toggle modal size (works for video and long setlists); syncMaxBtn is a hoisted function declaration so openModal can call it ahead
  function syncMaxBtn(box) {
    const btn = modal.querySelector('.cc-modal-max');
    if (!btn) return;
    const on = box.classList.contains('maximized');
    btn.textContent = on ? '⤡' : '⤢';
    btn.setAttribute('aria-label', on ? L.restore : L.maximize);
    btn.title = on ? L.restore : L.maximize;
  }
  modal.querySelector('.cc-modal-max').addEventListener('click', e => {
    e.stopPropagation();
    const box = modal.querySelector('.cc-modal-box');
    box.classList.toggle('maximized');
    syncMaxBtn(box);
  });

  function dispose() {
    if (modal.parentNode) modal.parentNode.removeChild(modal);
  }

  return { el: modal, modalBody, openModal, closeModal, dispose };
}
