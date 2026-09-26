// @ts-nocheck
/* =====================================================================
 * marquee.ts —— 舞台头顶轮播标签：每隔几秒轮流高亮一个「朝向相机」的舞台
 * 由拆分前的单文件 concert 逐段搬移而来，逻辑未变。facingOf 同时供 index.ts 的 update()
 * 做背面剔除复用，故一并导出。L 为共享文案引用（调用时读取）。
 * marquee.ts — stage-head marquee label: every few seconds highlight the next camera-facing stage.
 * Moved verbatim from the pre-split single concert file; logic unchanged. facingOf is also exported for index.ts's update()
 * back-face culling. L is the shared copy reference (read at call time).
 * ===================================================================== */
export function createMarquee({ L, THREE, dom, camera, planet, stages }) {
  const marquee = document.createElement('div');
  marquee.className = 'stage-marquee';
  marquee.innerHTML = '<div class="sm-time"></div><div class="sm-artist"></div><div class="sm-theme"></div>';
  document.body.appendChild(marquee);
  const smTime = marquee.querySelector('.sm-time');
  const smArtist = marquee.querySelector('.sm-artist');
  const smTheme = marquee.querySelector('.sm-theme');
  let marqueeIdx = 0, marqueeTimer = 0;
  const MARQUEE_INTERVAL = 4;   // 秒：每隔几秒切换到下一个「朝向相机」的舞台 · seconds: switch to the next camera-facing stage every few seconds
  const FACE_MIN = 0.15;        // 朝向阈值：低于此值认为在侧面/背面，顺延到下一个可见舞台 · facing threshold: below this it is side/back, defer to next visible stage
  const _mw = new THREE.Vector3(), _mp = new THREE.Vector3(), _mn = new THREE.Vector3(), _mc = new THREE.Vector3();
  function setMarqueeContent(st) {
    const inf = (st && st.info) || {};
    smTime.textContent = (L.time || '时间') + '：' + (inf.time || inf.session || '—');
    smArtist.textContent = (L.artist || '艺人') + '：' + (inf.artist || inf.star || '—');
    smTheme.textContent = (L.theme || '主题') + '：' + (inf.theme || inf.name || '—');
  }
  // 计算舞台外法线与视线夹角余弦（>0 朝向相机）；副作用：_mw=该舞台世界坐标，_mn=外法线
  // Cosine of the angle between a stage's outward normal and the view direction (>0 = facing camera); side effects: _mw = stage world pos, _mn = outward normal
  function facingOf(st) {
    st.g.getWorldPosition(_mw);
    _mn.copy(_mw).sub(_mp);
    const len = _mn.length() || 1;
    _mn.multiplyScalar(1 / len);
    _mc.copy(camera.position).sub(_mw).normalize();
    return _mn.dot(_mc);
  }
  // 从 from 起往后找第一个朝向相机的舞台索引，全部朝背则返回 -1
  // From `from`, find the first camera-facing stage index; return -1 if all face away
  function nextVisible(from) {
    for (let k = 0; k < stages.length; k++) {
      const i = (from + k) % stages.length;
      if (facingOf(stages[i]) > FACE_MIN) return i;
    }
    return -1;
  }
  function updateMarquee() {
    planet.getWorldPosition(_mp);   // 每帧取一次星球中心 · fetch the planet center once per frame
    let f = marqueeIdx >= 0 ? facingOf(stages[marqueeIdx]) : -1;
    // 当前舞台转到背/侧面：立即顺延到下一个可见舞台，而不是留空白
    // Current stage turned to back/side: immediately defer to the next visible stage rather than leave a gap
    if (f <= FACE_MIN) {
      marqueeIdx = nextVisible((marqueeIdx + 1) % stages.length);
      marqueeTimer = 0;
      if (marqueeIdx < 0) { marquee.style.display = 'none'; return; }
      setMarqueeContent(stages[marqueeIdx]);
      f = facingOf(stages[marqueeIdx]);
    }
    _mw.addScaledVector(_mn, 3.6);   // 抬到舞台头顶（_mw/_mn 为最后一次 facingOf 留下的结果）· lift above the stage head (_mw/_mn are the last facingOf results)
    _mw.project(camera);
    const rect = dom.getBoundingClientRect();
    let x = rect.left + (_mw.x * 0.5 + 0.5) * rect.width;
    let y = rect.top + (-_mw.y * 0.5 + 0.5) * rect.height;
    marquee.style.display = 'block';
    const halfW = marquee.offsetWidth / 2, hh = marquee.offsetHeight;   // 钳制避免贴边被裁切 · clamp to avoid clipping at the edges
    x = Math.min(Math.max(x, rect.left + halfW + 8), rect.left + rect.width - halfW - 8);
    y = Math.min(Math.max(y, rect.top + hh + 8), rect.top + rect.height - 8);
    marquee.style.transform = 'translate(-50%,-100%) translate(' + x + 'px,' + y + 'px)';
    marquee.style.opacity = String(Math.min(1, Math.max(0.35, f * 1.4)));
  }
  setMarqueeContent(stages[0]);

  /** 每帧驱动：累计切换计时 + 刷新标签位置与透明度 · Per-frame driver: switch timer + label position/opacity refresh */
  function tick(t, dt) {
    marqueeTimer += dt;
    if (marqueeTimer >= MARQUEE_INTERVAL) {
      marqueeTimer = 0;
      const ni = nextVisible((marqueeIdx + 1) % stages.length);   // 只在前半球可见舞台间轮播 · rotate only among the front-hemisphere visible stages
      if (ni >= 0) { marqueeIdx = ni; setMarqueeContent(stages[marqueeIdx]); }
    }
    updateMarquee();
  }

  /** 语言切换后刷新当前标签文案（L 已被原地突变）· Re-render the current label after a language switch (L mutated in place) */
  function refreshContent() {
    if (stages[marqueeIdx]) setMarqueeContent(stages[marqueeIdx]);   // 刷新当前轮播标签 · refresh the current marquee label
  }

  function dispose() {
    if (marquee.parentNode) marquee.parentNode.removeChild(marquee);
  }

  return { tick, facingOf, refreshContent, dispose };
}
