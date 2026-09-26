// @ts-nocheck
/* =====================================================================
 * concert/index.ts —— 演唱会模块编排层（舞台 / 花车巡游 / 动画）
 * 由旧版独立 concert.js 逐段移植为 ES 模块；3D 逻辑未变，改动集中在：
 *   1) window.CONCERT IIFE -> export { init, CONFIG }
 *   2) 指针命中改用画布 getBoundingClientRect()（容器不再等同视口）
 *   3) 信息卡数据源：注入 deps.stageInfos（/api/concerts 全量条目）
 *   4) 卡片文案 deps.labels 支持多语言；库来源卡片带点赞按钮
 *   5) 返回 dispose()，供 Vue 组件卸载时清理 DOM 与全局监听
 * 本目录拆分（卡片/弹窗/轮播/命中检测各自成模块，行为与原单文件一致）：
 *   cardCss.ts   信息卡/弹窗/轮播样式文本 · card/modal/marquee stylesheet text
 *   safeLink.ts  HTML 转义 + 外链白名单 + 视频地址 · escaping + link allowlist + video URLs
 *   modal.ts     轻量弹窗 DOM 与开合 · lightweight modal DOM & open/close
 *   card.ts      信息卡 + 点赞 + 歌单/视频入口 · info card + likes + setlist/video entries
 *   hitTest.ts   射线拾取与点击/悬浮 · raycast picking & click/hover
 *   marquee.ts   舞台头顶轮播标签 · stage-head marquee label
 * 依赖全局 THREE（npm 包 three@0.128，由 PlanetCanvas 动态 import 挂到 window.THREE）。
 * concert/index.ts — concert orchestration layer (stages / parade floats / animation).
 * Ported section by section from the old standalone concert.js into an ES module; 3D logic unchanged. Deltas:
 *   1) window.CONCERT IIFE -> export { init, CONFIG }
 *   2) pointer picking uses the canvas getBoundingClientRect() (container is no longer the viewport)
 *   3) card data source: injected deps.stageInfos (full rows from /api/concerts)
 *   4) card copy comes from deps.labels for i18n; DB-backed cards carry a like button
 *   5) returns dispose() so the Vue wrapper can clean up DOM and global listeners
 * This folder split (card / modal / marquee / hit-testing each a module; behavior identical to the old single file):
 *   cardCss.ts   card/modal/marquee stylesheet text
 *   safeLink.ts  HTML escaping + external-link allowlist + video URL builders
 *   modal.ts     lightweight modal DOM & open/close
 *   card.ts      info card + likes + setlist/video entries
 *   hitTest.ts   raycast picking & click/hover
 *   marquee.ts   stage-head marquee label
 * Relies on global THREE (npm three@0.128, dynamically imported onto window.THREE by PlanetCanvas).
 * ===================================================================== */
import { createModal } from './modal';
import { createCard } from './card';
import { createHitTest } from './hitTest';
import { createMarquee } from './marquee';

/* ==================== 可配置参数 · Tunable config ==================== */
export const CONFIG = {
  /* 调色板 · Palettes */
  stageColors: [0xff6b81, 0x4fa3e0, 0xffb74d, 0x8ecf6a, 0xb98af5, 0x5ee0c8],  // 舞台/花车主色板 · stage/float main palette
  noteColors: [0xff8a98, 0xffd94f, 0x7cd8ff, 0xc2a8ff],                        // 音符颜色 · note colors
  hairColors: [0x4a3628, 0x2e2a26, 0x7a5230],                                  // 观众/车员发色 · audience/rider hair colors

  /* 舞台分布（球面均匀螺旋）· Stage placement (even spherical spiral) */
  stage: {
    count: 30,          // 舞台总数 · total stage count
    minSpacing: 0.25,   // 舞台彼此最小夹角（弧度）· min angle between stages (radians)
    avoidProps: 0.21,   // 与房屋/长椅的最小夹角（弧度）· min angle vs houses/benches (radians)
    ringMargin: 0.164,  // 正面花车航线禁带半宽（弧度）· half-width of front float-lane keep-out (radians)
    backBand: 9.4,      // 背面巡游纬度禁带半宽（度）· half-width of back-parade latitude band (degrees)
    scale: 0.72,        // 舞台整体缩放（越小越精致）· overall stage scale (smaller = daintier)
    noBeamEvery: 3      // 每 noBeamEvery 台留 1 台不放光柱（0 或留空=全部有光柱）· every Nth stage swaps beams for note fountains (0/empty = all have beams)
  },

  /* 台前观众站位：2 人固定 + 偶数台 1 精灵 / 奇数台 2 动物（[横向角, 半径]）
     Fan spots: 2 fixed persons + (even idx: 1 elf / odd idx: 2 pets), as [lateral angle, radius] */
  fanSpacing: {
    persons: [[-0.55, 1.7], [0.55, 1.7]],
    elf: [0, 1.95],
    pets: [[-0.45, 1.9], [0.45, 1.9]]
  },

  /* 花车巡游：每条航线一段。count=辆数（含 leader），spread=true 则相位均匀
     Parade routes: one entry each. count = floats (incl. leader); spread = even phase spacing */
  floats: [
    { route: 'ring', count: 6, speed: 0.15, lift: 1.4, spread: true },   // 正面石板环路上空 · above the front cobbled ring road
    { route: 'globe', count: 6, speed: 0.11, lift: 0.1, spread: true,    // 环球倾斜大圆航线 · tilted global great-circle route
      leader: { count: 1, speed: 0.13, lift: 1.2 } }                     // 领头 1 辆低空飞行 · 1 leader flying lower
  ],
  globeTiltDeg: 55,     // 环球航线倾角（度）· global route tilt (degrees)

  /* 卡片外观与文案 · Card look & copy */
  card: { width: 242, accent: '#b4935c', bgTop: '#f6ead0', bgMid: '#eddfba', bgBottom: '#e3d1a4' },

  /* 动画速度 / 幅度 · Animation speeds / amplitudes */
  anim: {
    beamSway: 1.3, beamFlicker: 2.4,          // 光柱摇摆 / 闪烁 · beam sway / flicker
    fountainSpeed: 0.42, fountainHeight: 2.1, // 音符喷泉上升速度 / 高度 · note-fountain rise speed / height
    starSpin: 1.8, fanBounce: 4, notesOrbit: 0.7,  // 主唱转速 / 观众蹦跳 / 环绕音符公转 · lead singer spin / fans bouncing / orbiting notes
    wheelSpin: 4, riderBounce: 3.5            // 花车轮转速 / 乘客颠簸 · float wheel spin / rider bobbing
  }
};

/* ==================== 实现 · Implementation ==================== */
export function init(deps) {
  const D = deps;
  const C = CONFIG;
  // 卡片文案完全由调用方注入的多语言 labels（deps.labels，来自 i18n card.*）提供
  // All card copy comes from caller-injected multilingual labels (deps.labels, from i18n card.*)
  const L = D.labels || {};
  const THREE = D.THREE, planet = D.planet, camera = D.camera, renderer = D.renderer,
    rand = D.rand, mat = D.mat, refine = D.refine, R = D.R, D2R = D.D2R,
    MAXR = D.MAXR, MAXCOLAT = D.MAXCOLAT,
    villageDir = D.villageDir, placeLat = D.placeLat, dirLatLon = D.dirLatLon,
    makeBlob = D.makeBlob, updateBlob = D.updateBlob,
    makeElf = D.makeElf, makePerson = D.makePerson;
  const dom = D.domElement || renderer.domElement;

  const STAGE_COLORS = C.stageColors;
  const noteColors = C.noteColors;
  const PET_KINDS = ['rabbit', 'cat', 'bear'];
  // 舞台数量 = 数据库演唱会条数（无数据时兜底 CONFIG.stage.count）；据此分档自适应降级
  // Stage count = number of DB concerts (falls back to CONFIG.stage.count); drives LOD tiering
  const stageCount = (D.stageInfos && D.stageInfos.length) ? D.stageInfos.length : C.stage.count;
  const tier = stageCount <= 20 ? 0 : stageCount <= 45 ? 1 : 2;   // 0满配 / 1中 / 2低 · 0 full / 1 medium / 2 low LOD

  /* ---------- 共享几何体缓存（同参数只创建一次，大幅减少 GPU buffer 与显存）
          Shared geometry cache (one instance per parameter set; cuts GPU buffers & VRAM) ---------- */
  const _geoCache = new Map();
  const cacheGeo = (k, make) => { let g = _geoCache.get(k); if (!g) { g = make(); _geoCache.set(k, g); } return g; };
  const sph = (r, a, b) => cacheGeo('S' + r + ',' + a + ',' + b, () => new THREE.SphereGeometry(r, a, b));
  const cyl = (rt, rb, h, s) => cacheGeo('Y' + rt + ',' + rb + ',' + h + ',' + s, () => new THREE.CylinderGeometry(rt, rb, h, s));
  const con = (r, h, s) => cacheGeo('N' + r + ',' + h + ',' + s, () => new THREE.ConeGeometry(r, h, s));
  const box = (w, h, d) => cacheGeo('B' + w + ',' + h + ',' + d, () => new THREE.BoxGeometry(w, h, d));
  const tor = (r, t, rs, ts, a) => cacheGeo('T' + r + ',' + t + ',' + rs + ',' + ts + ',' + a, () => new THREE.TorusGeometry(r, t, rs, ts, a));
  // 花车轮：几何体预旋转到 X 轴向，整场共享一份（在 makeFloat 外只创建/旋转一次）
  // Float wheels: geometry pre-rotated to the X axis, shared by all floats (built once outside makeFloat)
  const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.1, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  // 舞台拾取代理：一个不可见包围盒，替代对整台数十个 mesh 的递归射线检测
  // Stage pick proxy: one invisible bounding box instead of recursive raycasts over dozens of meshes
  const pickGeo = new THREE.BoxGeometry(3.4, 3.2, 3.4); pickGeo.translate(0, 1.4, 0);
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  // 每帧复用的临时对象（避免巡游动画里反复 new）
  // Per-frame scratch objects (avoid re-allocating every parade frame)
  const _right = new THREE.Vector3(), _mat4 = new THREE.Matrix4();

  /* ---------- 小动物（兔/猫/熊，几何体拼装，用作舞台观众）
          Pets (rabbit / cat / bear, geometry-assembled, used as stage audiences) ---------- */
  function makePet(kind) {
    const g = new THREE.Group();
    if (kind === 'rabbit') {
      const body = new THREE.Mesh(sph(0.14, 9, 7), mat(0xfdf6ee));
      body.scale.y = 1.15; body.position.y = 0.14; g.add(body);
      const head = new THREE.Mesh(sph(0.1, 9, 7), mat(0xfdf6ee));
      head.position.set(0, 0.28, 0.05); g.add(head);
      [-1, 1].forEach(sd => {
        const ear = new THREE.Mesh(cyl(0.028, 0.034, 0.19, 6), mat(0xfdf6ee));
        ear.position.set(sd * 0.05, 0.44, 0.02); ear.rotation.z = sd * 0.18; g.add(ear);
      });
      const tail = new THREE.Mesh(sph(0.045, 6, 5), mat(0xffffff));
      tail.position.set(0, 0.12, -0.14); g.add(tail);
      [-0.04, 0.04].forEach(ex => {
        const eye = new THREE.Mesh(sph(0.014, 5, 4), mat(0x35322f));
        eye.position.set(ex, 0.3, 0.14); g.add(eye);
      });
    } else if (kind === 'cat') {
      const body = new THREE.Mesh(sph(0.13, 9, 7), mat(0x9aa4b2));
      body.scale.set(1, 1.05, 1.25); body.position.y = 0.13; g.add(body);
      const head = new THREE.Mesh(sph(0.1, 9, 7), mat(0x9aa4b2));
      head.position.set(0, 0.24, 0.11); g.add(head);
      [-1, 1].forEach(sd => {
        const ear = new THREE.Mesh(con(0.038, 0.08, 4), mat(0x9aa4b2));
        ear.position.set(sd * 0.06, 0.32, 0.09); g.add(ear);
      });
      const tail = new THREE.Mesh(tor(0.07, 0.018, 5, 10, 4.2), mat(0x8a94a2));
      tail.position.set(0, 0.16, -0.14); tail.rotation.x = 1.2; g.add(tail);
      [-0.04, 0.04].forEach(ex => {
        const eye = new THREE.Mesh(sph(0.014, 5, 4), mat(0x35322f));
        eye.position.set(ex, 0.25, 0.2); g.add(eye);
      });
    } else {   // bear
      const body = new THREE.Mesh(sph(0.15, 9, 7), mat(0xb5793f));
      body.position.y = 0.15; g.add(body);
      const head = new THREE.Mesh(sph(0.11, 9, 7), mat(0xb5793f));
      head.position.y = 0.34; g.add(head);
      [-1, 1].forEach(sd => {
        const ear = new THREE.Mesh(sph(0.04, 6, 5), mat(0x9a6332));
        ear.position.set(sd * 0.09, 0.42, 0); g.add(ear);
      });
      const muzzle = new THREE.Mesh(sph(0.05, 6, 5), mat(0xe8cfa8));
      muzzle.scale.z = 0.7; muzzle.position.set(0, 0.31, 0.09); g.add(muzzle);
      [-0.045, 0.045].forEach(ex => {
        const eye = new THREE.Mesh(sph(0.014, 5, 4), mat(0x35322f));
        eye.position.set(ex, 0.37, 0.09); g.add(eye);
      });
    }
    return refine(g);
  }

  /* ---------- 舞台摆放占用方向（房屋 / 长椅 / 路灯，由 index 传入）
          Occupied directions for stage placement (houses / benches / lamps, passed in by index) ---------- */
  const occupiedDirs = D.occupiedProps.slice();

  // 光柱几何体：尖端在原点、向上张开（挂在 pivot 上用旋转瞄准）
  // Beam geometry: apex at origin opening upward (aimed by rotating its pivot)
  const beamGeo = new THREE.ConeGeometry(0.15, 2.6, 8, 1, true);
  beamGeo.rotateX(Math.PI); beamGeo.translate(0, 1.3, 0);

  function makeNote(color) {
    const n = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color, transparent: true });
    const head = new THREE.Mesh(sph(0.075, 6, 5), m);
    head.scale.set(1.15, 0.85, 0.9);
    const stem = new THREE.Mesh(cyl(0.016, 0.016, 0.24, 4), m);
    stem.position.set(0.06, 0.14, 0);
    const flag = new THREE.Mesh(box(0.09, 0.05, 0.02), m);
    flag.position.set(0.105, 0.22, 0);
    n.add(head); n.add(stem); n.add(flag);
    return n;
  }

  function makeStage(idx) {
    const g = new THREE.Group();
    // 自适应降级：tier 越大，单台细节越少（环绕音符/喷泉/彩灯/气球/观众/阴影）
    // LOD tiering: higher tier = fewer details per stage (orbit notes / fountains / bulbs / balloons / fans / shadows)
    const orbitNoteCount = tier === 0 ? 3 : tier === 1 ? 2 : 0;
    const fountainNote = tier === 0 ? 3 : tier === 1 ? 2 : 1;
    const keepElfPet = tier === 0;
    const castSh = tier < 2;
    const cIdx = idx % STAGE_COLORS.length;
    const main = STAGE_COLORS[cIdx];
    const alt = STAGE_COLORS[(cIdx + 3) % STAGE_COLORS.length];
    // 舞台外形轮换（variant）+ 台面半径微差，让每座舞台形状/大小不尽相同
    // Rotating stage shape (variant) + slight platform-radius jitter so no two stages look identical
    const variant = idx % 3;
    const platR = 1.0 + (idx % 4) * 0.05;   // 1.00 ~ 1.15
    const put = (m, x, y, z) => { m.position.set(x, y, z); g.add(m); return m; };
    const bulbs = (n, y, rr) => {
      n = tier === 2 ? Math.min(n, 4) : tier === 1 ? Math.min(n, 6) : n;   // 降级：减少彩灯数 · LOD: fewer bulbs
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        const bc = [0xfff1a8, 0xff9ac2, 0x9adfff][i % 3];
        put(new THREE.Mesh(sph(0.05, 6, 5), mat(bc, { emissive: bc, emissiveIntensity: 0.55 })), Math.cos(a) * rr, y, Math.sin(a) * rr);
      }
    };
    if (variant === 0) {
      // 圆形舞台：拱门 + 彩旗 + 帐篷尖顶 · Round stage: arch + bunting + tent spire
      put(new THREE.Mesh(cyl(platR, platR + 0.17, 0.26, 12), mat(main)), 0, 0.13, 0);
      put(new THREE.Mesh(cyl(platR - 0.08, platR - 0.08, 0.05, 12), mat(0xfdf6e8)), 0, 0.28, 0);
      bulbs(10, 0.32, platR - 0.05);
      [-1.0, 1.0].forEach(px => put(new THREE.Mesh(cyl(0.07, 0.09, 1.6, 6), mat(0x8a5a3b)), px, 0.8, -0.75));
      put(new THREE.Mesh(box(2.35, 0.13, 0.15), mat(0x8a5a3b)), 0, 1.62, -0.75);
      for (let i = 0; i < 7; i++) {
        const flag = new THREE.Mesh(con(0.09, 0.22, 4), mat(STAGE_COLORS[(i + cIdx) % 6]));
        flag.rotation.x = Math.PI; put(flag, -0.96 + i * 0.32, 1.46, -0.75);
      }
      put(new THREE.Mesh(con(1.5, 0.8, 8), mat(alt)), 0, 2.2, -0.75);
      put(new THREE.Mesh(sph(0.1, 6, 5), mat(0xffd94f, { emissive: 0xa8862e, emissiveIntensity: 0.5 })), 0, 2.66, -0.75);
    } else if (variant === 1) {
      // 六角舞台：中央高尖塔 + 两侧立柱挂灯球 · Hex stage: central spire + side columns with light globes
      put(new THREE.Mesh(cyl(platR + 0.05, platR + 0.2, 0.3, 6), mat(main)), 0, 0.15, 0);
      put(new THREE.Mesh(cyl(platR - 0.05, platR - 0.05, 0.05, 6), mat(0xfdf6e8)), 0, 0.31, 0);
      bulbs(6, 0.35, platR);
      put(new THREE.Mesh(con(1.15, 1.7, 6), mat(alt)), 0, 2.0, -0.7);
      put(new THREE.Mesh(sph(0.14, 8, 6), mat(0xffd94f, { emissive: 0xa8862e, emissiveIntensity: 0.5 })), 0, 2.95, -0.7);
      [-1.2, 1.2].forEach(px => {
        put(new THREE.Mesh(cyl(0.06, 0.08, 1.9, 6), mat(0x8a5a3b)), px, 0.95, -0.7);
        put(new THREE.Mesh(sph(0.12, 7, 6), mat(STAGE_COLORS[(cIdx + 2) % 6], { emissive: STAGE_COLORS[(cIdx + 2) % 6], emissiveIntensity: 0.4 })), px, 1.95, -0.7);
      });
    } else {
      // 方形舞台：背景横幅墙 + 双柱 + 顶部星形饰 · Square stage: backdrop banner + twin columns + star toppers
      put(new THREE.Mesh(box(platR * 1.9, 0.28, platR * 1.9), mat(main)), 0, 0.14, 0);
      put(new THREE.Mesh(box(platR * 1.7, 0.05, platR * 1.7), mat(0xfdf6e8)), 0, 0.3, 0);
      bulbs(12, 0.34, platR * 0.95);
      put(new THREE.Mesh(box(2.2, 1.5, 0.14), mat(alt)), 0, 1.05, -0.95);
      [-1.05, 1.05].forEach(px => put(new THREE.Mesh(cyl(0.07, 0.07, 2.3, 6), mat(0x8a5a3b)), px, 1.15, -0.95));
      put(new THREE.Mesh(con(0.4, 0.5, 5), mat(0xffd94f, { emissive: 0xa8862e, emissiveIntensity: 0.5 })), 0, 2.0, -0.95);
      const sTop2 = new THREE.Mesh(con(0.4, 0.5, 5), mat(0xffd94f, { emissive: 0xa8862e, emissiveIntensity: 0.5 }));
      sTop2.rotation.x = Math.PI; put(sTop2, 0, 2.25, -0.95);
    }
    // 前排音响 · Front-row speakers
    [-0.85, 0.85].forEach(px => {
      const sp = new THREE.Mesh(box(0.28, 0.44, 0.26), mat(0x4d4a55));
      sp.position.set(px, 0.22, 0.95); g.add(sp);
      const ring = new THREE.Mesh(cyl(0.09, 0.09, 0.04, 8), mat(0x2e2c33));
      ring.rotation.x = Math.PI / 2; ring.position.set(px, 0.32, 1.09); g.add(ring);
    });
    // 灯塔 x2：一根射彩色光柱，另一根喷上升音符（左右随台子奇偶互换）
    // 部分舞台（每 noBeamEvery 台留 1 台）不放光柱，两座灯塔都改喷音符
    // Two lamp towers: one shoots colored beams, the other sprays rising notes (sides swap by parity).
    // Every noBeamEvery-th stage drops beams entirely -- both towers spray notes instead.
    const hasBeam = !C.stage.noBeamEvery || idx % C.stage.noBeamEvery !== C.stage.noBeamEvery - 1;
    const beams = [], fountains = [];
    [-0.95, 0.95].forEach((px, si) => {
      const tower = new THREE.Mesh(cyl(0.045, 0.06, 1.5, 5), mat(0x4d4a55));
      tower.position.set(px, 0.75, -1.05); g.add(tower);
      const head = new THREE.Mesh(sph(0.11, 6, 5), mat(0x35322f));
      head.position.set(px, 1.55, -1.05); g.add(head);
      if (hasBeam && (idx + si) % 2 === 0) {
        const pivot = new THREE.Group();
        pivot.position.set(px, 1.55, -1.05);
        const beamCol = [0xff8ac2, 0x8ae0ff, 0xffe28a, 0xc2ff8a][(idx + si) % 4];
        // 逐束随机粗细与亮度：宽度 0.6~1.8（x/z 缩放共用锥形几何）；opacity 基数 0.12~0.42；闪幅 0.06~0.22
        // Per-beam random width & brightness: width 0.6~1.8 (shared cone scaled on x/z); base opacity 0.12~0.42; flicker amp 0.06~0.22
        const beamW = 0.6 + rand() * 1.2;
        const beamBase = 0.12 + rand() * 0.30;
        const beamAmp = 0.06 + rand() * 0.16;
        const bm = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: beamCol, transparent: true, opacity: beamBase, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        bm.scale.set(beamW, 1, beamW);
        bm.userData.beamBase = beamBase;
        bm.userData.beamAmp = beamAmp;
        pivot.add(bm);
        pivot.rotation.x = 0.55;
        pivot.rotation.z = px > 0 ? -0.35 : 0.35;
        g.add(pivot);
        beams.push(pivot);
      } else {
        // 音符喷泉：3 只大音符从灯头轮流升起、顶部淡出
        // Note fountain: 3 big notes rise from the lamp head in turn and fade out at the top
        const note = new THREE.Group();
        note.position.set(px, 1.6, -1.05);
        for (let i = 0; i < fountainNote; i++) {
          const nt = makeNote(noteColors[(idx + i) % 4]);
          nt.scale.setScalar(1.7);
          nt.userData.off = i / fountainNote;   // 相位错开 · staggered phases
          nt.userData.dx = (i - (fountainNote - 1) / 2) * 0.16;
          note.add(nt);
        }
        g.add(note);
        fountains.push(note);
      }
    });
    // 主唱精灵（台上旋转）· Lead-singer elf (spins on stage)
    const star = makeElf(STAGE_COLORS[(idx + 1) % 6]);
    star.scale.setScalar(1.15);
    star.position.set(0, 0.3, -0.25);
    g.add(star);
    // 观众：2 个人类村民 + （偶数台 1 只精灵 / 奇数台 2 只小动物），在台前扇形站位
    // Audience: 2 human villagers + (even idx: 1 elf / odd idx: 2 pets), fanned out in front of the stage
    const fans = [];
    C.fanSpacing.persons.forEach(([fa2, r2], i) => {
      const fp = makePerson(STAGE_COLORS[(idx + i + 1) % 6], C.hairColors[(idx + i) % 3]).g;
      fp.scale.setScalar(0.75);
      fp.position.set(Math.sin(fa2) * r2, 0, Math.cos(fa2) * r2 + 0.1);
      fp.rotation.y = Math.PI - fa2 * 0.6;
      g.add(fp); fans.push(fp);
    });
    if (keepElfPet) {
      if (idx % 2 === 0) {
        const fan = makeElf(STAGE_COLORS[Math.floor(rand() * 6)]);
        fan.scale.setScalar(0.9);
        fan.position.set(C.fanSpacing.elf[0], 0.05, C.fanSpacing.elf[1]);
        fan.rotation.y = Math.PI;
        g.add(fan); fans.push(fan);
      } else {
        C.fanSpacing.pets.forEach(([fa2, r2], i) => {
          const pet = makePet(PET_KINDS[(idx + i) % 3]);
          pet.position.set(Math.sin(fa2) * r2, 0, Math.cos(fa2) * r2 + 0.1);
          pet.rotation.y = Math.PI - fa2;
          g.add(pet); fans.push(pet);
        });
      }
    }
    // 环绕漂浮的音符 · Orbiting floating notes
    const notesHolder = new THREE.Group();
    notesHolder.position.set(0, 2.75, 0);
    for (let i = 0; i < orbitNoteCount; i++) {
      const nt = makeNote(noteColors[(idx + i) % 4]);
      const na = orbitNoteCount ? i / orbitNoteCount * Math.PI * 2 : 0;
      nt.position.set(Math.cos(na) * 1.5, Math.sin(i * 2.1) * 0.35, Math.sin(na) * 1.5);
      nt.rotation.y = rand() * 6.28;
      notesHolder.add(nt);
    }
    g.add(notesHolder);
    // 气球（拱门两端）· Balloons (both ends of the arch)
    const balloons = [];
    (tier < 2 ? [-0.95, 0.95] : [0.95]).forEach((px, bi) => {
      const bl = new THREE.Group();
      const ball = new THREE.Mesh(sph(0.13, 7, 6), mat(STAGE_COLORS[(idx + bi + 2) % 6], { roughness: 0.5 }));
      ball.scale.y = 1.15;
      const string = new THREE.Mesh(cyl(0.008, 0.008, 0.42, 4), mat(0xfdf6e8));
      string.position.y = -0.28;
      bl.add(ball); bl.add(string);
      bl.position.set(px, 1.95, -0.75);
      g.add(bl); balloons.push(bl);
    });
    // 投影（跳过半透明光柱/音符）· Shadows (skip translucent beams / notes)
    g.traverse(o => {
      if (o.isMesh && o.material && !o.material.transparent) { o.castShadow = castSh; o.receiveShadow = castSh; }
    });
    return { g, beams, fountains, star, fans, notesHolder, balloons };
  }

  const stages = [];
  const FRONT_RING_COLAT = 4.7 / MAXR * MAXCOLAT;   // 正面石板环路的球心角（花车航线）· central angle of the front ring road (float lane)
  // 均匀摆放：等纬度间距 + 黄金角经度推进的球面螺旋，天然彼此等距；
  // 压花车禁带的点沿纬度推出禁带，与房屋/长椅冲突的点沿经度平移修复
  // Even placement: spherical spiral with equal latitude spacing + golden-angle longitude steps -- naturally equidistant;
  // points on the float keep-out band get pushed out in latitude, house/bench conflicts get fixed by longitude shifts
  const spiralDirs = () => {
    const out = [];
    for (let i = 0; i < stageCount; i++) {
      const lat = Math.asin(-1 + 2 * (i + 0.5) / stageCount) / D2R;   // ≈ ±75°，等纬度间距 · ≈ ±75°, equal latitude steps
      const lon = 137.508 * i;                                            // 黄金角推进 · golden-angle progression
      out.push({ lat, lon: ((lon + 180) % 360 + 360) % 360 - 180, d: dirLatLon(lat, lon) });
    }
    return out;
  };
  const laneFree = lat => {
    const colat = (90 - lat) * D2R;
    if (Math.abs(colat - FRONT_RING_COLAT) < C.stage.ringMargin) return false;   // 避开正面花车航线（含裕量）· keep off the front float lane (with margin)
    if (Math.abs(lat + 8) < C.stage.backBand) return false;                       // 避开背面花车巡游带（含裕量）· keep off the back parade band (with margin)
    return true;
  };
  const escapeLat = p => {
    let lat = p.lat;
    const ringDeg = FRONT_RING_COLAT / D2R;                          // 环路带中心 ≈ 32.3° colat · ring lane center ≈ 32.3° colat
    if (Math.abs(90 - lat - ringDeg) < C.stage.backBand) lat = (90 - lat < ringDeg ? 90 - (ringDeg - C.stage.backBand) : 90 - (ringDeg + C.stage.backBand)) - 0.4;
    if (Math.abs(lat + 8) < C.stage.backBand) lat = lat > -8 ? 1.4 : -18.4;
    return lat;
  };
  const spiral = [];
  spiralDirs().forEach(p0 => {
    const lat = escapeLat(p0);
    const p = { lat, lon: p0.lon, d: dirLatLon(lat, p0.lon) };
    const hardOk = c => laneFree(c.lat) &&
      occupiedDirs.every(o => c.d.angleTo(o) >= C.stage.avoidProps) &&
      spiral.every(q => c.d.angleTo(q.d) >= C.stage.minSpacing);
    if (hardOk(p)) { spiral.push(p); return; }
    let placed = false;
    for (let d = 4; d <= 60 && !placed; d += 2) {                     // 冲突：沿经度就近平移，必要时辅以纬度微偏 · conflict: nudge in longitude (with slight latitude offsets if needed)
      for (const s of [1, -1]) {
        for (const la of [0, -4, 4, -8, 8]) {
          const plat = p.lat + la;
          if (Math.abs(plat) > 75.5) continue;
          const lon = ((p.lon + s * d + 180) % 360 + 360) % 360 - 180;
          const c = { lat: plat, lon, d: dirLatLon(plat, lon) };
          if (hardOk(c)) { spiral.push(c); placed = true; break; }
        }
        if (placed) break;
      }
    }
    if (!placed) spiral.push(p);   // 保证台数=DB条数：实在找不到空位也用原始螺旋点兜底 · stage count must equal DB rows: fall back to the raw spiral point
  });
  spiral.forEach(p => {
    const st = makeStage(stages.length);
    const sizeJit = 0.85 + rand() * 0.3;   // 每座舞台大小微差（0.85~1.15），叠加统一缩小系数 · per-stage size jitter on top of the global scale
    st.sizeScale = C.stage.scale * sizeJit;
    st.g.scale.setScalar(st.sizeScale);
    st.pick = new THREE.Mesh(pickGeo, pickMat);   // 不可见拾取代理（材质 visible:false 不渲染，仅供射线命中）· invisible pick proxy (never rendered, raycast target only)
    st.pick.userData.stageIdx = stages.length;
    st.g.add(st.pick);
    st.d = placeLat(st.g, p.lat, p.lon, rand() * 6.28);
    st.phase = rand() * 6.28;
    const blobSize = 2.5 * st.sizeScale; // 投影随舞台大小同步 · contact shadow scales with the stage
    st.blob = makeBlob(blobSize);
    st.blob.userData.size = blobSize;
    updateBlob(st.blob, st.d, 0.03);
    stages.push(st);
    occupiedDirs.push(p.d);
  });
  const pickTargets = stages.map(s => s.pick);   // 供射线检测复用的固定数组 · fixed array reused by raycasting

  /* ---------- 花车巡游（石板环路上空 + 环球大圆航线）· Parade floats (over the ring road + global great-circle route) ---------- */
  function makeFloat(idx) {
    const g = new THREE.Group();
    const main = STAGE_COLORS[idx % 6], alt = STAGE_COLORS[(idx + 2) % 6];
    const wheels = [], riders = [], balloons = [];
    // 底盘 + 彩色裙边 · chassis + colored skirt
    const chassis = new THREE.Mesh(box(1.0, 0.26, 1.9), mat(0xfdf6e8));
    chassis.position.y = 0.62; g.add(chassis);
    const skirt = new THREE.Mesh(box(1.12, 0.16, 2.02), mat(main));
    skirt.position.y = 0.44; g.add(skirt);
    // 车轮 x4（wheelGeo 已在 init 作用域共享并预旋转到 X 轴向）· wheels x4 (shared wheelGeo, pre-rotated to X axis)
    [[-0.58, 0.62], [0.58, 0.62], [-0.58, -0.62], [0.58, -0.62]].forEach(([wx, wz]) => {
      const w = new THREE.Mesh(wheelGeo, mat(0x8a5a3b));
      w.position.set(wx, 0.24, wz); g.add(w); wheels.push(w);
    });
    // 四根立柱 · four corner posts
    [[-0.45, 0.8], [0.45, 0.8], [-0.45, -0.8], [0.45, -0.8]].forEach(([px, pz]) => {
      const pole = new THREE.Mesh(cyl(0.035, 0.035, 0.9, 5), mat(alt));
      pole.position.set(px, 1.2, pz); g.add(pole);
    });
    // 层叠蛋糕顶棚（三层交替色 + 顶球）· tiered cake canopy (3 alternating layers + top ball)
    [[0.82, 0.18, 1.78, main], [0.64, 0.16, 1.95, 0xffffff], [0.46, 0.15, 2.1, alt]].forEach(([r, h, y, c]) => {
      const layer = new THREE.Mesh(cyl(r, r, h, 10), mat(c));
      layer.position.y = y; g.add(layer);
    });
    const topBall = new THREE.Mesh(sph(0.11, 6, 5), mat(0xffd94f, { emissive: 0xa8862e, emissiveIntensity: 0.5 }));
    topBall.position.y = 2.28; g.add(topBall);
    // 车头大花 · big flower on the prow
    (function () {
      const flower = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const petal = new THREE.Mesh(sph(0.09, 6, 5), mat(i % 2 ? 0xffffff : alt));
        const pa = i / 6 * Math.PI * 2;
        petal.position.set(Math.cos(pa) * 0.13, Math.sin(pa) * 0.13, 0);
        petal.scale.z = 0.5; flower.add(petal);
      }
      const core = new THREE.Mesh(sph(0.07, 6, 5), mat(0xffd94f));
      flower.add(core);
      flower.position.set(0, 0.62, 1.06); g.add(flower);
    })();
    // 两侧彩旗 · side bunting
    [-1, 1].forEach(sd => {
      for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(con(0.07, 0.16, 4), mat(STAGE_COLORS[(idx + i) % 6]));
        f.rotation.x = Math.PI;
        f.position.set(sd * 0.58, 1.05 - i * 0.13, -0.66 + i * 0.44);
        g.add(f);
      }
    });
    // 车上人物 x2（站在车板上的小人）· riders x2 (little people standing on the deck)
    [[-0.22, 0.35], [0.22, -0.25]].forEach(([px, pz], i) => {
      const rd = makePerson(STAGE_COLORS[(idx + i + 3) % 6], C.hairColors[(idx + i) % 3]).g;
      rd.scale.setScalar(0.8);
      rd.position.set(px, 0.75, pz);
      rd.userData.baseY = 0.75;
      g.add(rd); riders.push(rd);
    });
    // 车尾气球串 x3 · trailing balloon bunch x3
    [[-0.3, 0], [0, 0.25], [0.3, 0]].forEach(([bx, by], i) => {
      const bl = new THREE.Group();
      const ball = new THREE.Mesh(sph(0.11, 7, 6), mat(STAGE_COLORS[(idx + i + 4) % 6], { roughness: 0.5 }));
      ball.scale.y = 1.15;
      const str = new THREE.Mesh(cyl(0.007, 0.007, 0.5, 4), mat(0xfdf6e8));
      str.position.y = -0.3;
      bl.add(ball); bl.add(str);
      bl.position.set(bx, 2.0 + by, -1.1);
      g.add(bl); balloons.push(bl);
    });
    // 车尾拖行音符 x3 · trailing notes x3
    const trail = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const nt = makeNote(noteColors[(idx + i) % 4]);
      nt.position.set(Math.sin(i * 2.2) * 0.3, 1.1 - i * 0.3, -1.5 - i * 0.55);
      nt.userData.baseY = nt.position.y;
      trail.add(nt);
    }
    g.add(trail);
    g.traverse(o => { if (o.isMesh && o.material && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
    return { g, wheels, riders, balloons, trail };
  }

  const parades = [];
  function addFloat(idx, mode, a0, speed, lift) {
    const fl = makeFloat(idx);
    const rec = { g: fl.g, wheels: fl.wheels, riders: fl.riders, balloons: fl.balloons, trail: fl.trail, mode, a: a0, speed, lift, phase: rand() * 6.28 };
    rec.blob = makeBlob(1.9);
    rec.blob.userData.size = 1.9;
    planet.add(rec.g);
    parades.push(rec);
  }
  // 环球大圆航线：倾斜 CONFIG.globeTiltDeg 的轨道（穿过北中南三个纬度带，绕行一圈）
  // Global great-circle route: orbit tilted by CONFIG.globeTiltDeg, crossing north/mid/south latitude bands
  const GLOBE_TILT = C.globeTiltDeg * D2R;
  const globeAxis = new THREE.Vector3(0, Math.cos(GLOBE_TILT), Math.sin(GLOBE_TILT));   // 轨道面法线 · orbit plane normal
  const globeP = new THREE.Vector3(Math.sin(GLOBE_TILT), 0, -Math.cos(GLOBE_TILT));     // 轨道起点（单位向量）· orbit start point (unit vector)
  function globeDirAt(a) { return globeP.clone().applyAxisAngle(globeAxis, a).normalize(); }
  // 按 CONFIG.floats 逐航线投放：spread 时沿相位均匀分布，末 leader.count 辆低空飞行
  // Spawn per CONFIG.floats route: spread => even phase spacing; the last leader.count floats fly lower
  let floatIdx = 0;
  C.floats.forEach((cfg, ci) => {
    const n = cfg.count, dir = ci === 0 ? 1 : -1, leaderN = cfg.leader ? cfg.leader.count : 0;
    for (let i = 0; i < n; i++) {
      const isLeader = i >= n - leaderN;
      const speed = isLeader ? cfg.leader.speed : cfg.speed;
      const lift = isLeader ? cfg.leader.lift : cfg.lift;
      const a0 = cfg.spread ? dir * i * Math.PI * 2 / n : rand() * Math.PI * 2;
      addFloat(floatIdx++, cfg.route === 'ring' ? 'v' : 'globe', a0, speed, lift);
    }
  });

  /* ---------- 舞台信息：仅注入数据库演唱会数据（无数据不摆假台）
          Stage info: DB concert data only (never fabricate stages for missing data) ---------- */
  const stageInfos = D.stageInfos || [];
  function applyDbInfo(st, s) {
    st.info = {
      source: 'db', id: s.id, name: s.name || s.title || '',
      artist: s.artist || '', theme: s.theme || '',
      place: [s.country, s.province, s.city, s.venue].filter(Boolean).join(' · '),
      time: [s.date, s.time].filter(Boolean).join(' '),
      seat: s.seat || '',
      price: s.price || '', tags: Array.isArray(s.tags) ? s.tags : [],
      songs: (Array.isArray(s.songs) ? s.songs : []).map(x => typeof x === 'string' ? { name: x, link: '' } : { name: (x && (x.name || x.title)) || '', link: (x && x.link) || '' }).filter(x => x.name),
      video: s.video || '', videoUrl: s.videoUrl || '',
      likes: (s.likes | 0), liked: !!s.liked
    };
  }
  stages.forEach((st, i) => {
    st.g.userData.stageIdx = i;
    const s = stageInfos[i];
    if (!s) return;   // 台数=DB条数，正常每台都有数据；无数据（如加载失败）跳过，绝不显示假演唱会 · normally every stage has a row; on load failure skip rather than show a fake concert
    applyDbInfo(st, s);
  });

  /* ---------- UI 子模块组装（样式/DOM/事件均在各模块内完成）
          UI submodule wiring (styles / DOM / events all handled inside each module) ---------- */
  // L 是共享对象引用：setLang 用 Object.assign 原地突变，各模块调用时读取即可见新文案
  // L is a shared object reference: setLang mutates it in place via Object.assign; modules read it at call time
  const modal = createModal({ L });
  const card = createCard({ C, L, THREE, camera, dom, stages, modal });
  const hitTest = createHitTest({ D, THREE, dom, camera, stages, pickTargets, card });
  const marquee = createMarquee({ L, THREE, dom, camera, planet, stages });

  /* ---------- 每帧更新：舞台 + 花车动画 · Per-frame update: stages + float animation ---------- */
  function update(t, dt) {
    const A = C.anim;
    hitTest.tickHover();
    marquee.tick(t, dt);
    const facingOf = marquee.facingOf;
    // 演唱会舞台：光柱摇摆闪烁 + 音符喷泉上升 + 主唱旋转 + 观众蹦跳 + 音符环绕 + 气球浮动
    // Concert stages: beam sway/flicker + note-fountain rise + lead singer spin + audience bouncing + orbiting notes + floating balloons
    stages.forEach(st => {
      if (tier >= 1 && facingOf(st) <= 0) return;   // 背面剔除：背对相机的舞台跳过逐帧动画（省 CPU）· back-face culling: stages facing away skip per-frame animation (saves CPU)
      st.beams.forEach((pv, bi) => {
        pv.rotation.z = (pv.position.x > 0 ? -0.35 : 0.35) + Math.sin(t * A.beamSway + st.phase + bi * 1.7) * 0.3;
        const bm = pv.children[0];
        const base = bm.userData.beamBase || 0.2;
        const amp = bm.userData.beamAmp || 0.14;
        bm.material.opacity = base + amp * (0.5 + 0.5 * Math.sin(t * A.beamFlicker + st.phase + bi));
      });
      st.fountains.forEach((fo, fi) => {
        fo.children.forEach((nt, ni) => {
          const ph = ((t * A.fountainSpeed + nt.userData.off + st.phase + fi * 0.37) % 1 + 1) % 1;   // 0→1 循环 · 0→1 loop
          nt.position.y = ph * A.fountainHeight;
          nt.position.x = nt.userData.dx + Math.sin(ph * 9 + ni * 2) * 0.1;                          // 左右摇摆 · side-to-side sway
          nt.rotation.z = Math.sin(t * 2.2 + ni) * 0.3;
          nt.children.forEach(ch => { ch.material.opacity = ph < 0.15 ? ph / 0.15 : (ph > 0.8 ? (1 - ph) / 0.2 : 1); });
        });
      });
      st.star.rotation.y += dt * A.starSpin;
      st.fans.forEach((fa, fi) => {
        fa.position.y = Math.abs(Math.sin(t * A.fanBounce + st.phase + fi * 1.3)) * 0.16;
        fa.rotation.z = Math.sin(t * 3.2 + st.phase + fi) * 0.08;
      });
      st.notesHolder.rotation.y += dt * A.notesOrbit;
      st.notesHolder.position.y = 2.75 + Math.sin(t * 1.6 + st.phase) * 0.18;
      st.notesHolder.children.forEach(nt => { nt.rotation.y += dt; });
      st.balloons.forEach((bl, bi) => {
        bl.position.y = 1.95 + Math.sin(t * 1.5 + st.phase + bi * 2) * 0.1;
        bl.rotation.z = Math.sin(t * 1.2 + st.phase + bi) * 0.15;
      });
    });
    // 花车巡游：沿环线行进 + 车轮滚动 + 乘客颠簸 + 音符拖尾 + 气球摇曳
    // Parade floats: travel along the loop + rolling wheels + rider bobbing + note trail + swaying balloons
    parades.forEach(p => {
      p.a += p.speed * dt;
      let d1, d2;
      if (p.mode === 'v') {
        d1 = villageDir(Math.cos(p.a) * 4.7, Math.sin(p.a) * 4.7);
        d2 = villageDir(Math.cos(p.a + 0.06) * 4.7, Math.sin(p.a + 0.06) * 4.7);
      } else {
        d1 = globeDirAt(p.a);
        d2 = globeDirAt(p.a + 0.03);
      }
      const fwd = d2.sub(d1).normalize();
      const right = _right.crossVectors(d1, fwd).normalize();
      p.g.quaternion.setFromRotationMatrix(_mat4.makeBasis(right, d1, fwd));
      const lift = p.lift + Math.sin(t * 2 + p.phase) * 0.05;
      p.g.position.copy(d1).multiplyScalar(R + lift);
      updateBlob(p.blob, d1, lift);
      p.wheels.forEach(w => { w.rotation.x += dt * A.wheelSpin; });
      p.riders.forEach((rd, i) => {
        rd.position.y = rd.userData.baseY + Math.abs(Math.sin(t * A.riderBounce + p.phase + i * 1.4)) * 0.07;
        rd.rotation.y = Math.sin(t * 1.2 + p.phase + i) * 0.35;
      });
      p.trail.children.forEach((nt, i) => {
        nt.position.y = nt.userData.baseY + Math.sin(t * 2.4 + p.phase + i * 1.1) * 0.16;
        nt.rotation.z = Math.sin(t * 2 + i) * 0.35;
      });
      p.balloons.forEach((bl, i) => { bl.rotation.z = Math.sin(t * 1.3 + p.phase + i) * 0.14; });
    });
  }

  function dispose() {
    hitTest.dispose();   // 移除 pointerdown / pointerup / pointermove 三组监听 · remove the three pointer listener groups
    card.dispose();      // abort 在途点赞 + 摘除卡片与样式 · abort in-flight like + remove card & stylesheet
    modal.dispose();
    marquee.dispose();
  }

  // 语言切换：不重建几何体，仅刷新信息卡文案（L）与本地化数据（db 舞台的 st.info）
  // Language switch: no geometry rebuild, only refresh card copy (L) and localized data (st.info of db stages)
  function setLang(newLabels, newInfos) {
    if (newLabels) Object.assign(L, newLabels);
    if (Array.isArray(newInfos)) stages.forEach((st, i) => { if (newInfos[i]) applyDbInfo(st, newInfos[i]); });
    marquee.refreshContent();
    card.refresh();   // 若此刻有卡片正打开，就地重绘为新语言（否则它会停在旧语言直到重新打开）· repaint an open card in the new language
  }

  return { stages, parades, update, setLang, dispose, showCardById: card.showCardById };
}
