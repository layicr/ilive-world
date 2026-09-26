// @ts-nocheck
/* =====================================================================
 * planetTown.ts —— 星球小镇 3D 引擎编排层（由旧版独立 index.html 逐段移植而来，逻辑未变）。
 * 依赖全局 THREE（npm 包 three@0.128，由 PlanetCanvas 动态 import 挂到 window.THREE）。
 * opts: { stageInfos?: 演唱会数据（/api/concerts 全量条目）, labels?: 信息卡文案 }
 * 本目录拆分（行为与原单文件一致）：
 *   town/village.ts     村庄搭建（房屋/树/路/井/喷泉/椅/灯/栅栏 + 背面村）· village builder
 *   town/characters.ts  精灵/小人工厂 + 游走系统 · elf/person factories & wander system
 *   town/atmosphere.ts  月牙/云朵/飞鸟/花瓣 · moon / clouds / birds / petals
 *   town/orbit.ts       相机轨道状态机 · camera orbit state machine
 *   concert/index.ts    演唱会模块（舞台/花车/信息卡）· concert module
 * planetTown.ts — planet-town 3D engine orchestration layer (ported from the old standalone index.html; logic unchanged).
 * Relies on global THREE (npm three@0.128, dynamically imported onto window.THREE by PlanetCanvas).
 * opts: { stageInfos?: concert rows (full /api/concerts entries), labels?: info-card copy }
 * Folder split (behavior identical to the old single file):
 *   town/village.ts     village builder (houses/trees/roads/well/fountains/benches/lamps/fences + back village)
 *   town/characters.ts  elf/person factories & the wander system
 *   town/atmosphere.ts  moon / clouds / birds / petals
 *   town/orbit.ts       camera orbit state machine
 *   concert/index.ts    concert module (stages / floats / info cards)
 * ===================================================================== */
import { init as initConcert } from './concert';
import { createVillage } from './town/village';
import { createCharacters } from './town/characters';
import { createAtmosphere } from './town/atmosphere';
import { createOrbit } from './town/orbit';

export function createPlanetTown(container, opts = {}) {
  // ES module 已隐式 strict；此处不能再写 'use strict'（带默认值的参数列表非法）
  // ES modules are implicitly strict; 'use strict' cannot be repeated here (illegal with default-valued params)
  const THREE = window.THREE;
  const vw = () => container.clientWidth || window.innerWidth;
  const vh = () => container.clientHeight || window.innerHeight;

  /* ================= 基础 · Basics ================= */
  const scene = new THREE.Scene();
  scene.fog = null;

  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 2; skyCanvas.height = 512;
  const sctx = skyCanvas.getContext('2d');
  const grad = sctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#1d74d8');
  grad.addColorStop(0.55, '#4fa8ee');
  grad.addColorStop(1, '#a3dcfa');
  sctx.fillStyle = grad; sctx.fillRect(0, 0, 2, 512);
  scene.background = new THREE.CanvasTexture(skyCanvas);
  scene.background.encoding = THREE.sRGBEncoding;

  const camera = new THREE.PerspectiveCamera(42, vw() / vh(), 0.1, 400);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(vw(), vh());
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // 精细渲染：sRGB 色彩空间 + ACES 电影级色调映射
  // Fine rendering: sRGB color space + ACES filmic tone mapping
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  container.appendChild(renderer.domElement);

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const rand = mulberry32(20260924);   // 固定种子：刷新画面完全一致，便于美术调参比对 · fixed seed: identical on reload, easing art parameter comparison

  const mat = (color, opt) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 1, metalness: 0, flatShading: true }, opt || {}));
  const UP = new THREE.Vector3(0, 1, 0);
  const D2R = Math.PI / 180;

  /* ================= 光照 · Lighting ================= */
  scene.add(new THREE.HemisphereLight(0xd8e8f0, 0x8fb878, 0.66));
  const sun = new THREE.DirectionalLight(0xfff3da, 1.0);
  sun.position.set(18, 30, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  // 冷色补光（背光面更通透）· cool fill light (translucent back faces)
  const fill = new THREE.DirectionalLight(0xbcd8f0, 0.28);
  fill.position.set(-14, 10, -18);
  scene.add(fill);

  /* ================= 星球本体 · Planet body ================= */
  const R = 10;
  const world = new THREE.Group();
  scene.add(world);
  const planet = new THREE.Group();
  world.add(planet);

  const planetGeo = new THREE.IcosahedronGeometry(R, 4);
  (function paintPlanet() {
    const pos = planetGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cGrass = new THREE.Color(0x7cc94f), cGrassDark = new THREE.Color(0x67b83e);
    const cDirt = new THREE.Color(0xa0764e), cRock = new THREE.Color(0x7d5b40);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      // 轻微起伏（确定性，接缝不裂，幅度小避免穿模）· gentle deterministic bumps (no seam splits; small amplitude to avoid clipping)
      const d = 0.09 * Math.sin(x * 0.9 + z * 1.3) + 0.07 * Math.cos(y * 1.1 - z * 0.8);
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      const k = (R + d) / len;
      pos.setXYZ(i, x * k, y * k, z * k);
      const noise = 0.5 + 0.5 * Math.sin(x * 1.7 + y * 2.1 + z * 1.3);
      if (y > -8.5) tmp.copy(cGrass).lerp(cGrassDark, noise * 0.8);
      else if (y > -9.5) tmp.copy(cDirt).lerp(cRock, noise * 0.35);
      else tmp.copy(cRock);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    planetGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    planetGeo.computeVertexNormals();
  })();
  const planetMesh = new THREE.Mesh(planetGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true }));
  planetMesh.receiveShadow = true;
  planet.add(planetMesh);

  /* ================= 原图坐标 -> 球面 映射 · Source-layout coords -> sphere mapping =================
     效果图村庄是一张半径约 9.5 的圆盘；把它"包"到球顶：
     盘心 -> 北极，盘缘 -> 北纬 24°（colat 66°），方位角保持不变。
     这样球面上元素之间的相对位置与原图完全一致。
     The village layout is a disc of radius ~9.5; "wrap" it onto the sphere top:
     disc center -> north pole, disc rim -> latitude 24° (colat 66°), azimuth preserved.
     So relative positions on the sphere match the source layout exactly. */
  const MAXR = 9.6, MAXCOLAT = 66 * Math.PI / 180;
  function villageDir(x, z) {
    const r = Math.hypot(x, z);
    const colat = Math.min(1, r / MAXR) * MAXCOLAT;
    const lon = Math.atan2(z, x);
    const lat = Math.PI / 2 - colat;
    return new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
  }
  function placeOnPlanet(obj, x, z, spin, lift) {
    const n = villageDir(x, z);
    obj.position.copy(n).multiplyScalar(R + (lift === undefined ? 0.12 : lift));
    obj.quaternion.setFromUnitVectors(UP, n);
    if (spin) obj.rotateY(spin);
    planet.add(obj);
    return n;
  }
  function shadows(g) { g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; }
  // 精细化：投影 + 平滑着色（去掉低多边形棱面，圆润质感）
  // Refine: shadows + smooth shading (drop low-poly facets for a rounded look)
  function refine(g) {
    g.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        if (o.material && o.material.flatShading !== undefined) {
          o.material.flatShading = false;
          o.material.needsUpdate = true;
        }
      }
    });
    return g;
  }
  // 纬度/经度 -> 单位方向（函数声明需先于下方各子模块可用，与原文件内的提升行为一致）
  // lat/lon -> unit direction (declared before the sub-modules below, mirroring the hoisting in the original file)
  function dirLatLon(lat, lon) {
    const la = lat * D2R, lo = lon * D2R;
    return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo));
  }
  function placeLat(obj, lat, lon, spin, lift) {
    const n = dirLatLon(lat, lon);
    obj.position.copy(n).multiplyScalar(R + (lift === undefined ? 0.12 : lift));
    obj.quaternion.setFromUnitVectors(UP, n);
    if (spin) obj.rotateY(spin);
    planet.add(obj);
    return n;
  }
  // 柔和接触阴影（贴地暗斑，随悬浮高度变淡变大）· Soft contact shadow (grounded dark patch, fades & grows with hover height)
  const blobTexture = (function () {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grd.addColorStop(0, 'rgba(30,40,25,0.42)');
    grd.addColorStop(1, 'rgba(30,40,25,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const blobGeo = new THREE.PlaneGeometry(1, 1);
  function makeBlob(size) {
    const m = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false }));
    m.scale.setScalar(size);
    m.renderOrder = 1;
    planet.add(m);
    return m;
  }
  function updateBlob(blob, d, lift) {
    blob.position.copy(d).multiplyScalar(R + 0.09);
    blob.quaternion.setFromUnitVectors(UP, d);
    blob.rotateX(-Math.PI / 2);
    blob.material.opacity = Math.max(0.25, 1 - lift * 0.75);
    const s = blob.userData.size * (1 + lift * 0.35);
    blob.scale.setScalar(s);
  }
  // 太阳光晕（柔和暖光，不抢画面）· Sun glow (soft warm light, not overpowering the scene)
  (function sunGlow() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    grd.addColorStop(0, 'rgba(255,250,225,0.55)');
    grd.addColorStop(0.3, 'rgba(255,240,200,0.22)');
    grd.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false }));
    spr.scale.setScalar(10);
    spr.position.set(30, 50, 24);
    scene.add(spr);
  })();

  /* ================= 村庄搭建（town/village.ts：正/背面全部静态元素） · Village build (town/village.ts: all static props, front & back) ================= */
  const VILLAGE = createVillage({
    THREE, planet, R, UP, D2R, rand, mat, shadows,
    villageDir, placeOnPlanet, placeLat, dirLatLon, makeBlob, updateBlob,
  });

  /* ================= 角色（town/characters.ts：精灵/小人工厂 + 游走系统） · Characters (town/characters.ts: elf/person factories + wander system) ================= */
  const CHARS = createCharacters({
    THREE, R, rand, mat, refine,
    placeOnPlanet, placeLat, makeBlob, updateBlob,
  });
  const makeElf = CHARS.makeElf, makePerson = CHARS.makePerson;

  /* ================= 演唱会模块（concert/index.ts：舞台 / 花车 / 信息卡，均可在其顶部 CONFIG 配置） · Concert module (concert/index.ts: stages / floats / info cards, all tunable in its top-level CONFIG) ================= */
  const CON = initConcert({
    THREE, planet, camera, renderer, rand, mat, refine, R, D2R, MAXR, MAXCOLAT,
    villageDir, placeLat, dirLatLon, makeBlob, updateBlob, makeElf, makePerson,
    domElement: renderer.domElement, stageInfos: opts.stageInfos, labels: opts.labels,
    isDragging: () => orbit.isDragging(),
    occupiedProps: [
      ...VILLAGE.houses.map(([hx, hz]) => villageDir(hx, hz)),
      ...VILLAGE.backHouses.map(([lat, lon]) => dirLatLon(lat, lon)),
      villageDir(1.6, 1.0), villageDir(-2.7, 2.6), villageDir(3.7, -1.5),
      ...VILLAGE.fountainDirs,                           // 广场 3 座喷泉 · 3 plaza fountains
      dirLatLon(-20, -40), dirLatLon(-28, 55)            // 背面路灯长椅 · back-side lamp & bench
    ]
  });

  /* ================= 氛围（town/atmosphere.ts：月牙/云朵/飞鸟/花瓣） · Ambience (town/atmosphere.ts: moon / clouds / birds / petals) ================= */
  const ATM = createAtmosphere({
    THREE, scene, planet, R, rand, mat,
    blossomDirs: VILLAGE.blossomDirs,
  });

  /* ================= 相机轨道（town/orbit.ts：拖拽/滚轮/自动旋转/resize） · Camera orbit (town/orbit.ts: drag / wheel / auto-rotate / resize) ================= */
  const orbit = createOrbit({ THREE, camera, renderer, vw, vh });

  /* ================= 动画循环 · Animation loop ================= */
  const clock = new THREE.Clock();
  let running = true, raf = 0;
  function animate() {
    if (!running) return;
    raf = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    orbit.tick(dt);   // 自动旋转 + 相机刷新 · auto-rotate + camera refresh

    // 星球呼吸浮动 · Planet breathing float
    world.position.y = Math.sin(t * 0.5) * 0.3;
    world.rotation.z = Math.sin(t * 0.35) * 0.01;

    CON.update(t, dt);           // 演唱会舞台 + 花车动画（见 concert/）· concert stages + float animation (see concert/)

    CHARS.updateWanderers(t, dt);   // 游走：精灵飞行扇翅 / 小人迈步 · wander: elves fly & flap / people stride

    ATM.update(t, dt);           // 花瓣 / 飞鸟 / 云朵 / 月牙 · petals / birds / clouds / moon

    renderer.render(scene, camera);
  }
  orbit.updateCamera();
  animate();

  return {
    mount() { if (!running) { running = true; animate(); } },
    // 轻量暂停/恢复：仅切换 rAF，不释放资源（用于标签页隐藏 / canvas 滚出视口）
    // Lightweight pause/resume: toggle rAF only, no resource release (for tab hidden / canvas scrolled out of view)
    pause() { if (running) { running = false; cancelAnimationFrame(raf); } },
    resume() { if (!running) { running = true; animate(); } },
    // 语言切换：转发给演唱会模块，不重建场景 · Language switch: forward to the concert module, no scene rebuild
    setLang(labels, stageInfos) { CON.setLang?.(labels, stageInfos); },
    // 搜索框点结果：把镜头转到该演唱会舞台正前方（沿 target→舞台方向重算 theta/phi），下一帧投影并弹卡
    // Search-box result click: swing the camera in front of that concert's stage (recompute theta/phi along target->stage), then project and pop the card next frame
    focusConcert(id) {
      const st = CON.stages.find(s => s.info && s.info.id === id);
      if (!st) return false;
      const dirv = st.g.getWorldPosition(new THREE.Vector3()).sub(orbit.target).normalize();
      orbit.faceDir(dirv);
      orbit.stopAutoRotate();   // 暂停自动旋转，镜头停住 · pause auto-rotate, hold the camera
      orbit.updateCamera();
      requestAnimationFrame(() => { orbit.updateCamera(); CON.showCardById?.(id); });   // 待矩阵稳定后弹卡 · pop the card once matrices settle
      return true;
    },
    unmount() {
      running = false;
      cancelAnimationFrame(raf);
      orbit.dispose();
      CON.dispose();
      scene.traverse(o => {
        if (o.isMesh || o.isSprite) {
          if (o.geometry) o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => { if (m) { if (m.map) m.map.dispose(); m.dispose(); } });
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };
}
