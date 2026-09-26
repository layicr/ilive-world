// @ts-nocheck
/* =====================================================================
 * hitTest.ts —— 命中检测：射线拾取舞台 + 点击弹卡（区分拖拽）+ 悬浮光标
 * 由拆分前的单文件 concert 逐段搬移而来，逻辑未变。与卡片的交互全部经由 card 门面
 * （isShownFor / hide / showFor），点击判定 6px / 600ms 原样保留。
 * hitTest.ts — hit testing: stage raycasting + click-to-card (drag-aware) + hover cursor.
 * Moved verbatim from the pre-split single concert file; logic unchanged. All card interaction goes through the card facade
 * (isShownFor / hide / showFor); the 6px / 600ms click test is preserved as-is.
 * ===================================================================== */
export function createHitTest({ D, THREE, dom, camera, stages, pickTargets, card }) {
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  function setNDC(e) {
    const rect = dom.getBoundingClientRect();
    pointerNDC.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1));
  }
  function inCanvas(e) {
    const rect = dom.getBoundingClientRect();
    return e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  }
  function pickStage(e) {
    setNDC(e);
    raycaster.setFromCamera(pointerNDC, camera);
    // 只对 30 个不可见代理盒求交（非递归），避免遍历整台上千个 mesh
    // Intersect only the ~30 invisible proxy boxes (non-recursive), avoiding a traversal of thousands of meshes per stage
    const hits = raycaster.intersectObjects(pickTargets, false);
    if (!hits.length) return null;
    return stages[hits[0].object.userData.stageIdx];
  }

  // 点击（位移<6px 且时长<600ms 视为点击）· Click (treated as a click when movement < 6px and duration < 600ms)
  let ccDownX = 0, ccDownY = 0, ccDownT = 0;
  const onDown = e => { ccDownX = e.clientX; ccDownY = e.clientY; ccDownT = performance.now(); };
  const onUp = e => {
    if (!inCanvas(e)) return;
    if (Math.hypot(e.clientX - ccDownX, e.clientY - ccDownY) > 6 || performance.now() - ccDownT > 600) return;
    const st = pickStage(e);
    if (!st) { card.hide(); return; }
    const idx = st.g.userData.stageIdx;
    if (card.isShownFor(idx)) {   // 再次点击同一舞台 → 收起 · clicking the same stage again → collapse
      card.hide(); return;
    }
    card.showFor(st, e.clientX, e.clientY);
  };
  dom.addEventListener('pointerdown', onDown);
  document.addEventListener('pointerup', onUp);

  // 悬浮：鼠标移动不再弹出信息卡（改为仅点击弹出），这里只用于把可点击舞台的光标变成 pointer
  // Hover: pointer move no longer pops the card (now click-only); here it only turns the cursor to pointer over clickable stages
  let hoverDirty = false, hoverEvt = null;
  const onMove = e => { hoverEvt = e; hoverDirty = true; };
  function processHover() {
    const e = hoverEvt;
    if (D.isDragging() || !inCanvas(e)) { dom.style.cursor = ''; return; }
    dom.style.cursor = pickStage(e) ? 'pointer' : '';
  }
  document.addEventListener('pointermove', onMove);

  function tickHover() {
    if (hoverDirty) { hoverDirty = false; processHover(); }   // 悬浮检测降频到帧节拍 · throttle hover picking to the frame cadence
  }

  function dispose() {
    dom.removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointermove', onMove);
  }

  return { tickHover, dispose };
}
