// @ts-nocheck
/* =====================================================================
 * town/atmosphere.ts —— 氛围元素：月牙、环绕云朵、飞鸟、樱花树附近飘落的花瓣
 * 自 planetTown.ts 逐段搬移，逻辑未变；创建顺序保持原样（rand 固定种子）。
 * town/atmosphere.ts — ambience: crescent moon, orbiting clouds, birds and petals falling near the cherry trees.
 * Moved verbatim from planetTown.ts; logic unchanged; creation order preserved (fixed-seed rand).
 * ===================================================================== */
export function createAtmosphere(ctx) {
  const { THREE, scene, planet, R, rand, mat, blossomDirs } = ctx;

  /* ---------- 月牙 · Crescent moon ---------- */
  const moon = (function () {
    const s = new THREE.Shape();
    s.absarc(0, 0, 2.0, Math.PI * 0.5, Math.PI * 1.5, false);
    s.absarc(1.0, 0, 1.55, Math.PI * 1.5, Math.PI * 0.5, true);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
    geo.center();
    const m = new THREE.Mesh(geo, mat(0xf6e6a8, { emissive: 0xf0df9e, emissiveIntensity: 0.45 }));
    m.scale.setScalar(1.3);
    m.position.set(3, 16, -10);
    m.rotation.y = 0.45;
    scene.add(m);
    return m;
  })();

  /* ---------- 云朵（环绕星球，含下方） · Clouds (orbiting the globe, including below) ---------- */
  const cloudMat = mat(0xffffff, { emissive: 0x9cd0f5, emissiveIntensity: 0.18 });
  function makeCloud(scale) {
    const g = new THREE.Group();
    [[0, 0, 0, 1.0], [0.95, 0.18, 0.12, 0.7], [-0.9, 0.12, -0.12, 0.66], [0.32, 0.44, -0.2, 0.55], [-0.34, 0.4, 0.26, 0.5]].forEach(([x, y, z, r]) => {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.78 * r * scale, 8, 7), cloudMat);
      p.position.set(x * scale, y * scale, z * scale);
      g.add(p);
    });
    return g;
  }
  const clouds = [];
  const cloudDefs = [
    [0.4, 14, 24, 2.6, 0.05], [1.5, 9, 27, 3.1, 0.07], [2.6, 12, 22, 2.2, 0.045], [3.5, 5, 29, 2.8, 0.06],
    [4.4, 11, 25, 2.4, 0.055], [5.4, 7, 28, 3.0, 0.065], [0.9, -6, 21, 2.0, 0.05], [2.1, -9, 25, 2.6, 0.075],
    [3.9, -11, 22, 2.9, 0.045], [5.0, -7, 27, 2.3, 0.06], [1.0, -14, 18, 3.4, 0.04], [4.2, -15, 19, 3.8, 0.05],
    [2.8, 16, 30, 2.4, 0.055], [3.2, 3, 31, 2.2, 0.07], [5.8, 12, 26, 2.7, 0.05],
  ];
  cloudDefs.forEach(([a, y, r, s, spd], i) => {
    const c = makeCloud(s);
    const ang = a * 1.7 + i;
    c.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
    scene.add(c);
    clouds.push({ g: c, baseY: y, r, ang, spd, phase: rand() * 6.28 });
  });

  /* ---------- 飞鸟 · Flying birds ---------- */
  const birdMat = mat(0x5a6068);
  const birds = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const wl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.045, 0.14), birdMat);
    wl.position.x = -0.28; g.add(wl);
    const wr = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.045, 0.14), birdMat);
    wr.position.x = 0.28; g.add(wr);
    scene.add(g);
    birds.push({ g, wl, wr, angle: rand() * 6.28, speed: 0.18 + rand() * 0.14, r: 13 + rand() * 5, h: 3.5 + rand() * 6, phase: rand() * 6.28 });
  }

  /* ---------- 飘落花瓣（在樱花树附近沿法线飘落） · Falling petals (drift down along the normal near the cherry trees) ---------- */
  const petalMat = new THREE.MeshBasicMaterial({ color: 0xffa5c8, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  const petals = [];
  function resetPetal(st, init) {
    const src = blossomDirs[Math.floor(rand() * blossomDirs.length)];
    const d = src.clone().add(new THREE.Vector3((rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5)).normalize();
    st.d = d;
    st.h = init ? 0.5 + rand() * 3.5 : 3 + rand() * 1.5;
    st.m.position.copy(d).multiplyScalar(R + st.h);
    st.m.rotation.set(rand() * 6.28, rand() * 6.28, rand() * 6.28);
  }
  for (let i = 0; i < 34; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), petalMat);
    const st = { m: p, speed: 0.45 + rand() * 0.5, phase: rand() * 6.28, rx: (rand() - 0.5) * 4, rz: (rand() - 0.5) * 4 };
    resetPetal(st, true);
    planet.add(p);
    petals.push(st);
  }

  // 每帧复用的临时向量 · per-frame scratch vector
  const tmpV = new THREE.Vector3();

  /* ---------- 每帧氛围更新 · Per-frame ambience update ---------- */
  function update(t, dt) {
    // 花瓣径向飘落 · Petals fall radially
    petals.forEach(st => {
      st.h -= st.speed * dt;
      tmpV.copy(st.d).multiplyScalar(R + Math.max(st.h, 0.05));
      tmpV.x += Math.sin(t * 1.6 + st.phase) * 0.03;
      tmpV.z += Math.cos(t * 1.3 + st.phase) * 0.03;
      st.m.position.copy(tmpV);
      st.m.rotation.x += st.rx * dt; st.m.rotation.z += st.rz * dt;
      if (st.h <= 0.05) resetPetal(st, false);
    });

    // 飞鸟盘旋 + 振翅 · Birds circle + flap
    birds.forEach(b => {
      b.angle += b.speed * dt;
      b.g.position.set(Math.cos(b.angle) * b.r, b.h + Math.sin(t * 1.3 + b.phase) * 0.5, Math.sin(b.angle) * b.r);
      b.g.rotation.y = -b.angle;
      const flap = Math.sin(t * 9 + b.phase) * 0.55;
      b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
    });

    // 云朵绕星球公转 + 上下起伏 · Clouds orbit the globe + bob up and down
    clouds.forEach(c => {
      c.ang += c.spd * dt;
      c.g.position.set(Math.cos(c.ang) * c.r, c.baseY + Math.sin(t * 0.3 + c.phase) * 0.6, Math.sin(c.ang) * c.r);
    });

    // 月牙轻摆 · Crescent moon gently sways
    moon.position.y = 16 + Math.sin(t * 0.4) * 0.35;
  }

  return { update };
}
