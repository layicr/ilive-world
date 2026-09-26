// @ts-nocheck
/* =====================================================================
 * town/orbit.ts —— 相机轨道状态机：拖拽旋转 / 滚轮缩放 / 闲置自动旋转 /
 * 窗口 resize / ?view 调试视角；供 focusConcert 重定向球角。
 * 自 planetTown.ts 逐段搬移，逻辑未变。
 * town/orbit.ts — camera orbit state machine: drag rotate / wheel zoom / idle auto-rotate /
 * window resize / ?view debug angles; exposes angle retargeting for focusConcert.
 * Moved verbatim from planetTown.ts; logic unchanged.
 * ===================================================================== */
export function createOrbit({ THREE, camera, renderer, vw, vh }) {
  /* ================= 相机轨道（拖拽旋转 / 滚轮缩放 / 自动旋转） · Camera orbit (drag rotate / wheel zoom / auto rotate) ================= */
  // 目标点放在村庄中心（球顶偏上），默认俯视角度接近原图构图
  // Target sits at the village center (slightly above the pole); default top-down angle matches the source composition
  const target = new THREE.Vector3(0, 6.5, 0);
  let theta = 0.5, phi = 1.02, radius = 30;
  // 调试视图参数：?view=back 转到背面 / ?view=side 转到侧面（正常打开不受影响）
  // Debug view params: ?view=back turns to the back / ?view=side to the side (normal load unaffected)
  (function () {
    const v = new URLSearchParams(location.search).get('view');
    if (v === 'back') theta += Math.PI;
    else if (v === 'side') theta += Math.PI / 2;
  })();
  let dragging = false, lastX = 0, lastY = 0, lastInteract = -1e9;
  const autoSpeeds = [0.12, 0.32, 0.75];
  let speedIdx = 0, autoOn = true;

  function updateCamera() {
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(target);
  }

  const cv = renderer.domElement;
  cv.style.touchAction = 'none';
  const onCvDown = e => { dragging = true; lastX = e.clientX; lastY = e.clientY; lastInteract = performance.now(); };
  const onWinMove = e => {
    if (!dragging) return;
    theta -= (e.clientX - lastX) * 0.005;
    phi -= (e.clientY - lastY) * 0.004;
    phi = Math.max(0.35, Math.min(2.6, phi));
    lastX = e.clientX; lastY = e.clientY; lastInteract = performance.now();
  };
  const onWinUp = () => { dragging = false; lastInteract = performance.now(); };
  const onWheel = e => {
    e.preventDefault();
    radius = Math.max(14, Math.min(55, radius + e.deltaY * 0.02));
    lastInteract = performance.now();
  };
  const onResize = () => {
    camera.aspect = vw() / vh();
    camera.updateProjectionMatrix();
    renderer.setSize(vw(), vh());
  };
  cv.addEventListener('pointerdown', onCvDown);
  window.addEventListener('pointermove', onWinMove);
  window.addEventListener('pointerup', onWinUp);
  cv.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', onResize);

  /** 每帧推进：闲置 3 秒后自动旋转，然后刷新相机 · Per-frame step: auto-rotate after 3s idle, then refresh the camera */
  function tick(dt) {
    if (autoOn && !dragging && performance.now() - lastInteract > 3000) {
      theta += autoSpeeds[speedIdx] * dt;
    }
    updateCamera();
  }

  /** 把球角对准某方向向量（focusConcert 用）：钳制 phi 并适度拉近 · Retarget spherical angles to a direction (for focusConcert): clamp phi and pull in moderately */
  function faceDir(dirv) {
    theta = Math.atan2(dirv.x, dirv.z);
    phi = Math.max(0.35, Math.min(2.6, Math.acos(Math.max(-1, Math.min(1, dirv.y)))));
    radius = Math.max(14, Math.min(28, radius));   // 适度拉近 · pull in moderately
  }

  /** 停住拖拽并暂停自动旋转计时（focusConcert 用）· Drop the drag state and restart the auto-rotate idle timer (for focusConcert) */
  function stopAutoRotate() {
    dragging = false;
    lastInteract = performance.now();
  }

  function dispose() {
    cv.removeEventListener('pointerdown', onCvDown);
    window.removeEventListener('pointermove', onWinMove);
    window.removeEventListener('pointerup', onWinUp);
    cv.removeEventListener('wheel', onWheel);
    window.removeEventListener('resize', onResize);
  }

  return { target, updateCamera, tick, faceDir, stopAutoRotate, isDragging: () => dragging, dispose };
}
