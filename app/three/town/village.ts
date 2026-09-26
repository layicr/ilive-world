// @ts-nocheck
/* =====================================================================
 * town/village.ts —— 星球小镇的村庄搭建：正/背面房屋、树、花草、道路、
 * 水井、喷泉、长椅、路灯、栅栏；输出演唱会舞台摆放需要避开的占用方向。
 * 自 planetTown.ts 逐段搬移，逻辑未变；几何构建顺序保持原样
 * （rand 为固定种子序列，任何重排都会改变画面）。
 * town/village.ts — village builder: front/back houses, trees, flowers, roads, well, fountains,
 * benches, lamps and fences; outputs the occupied directions stages must avoid.
 * Moved verbatim from planetTown.ts; logic unchanged. Geometry build order is preserved exactly
 * (rand is a fixed-seed sequence; any reordering would change the visuals).
 * ===================================================================== */
export function createVillage(ctx) {
  // 解构共享依赖 · destructure shared deps
  const { THREE, planet, R, UP, D2R, rand, mat, shadows, placeOnPlanet, placeLat, dirLatLon, villageDir: villageDirOf } = ctx;

  /* ---------- 小屋（位置 = 原图浮空岛版） · Houses (positions = source floating-island layout) ---------- */
  const ROOF_RED = 0xef5350, ROOF_BLUE = 0x4fa3e0, ROOF_YEL = 0xffb74d, ROOF_BROWN = 0xb5793f;
  const WALL = 0xf6efe0;
  // 公共部分：地基 + 方墙体 + 门窗（各房型共用）· Shared part: foundation + box walls + door/windows (common to all house types)
  function houseBase(roofColor, W, H, Dp) {
    const g = new THREE.Group();
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(W + 0.22, 0.28, Dp + 0.22), mat(0xb0a89a));
    foundation.position.y = 0.14; g.add(foundation);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(W, H, Dp), mat(WALL));
    walls.position.y = 0.28 + H / 2; g.add(walls);
    const eave = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.12, Dp + 0.3), mat(0xd8c8a8));
    eave.position.y = 0.28 + H; g.add(eave);
    // 门 + 门框 + 把手 · Door + frame + knob
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.67, 0.97, 0.07), mat(0xfdf8ec));
    doorFrame.position.set(0, 0.28 + 0.485, Dp / 2 + 0.015); g.add(doorFrame);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.09), mat(0x8a5a3b));
    door.position.set(0, 0.28 + 0.43, Dp / 2 + 0.04); g.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), mat(0xe3b83e, { metalness: 0.5, roughness: 0.4 }));
    knob.position.set(0.18, 0.28 + 0.45, Dp / 2 + 0.095); g.add(knob);
    // 前窗：白框 + 玻璃 + 窗台花箱（三色小花）· Front windows: white frame + glass + sill flower box (three tiny flowers)
    [-0.55, 0.55].forEach(wx => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.54, 0.05), mat(0xffffff));
      frame.position.set(wx, 0.28 + 0.88, Dp / 2 + 0.02); g.add(frame);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.06), mat(0xcfe9f4, { roughness: 0.3, emissive: 0xfff2c8, emissiveIntensity: 0.35 }));
      glass.position.set(wx, 0.28 + 0.88, Dp / 2 + 0.045); g.add(glass);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.16), mat(0x9a6b45));
      box.position.set(wx, 0.28 + 0.56, Dp / 2 + 0.1); g.add(box);
      [-0.13, 0, 0.13].forEach((fx, i) => {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), mat([0xf2919e, 0xf5d76e, 0xe89ab0][i]));
        flower.position.set(wx + fx, 0.28 + 0.68, Dp / 2 + 0.1); g.add(flower);
      });
    });
    // 侧面窗 · Side window
    const frame2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.5), mat(0xffffff));
    frame2.position.set(W / 2 + 0.02, 0.28 + 0.88, -0.4); g.add(frame2);
    const glass2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.38), mat(0xcfe9f4, { roughness: 0.3, emissive: 0xfff2c8, emissiveIntensity: 0.35 }));
    glass2.position.set(W / 2 + 0.045, 0.28 + 0.88, -0.4); g.add(glass2);
    return g;
  }
  // 人字顶山墙（原造型）· Gable roof (original shape)
  function gableRoof(g, roofColor, W, H, Dp) {
    const rs = new THREE.Shape();
    rs.moveTo(-1.32, 0); rs.lineTo(1.32, 0); rs.lineTo(0, 1.08); rs.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(rs, { depth: 2.62, bevelEnabled: false });
    roofGeo.translate(0, 0, -1.31);
    const roof = new THREE.Mesh(roofGeo, mat(roofColor));
    roof.position.y = 0.28 + H + 0.06; g.add(roof);
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.68, 6), mat(new THREE.Color(roofColor).offsetHSL(0, 0, -0.1)));
    ridge.rotation.x = Math.PI / 2; ridge.position.y = 0.28 + H + 1.14; g.add(ridge);
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.72, 0.28), mat(0xb8b0a4));
    chim.position.set(0.55, 0.28 + H + 0.74, 0.35); g.add(chim);
    const chimCap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), mat(0x8a8074));
    chimCap.position.set(0.55, 0.28 + H + 1.14, 0.35); g.add(chimCap);
  }
  // 圆顶房：半球穹顶 + 顶饰 + 环绕小窗 · Dome house: hemispherical cupola + finial + surrounding small windows
  function domeRoof(g, roofColor, W, H, Dp) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.35, 14, 8, 0, 6.283, 0, 1.6), mat(roofColor));
    dome.position.y = 0.28 + H + 0.06; g.add(dome);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.33, 0.06, 6, 20), mat(new THREE.Color(roofColor).offsetHSL(0, 0, -0.12)));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.28 + H + 0.1; g.add(rim);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), mat(0xffd94f, { metalness: 0.4, roughness: 0.4 }));
    finial.position.y = 0.28 + H + 1.44; g.add(finial);
    [-0.75, 0, 0.75].forEach(dx => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.06), mat(0xcfe9f4, { roughness: 0.3, emissive: 0xfff2c8, emissiveIntensity: 0.35 }));
      win.position.set(dx, 0.28 + 1.62, 1.15 - Math.abs(dx) * 0.45); win.rotation.x = -0.35; g.add(win);
    });
  }
  // 塔楼：八角身 + 高锥顶 + 锥尖小旗 · Tower: octagonal body + tall cone roof + tiny flag at the tip
  function towerRoof(g, roofColor) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.02, 2.5, 8), mat(WALL));
    body.position.y = 0.28 + 1.25; g.add(body);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.24, 1.6, 8), mat(roofColor));
    cone.position.y = 0.28 + 2.5 + 0.8; g.add(cone);
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 5), mat(0x8a5a3b));
    flagPole.position.y = 0.28 + 4.1 + 0.2; g.add(flagPole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.17, 0.02), mat(0xef5350));
    flag.position.set(0.16, 0.28 + 4.1 + 0.32, 0); g.add(flag);
    [1.25, 2.1].forEach(wy => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.06), mat(0xcfe9f4, { roughness: 0.3, emissive: 0xfff2c8, emissiveIntensity: 0.35 }));
      win.position.set(0, wy, 0.98); g.add(win);
      const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.05), mat(0xffffff));
      f2.position.set(0, wy, 0.95); g.add(f2);
    });
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.08), mat(0x8a5a3b));
    door.position.set(0, 0.68, 1.0); g.add(door);
  }
  // 双层小楼：两层墙体 + 人字顶 + 烟囱 + 二楼排窗 · Two-story house: two wall courses + gable roof + chimney + upper-row windows
  function twoStoryRoof(g, roofColor) {
    const W = 1.8, Dp = 2.0;
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(W, 1.15, Dp), mat(WALL));
    w1.position.y = 0.28 + 0.575; g.add(w1);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(W + 0.16, 0.1, Dp + 0.16), mat(0xd8c8a8));
    belt.position.y = 0.28 + 1.15; g.add(belt);
    const w2 = new THREE.Mesh(new THREE.BoxGeometry(W - 0.15, 0.9, Dp - 0.15), mat(WALL));
    w2.position.y = 0.28 + 1.2 + 0.45; g.add(w2);
    gableRoof(g, roofColor, W, 2.1, Dp);
    [0.65, 1.15].forEach(zy => {
      [-0.5, 0.5].forEach(wx => {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.06), mat(0xcfe9f4, { roughness: 0.3, emissive: 0xfff2c8, emissiveIntensity: 0.35 }));
        win.position.set(wx, zy + 0.53, Dp / 2 + 0.03); g.add(win);
      });
    });
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.82, 0.08), mat(0x8a5a3b));
    door.position.set(0, 0.28 + 0.41, Dp / 2 + 0.03); g.add(door);
  }
  function makeHouse(roofColor, type) {
    const W = 1.9, H = 1.35, Dp = 2.2;
    if (type === 'tower') { const g = new THREE.Group(); towerRoof(g, roofColor); return shadows(g); }
    if (type === 'two') { const g = new THREE.Group(); twoStoryRoof(g, roofColor); return shadows(g); }
    const g = houseBase(roofColor, W, H, Dp);
    if (type === 'dome') domeRoof(g, roofColor); else gableRoof(g, roofColor, W, H, Dp);
    return shadows(g);
  }
  const houses = [
    // [x, z, spin, 屋顶色, 缩放, 房型] · [x, z, spin, roof color, scale, house type]
    [-5.8, -1.6, 0.5, ROOF_RED, 1.0, 'gable'],
    [-4.6, 4.2, -0.6, ROOF_YEL, 1.05, 'dome'],
    [-1.2, -6.2, 0.15, ROOF_BLUE, 0.95, 'tower'],
    [3.6, -5.2, -0.4, ROOF_YEL, 1.0, 'two'],
    [6.4, -1.2, 1.35, ROOF_RED, 1.0, 'gable'],
    [5.2, 4.4, -1.1, ROOF_BROWN, 0.96, 'dome'],
    [0.6, 6.6, 0.1, ROOF_BLUE, 0.92, 'two'],
    [-7.2, 1.8, 0.9, ROOF_YEL, 0.92, 'tower'],
    [7.8, 2.7, -1.5, ROOF_BROWN, 0.85, 'gable'],
  ];
  houses.forEach(([x, z, spin, rc, s, type]) => {
    const h = makeHouse(rc, type);
    h.scale.setScalar(type === 'two' ? s * 0.82 : s);
    placeOnPlanet(h, x, z, spin);
  });

  /* ---------- 树（位置 = 原图；每 3 棵一轮换：1/3 高、1/3 矮、1/3 胖，颜色逐棵随机，静态不动） · Trees (positions = source; every 3 cycle 1/3 tall, 1/3 short, 1/3 fat, color randomized per tree, static) ---------- */
  // 常绿调色板：深绿/翠绿/青绿/橄榄等，让松树有不同的颜色 · Evergreen palette: dark green / emerald / teal / olive, giving pines varied colors
  const PINE_LEAVES = [0x2e8b47, 0x3aa257, 0x2f7d5a, 0x4cb86a, 0x6bbf59, 0x3f8f3f, 0x2e7d32, 0x5fa855];
  function pine(kind) {
    const g = new THREE.Group();
    // kind: 0=高(瘦高) 1=矮(小巧) 2=胖(宽矮)；每 3 棵一轮换，各占 1/3 · kind: 0=tall, 1=short, 2=fat; one per 3-cycle, each 1/3
    const P = kind === 0
      ? { th: 0.9, thj: 0.45, ly: 3, sp: 0.62, spj: 0.14, ta: 1.3, taj: 0.3 }
      : kind === 1
      ? { th: 0.4, thj: 0.18, ly: 2, sp: 0.72, spj: 0.16, ta: 0.6, taj: 0.18 }
      : { th: 0.5, thj: 0.2, ly: 2, sp: 1.3, spj: 0.3, ta: 0.85, taj: 0.22 };
    const trunkH = P.th + rand() * P.thj;                // 树干：高/矮/中 · trunk: tall/short/mid
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, trunkH, 7), mat(0x8a5a3b));
    trunk.position.y = trunkH / 2; g.add(trunk);
    const leaf = PINE_LEAVES[Math.floor(rand() * PINE_LEAVES.length)];
    const layers = P.ly + Math.floor(rand() * 2);        // 层数：高 3~4，矮/胖 2~3 · layers: tall 3~4, short/fat 2~3
    const spread = P.sp + rand() * P.spj;                // 冠幅：胖明显更宽 · canopy spread: fat ones clearly wider
    const tall = P.ta + rand() * P.taj;                  // 单层高度 → 整体高矮 · per-layer height -> overall tallness
    let y = trunkH + 0.28, r = 0.92 * spread;
    for (let i = 0; i < layers; i++) {
      const h = tall * (1 - i * 0.1);
      const shade = new THREE.Color(leaf).offsetHSL(0, 0, (i - (layers - 1) / 2) * 0.05).getHex();
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), mat(shade));
      c1.position.y = y + h / 2 - 0.15; g.add(c1);
      y += h * 0.62; r *= 0.7 + rand() * 0.08;
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16 * spread, 0.34, 7), mat(new THREE.Color(leaf).offsetHSL(0, 0, 0.08).getHex()));
    tip.position.y = y + 0.1; g.add(tip);
    return shadows(g);
  }
  [[-7.9, -2.9, 1.0], [2.2, -7.7, 0.9], [7.9, 4.1, 1.05], [8.3, -3.7, 0.85], [-3.1, -7.2, 0.95], [-8.4, 0.2, 0.8]].forEach(([x, z, s], i) => {
    const t = pine(i % 3); t.scale.setScalar(s);
    placeOnPlanet(t, x, z, rand() * 6.28);
  });

  // 花树调色板：粉/桃/紫/奶白等 · Blossom palette: pink / peach / purple / cream, etc.
  const BLOSSOM_COLORS = [0xffa5c6, 0xffb3d1, 0xf6a9e0, 0xffc4a8, 0xd9a7ff, 0xffe0ea];
  function blossom(kind) {
    const g = new THREE.Group();
    // kind: 0=高 1=矮 2=胖；cs 控制冠幅宽窄 · kind: 0=tall 1=short 2=fat; cs controls canopy width
    const trunkH = kind === 0 ? 1.25 + rand() * 0.35 : kind === 1 ? 0.6 + rand() * 0.2 : 0.82 + rand() * 0.22;
    const cs = kind === 0 ? 0.92 : kind === 1 ? 1.0 : 1.4;   // 高瘦 / 中 / 胖 · tall-slim / medium / fat
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, trunkH, 7), mat(0x93683f));
    trunk.position.y = trunkH / 2; g.add(trunk);
    const cy = trunkH + 0.42;                            // 花冠基准高度 · base height of the blossom canopy
    // 树枝 · Branches
    [[0.3, cy - 0.35, 0.1, 0.4], [-0.28, cy - 0.3, -0.12, 0.35]].forEach(([bx, by, bz, br]) => {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, br, 5), mat(0x93683f));
      branch.position.set(bx * cs, by, bz * cs); branch.rotation.z = bx > 0 ? -0.7 : 0.7;
      g.add(branch);
    });
    // 主花冠 + 周围花簇（随机花色 + 内外明暗；冠幅随 cs 缩放）· Main canopy + surrounding flower clusters (random color + inner/outer shading; spread scales with cs)
    const bcol = BLOSSOM_COLORS[Math.floor(rand() * BLOSSOM_COLORS.length)];
    const bshade = (dl) => new THREE.Color(bcol).offsetHSL(0, 0, dl).getHex();
    [[0, cy + 0.33, 0, 0.78, 0], [0.5, cy, 0.22, 0.56, 0.05], [-0.46, cy + 0.05, -0.16, 0.5, 0.05],
     [0.05, cy + 0.1, -0.42, 0.45, 0.05], [0.42, cy + 0.28, 0.4, 0.4, -0.03], [-0.4, cy + 0.38, 0.3, 0.38, -0.03]].forEach(([px, py, pz, r, dl]) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r * cs, 9, 7), mat(bshade(dl)));
      b.position.set(px * cs, py, pz * cs); g.add(b);
    });
    // 树下降花环 · Fallen-flower ring under the tree
    const ring = new THREE.Mesh(new THREE.CircleGeometry(0.85 * cs, 14), new THREE.MeshBasicMaterial({ color: bshade(0.1), transparent: true, opacity: 0.45 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
    return shadows(g);
  }
  const blossomDirs = [];
  [[-3.3, 6.1, 1.0], [3.1, 7.5, 0.95], [7.2, -5.5, 1.0], [-6.6, -4.9, 0.9]].forEach(([x, z, s], i) => {
    const t = blossom(i % 3); t.scale.setScalar(s);
    blossomDirs.push(placeOnPlanet(t, x, z, rand() * 6.28));
  });

  // 灌木与小花（位置 = 原图）· Shrubs & small flowers (positions = source)
  [[-6.3, 0.9], [1.5, -6.9], [6.9, 3.0], [-2.4, -6.1], [4.3, 6.9], [-5.4, 5.3]].forEach(([x, z]) => {
    const holder = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.36, 7, 6), mat(0x5ec250));
    b.scale.y = 0.75; b.position.y = 0.22; holder.add(b);
    placeOnPlanet(shadows(holder), x, z, rand() * 6.28);
  });
  const flowerColors = [0xff8a98, 0xffd94f, 0xffffff, 0xff92b8];
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2, r = 2.4 + rand() * 6.4;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 5), mat(0x54b83e));
    stem.position.y = 0.13; g.add(stem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), mat(flowerColors[i % 4]));
    head.position.y = 0.29; g.add(head);
    placeOnPlanet(g, x, z, rand() * 6.28, 0.1);
  }

  // 下半球岩石（点缀球底）· Rocks on the lower hemisphere (accent the globe's underside)
  for (let i = 0; i < 8; i++) {
    const lat = -(62 + rand() * 25) * Math.PI / 180, lon = rand() * Math.PI * 2;
    const n = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + rand() * 0.35), mat(0x9a938a));
    rock.position.copy(n).multiplyScalar(R + 0.15);
    rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    planet.add(rock);
  }

  // 草丛（正反面，三两成簇）· Grass tufts (front & back, in clusters of two or three)
  const tuftGeo = new THREE.ConeGeometry(0.09, 0.34, 5);
  for (let i = 0; i < 26; i++) {
    const holder = new THREE.Group();
    const n2 = 2 + Math.floor(rand() * 2);
    for (let j = 0; j < n2; j++) {
      const blade = new THREE.Mesh(tuftGeo, mat(j % 2 ? 0x54b83e : 0x6faf5e));
      blade.position.set((rand() - 0.5) * 0.18, 0.16, (rand() - 0.5) * 0.18);
      blade.rotation.z = (rand() - 0.5) * 0.4;
      blade.castShadow = true;
      holder.add(blade);
    }
    if (i < 14) placeOnPlanet(holder, (rand() - 0.5) * 17, (rand() - 0.5) * 17, rand() * 6.28, 0.05);
    else placeLat(holder, -(10 + rand() * 45), rand() * 360 - 180, rand() * 6.28, 0.05);
  }

  /* ---------- 石板路：环形主路 + 通向小屋岔路（位置 = 原图） · Cobblestone road: ring main path + branches to houses (positions = source) ---------- */
  const stoneGeo = new THREE.CylinderGeometry(0.34, 0.38, 0.12, 7);
  function stone(x, z, s) {
    const holder = new THREE.Group();
    const st = new THREE.Mesh(stoneGeo, mat(new THREE.Color(0xcfc9bb).offsetHSL(0, 0, (rand() - 0.5) * 0.08)));
    st.scale.setScalar(s); st.position.y = 0.05; st.rotation.y = rand() * 6.28;
    holder.add(st);
    placeOnPlanet(shadows(holder), x, z, 0, 0.04);
  }
  for (let a = 0; a < Math.PI * 2; a += 0.21) {
    const r = 4.7 + Math.sin(a * 3) * 0.28;
    stone(Math.cos(a) * r, Math.sin(a) * r, 0.75 + rand() * 0.4);
  }
  houses.forEach(([hx, hz]) => {
    const len = Math.hypot(hx, hz);
    const dir = new THREE.Vector2(hx, hz).normalize();
    for (let d = 5.05; d < len - 1.3; d += 0.72) {
      stone(dir.x * d + (rand() - 0.5) * 0.25, dir.y * d + (rand() - 0.5) * 0.25, 0.62 + rand() * 0.3);
    }
  });

  /* ---------- 水井（中央，位置 = 原图 1.6, 1.0） · Well (center, position = source 1.6, 1.0) ---------- */
  (function () {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.82, 0.75, 10), mat(0xb9b2a4));
    base.position.y = 0.375; g.add(base);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.58, 12), mat(0x55b4ec, { emissive: 0x225588 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.76; g.add(water);
    [-0.6, 0.6].forEach(px => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.05, 6), mat(0x8a5a3b));
      post.position.set(px, 1.28, 0); g.add(post);
    });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.15, 6), mat(0x93683f));
    bar.rotation.z = Math.PI / 2; bar.position.y = 1.5; g.add(bar);
    // 辘轳摇柄 · Windlass crank
    const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5), mat(0x93683f));
    crank.rotation.z = Math.PI / 2.6; crank.position.set(0.72, 1.42, 0); g.add(crank);
    // 井绳 + 吊桶 · Rope + hanging bucket
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 5), mat(0xd8c8a0));
    rope.position.y = 1.2; g.add(rope);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.16, 8), mat(0x8a5a3b));
    bucket.position.y = 0.86; g.add(bucket);
    const bucketWater = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), mat(0x55b4ec));
    bucketWater.rotation.x = -Math.PI / 2; bucketWater.position.y = 0.94; g.add(bucketWater);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.08, 0.58, 4), mat(ROOF_RED));
    roof.position.y = 2.1; roof.rotation.y = Math.PI / 4; g.add(roof);
    placeOnPlanet(g, 1.6, 1.0, 0);
  })();

  /* ---------- 喷泉 ×3（广场等边三角均布，避开中央水井 / 长椅 / 路灯 / 房屋） · Fountains x3 (evenly placed as an equilateral triangle on the plaza, avoiding the central well / bench / lamp / houses) ---------- */
  function fountainMesh() {
    const g = new THREE.Group();
    const stone = mat(0xcfc7b5), stoneDark = mat(0xb9b2a4);
    const waterMat = mat(0x5ab6ee, { transparent: true, opacity: 0.85, emissive: 0x225588, roughness: 0.2 });
    const jetMat = mat(0xbfeaff, { transparent: true, opacity: 0.5 });
    // 下层大池 + 水面 + 石沿 · Lower basin + water surface + stone rim
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.02, 0.28, 16), stone);
    pool.position.y = 0.16; g.add(pool);
    const poolWater = new THREE.Mesh(new THREE.CircleGeometry(0.82, 16), waterMat);
    poolWater.rotation.x = -Math.PI / 2; poolWater.position.y = 0.31; g.add(poolWater);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.08, 8, 20), stoneDark);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.3; g.add(rim);
    // 中央台柱 + 上层小碗 + 碗中水面 · Central pedestal + upper bowl + bowl water surface
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.72, 10), stone);
    pedestal.position.y = 0.64; g.add(pedestal);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.28, 0.16, 14), stone);
    bowl.position.y = 1.02; g.add(bowl);
    const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(0.36, 14), waterMat);
    bowlWater.rotation.x = -Math.PI / 2; bowlWater.position.y = 1.1; g.add(bowlWater);
    // 顶部喷水头 + 金色顶饰 + 中心水柱 · Top nozzle + golden finial + central water jet
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.18, 8), stoneDark);
    nozzle.position.y = 1.22; g.add(nozzle);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0xe3b83e, { metalness: 0.4, roughness: 0.5 }));
    finial.position.y = 1.4; g.add(finial);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.24, 6), jetMat);
    jet.position.y = 1.53; g.add(jet);
    // 碗沿洒落的弧形水流（六股细锥，落到大池）· Arced water streams spilling from the bowl rim (six thin cones landing in the basin)
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.82, 5), jetMat);
      stream.position.set(Math.cos(a) * 0.36, 0.72, Math.sin(a) * 0.36);
      stream.rotation.z = Math.cos(a) * 0.5; stream.rotation.x = -Math.sin(a) * 0.5;
      g.add(stream);
    }
    // 仅石质部分投影，透明水体不投影（避免黑色方块阴影）· Only stone casts shadows; transparent water does not (avoids black box shadows)
    g.traverse(o => { if (o.isMesh && o.material && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  // 广场半径≈ 3.1 的三个均布点（60°/180°/300°），都在石板环路（半径4.7）内侧
  // Three even points at plaza radius ~3.1 (60°/180°/300°), all inside the cobbled ring road (radius 4.7)
  const fountainDirs = [];
  [[1.55, 2.69], [-3.1, 0], [1.55, -2.69]].forEach(([x, z]) => {
    fountainDirs.push(placeOnPlanet(fountainMesh(), x, z, 0));
  });

  /* ---------- 长椅（-2.7, 2.6） · Bench (-2.7, 2.6) ---------- */
  (function () {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.1, 0.44), mat(0x9a6b45));
    seat.position.y = 0.45; g.add(seat);
    [-0.55, 0.55].forEach(px => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.45, 0.38), mat(0x7c5836));
      leg.position.set(px, 0.22, 0); g.add(leg);
    });
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.42, 0.08), mat(0x9a6b45));
    back.position.set(0, 0.82, -0.22); back.rotation.x = -0.12; g.add(back);
    placeOnPlanet(g, -2.7, 2.6, 0.65);
  })();

  /* ---------- 路灯（3.7, -1.5） · Street lamp (3.7, -1.5) ---------- */
  (function () {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 2.35, 7), mat(0x4d4a55));
    post.position.y = 1.17; g.add(post);
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.36), mat(0xffe9a8, { emissive: 0xffd27a, emissiveIntensity: 0.8 }));
    lantern.position.y = 2.5; g.add(lantern);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.28, 4), mat(0x4d4a55));
    cap.position.y = 2.85; cap.rotation.y = Math.PI / 4; g.add(cap);
    const light = new THREE.PointLight(0xffd9a0, 0.7, 11);
    light.position.y = 2.5; g.add(light);
    placeOnPlanet(g, 3.7, -1.5, 0);
  })();

  /* ---------- 木栅栏（逐柱贴球面，位置 = 原图三段） · Wooden fence (posts fitted to the sphere one by one, positions = three source segments) ---------- */
  function fence(x1, z1, x2, z2, dirFn) {
    const dir = dirFn || villageDirOf;
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    const n = Math.max(2, Math.round(len / 0.8));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x1 + dx * t, z = z1 + dz * t;
      const d = dir(x, z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.78, 6), mat(0xa87c50));
      post.position.copy(d).multiplyScalar(R + 0.51);
      post.quaternion.setFromUnitVectors(UP, d);
      post.castShadow = true;
      planet.add(post);
      pts.push({ p: post.position.clone(), d });
    }
    [0.28, 0.58].forEach(lift => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const mid = a.p.clone().add(b.p).multiplyScalar(0.5);
        const nMid = mid.clone().normalize();
        const dist = a.p.distanceTo(b.p);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(dist * 1.04, 0.075, 0.06), mat(0xb98a5c));
        // 轨道方向：两柱连线在切平面上的投影 · Rail direction: projection of the post-to-post line onto the tangent plane
        const dir3 = b.p.clone().sub(a.p).normalize();
        const tangent = dir3.clone().sub(nMid.clone().multiplyScalar(dir3.dot(nMid))).normalize();
        const binormal = new THREE.Vector3().crossVectors(tangent, nMid).normalize();
        const m = new THREE.Matrix4().makeBasis(tangent, nMid, binormal);
        rail.quaternion.setFromRotationMatrix(m);
        rail.position.copy(nMid).multiplyScalar(R + lift + 0.12);
        rail.castShadow = true;
        planet.add(rail);
      }
    });
  }
  fence(-1.6, 7.7, 1.8, 7.7);
  fence(2.4, 7.5, 4.6, 6.3);
  fence(-6.9, 3.9, -5.9, 5.2);

  /* ================= 球背面：南半球第二村庄 · Back of the globe: southern-hemisphere second village ================= */
  function stoneLat(lat, lon, s) {
    const holder = new THREE.Group();
    const st = new THREE.Mesh(stoneGeo, mat(new THREE.Color(0xcfc9bb).offsetHSL(0, 0, (rand() - 0.5) * 0.08)));
    st.scale.setScalar(s); st.position.y = 0.05; st.rotation.y = rand() * 6.28;
    holder.add(st);
    placeLat(shadows(holder), lat, lon, 0, 0.04);
  }

  // 南纬 18° 石板环路（与正面环路呼应）· South latitude 18° cobbled ring road (echoes the front ring)
  const ringLatS = -18;
  for (let lon = -180; lon < 180; lon += 12) {
    const la = ringLatS + Math.sin(lon * 3 * D2R) * 2.5;
    stoneLat(la, lon, 0.75 + rand() * 0.4);
  }

  // 背面 6 座小屋 + 从南环引出的岔路 · Six back-side houses + branch paths led out from the south ring
  const backHouses = [
    [-24, 160, 0.4, ROOF_YEL], [-32, -30, -0.7, ROOF_RED], [-46, 100, 0.2, ROOF_BLUE],
    [-20, -155, -1.1, ROOF_BROWN], [-38, -140, 0.8, ROOF_RED], [-56, 30, 0.1, ROOF_YEL],
  ];
  backHouses.forEach(([lat, lon, spin, rc], bi) => {
    const h = makeHouse(rc, ['gable', 'tower', 'dome', 'gable', 'two', 'dome'][bi % 6]);
    h.scale.setScalar((bi === 4 ? 0.82 : 1) * (0.9 + rand() * 0.14));
    const hd = placeLat(h, lat, lon, spin);
    const start = dirLatLon(ringLatS, lon);
    const steps = Math.ceil(start.angleTo(hd) / 0.045);
    for (let i = 1; i < steps; i++) {
      const d = start.clone().lerp(hd, i / steps).normalize();
      stoneLat(Math.asin(d.y) / D2R, Math.atan2(d.z, d.x) / D2R, 0.6 + rand() * 0.3);
    }
  });

  // 背面松树与樱花树（樱花树同样作为花瓣飘落源）· Back-side pines and cherry trees (cherries also serve as petal sources)
  [[-25, -70, 1.0], [-40, 60, 0.9], [-14, 8, 1.05], [-50, -60, 0.85], [-62, 150, 0.9], [-30, -105, 0.95]].forEach(([lat, lon, s], i) => {
    const tr = pine(i % 3); tr.scale.setScalar(s); placeLat(tr, lat, lon, rand() * 6.28);
  });
  [[-22, 130, 1.0], [-42, -20, 0.9], [-58, -120, 0.95], [-27, 75, 0.9]].forEach(([lat, lon, s], i) => {
    const tr = blossom(i % 3); tr.scale.setScalar(s);
    blossomDirs.push(placeLat(tr, lat, lon, rand() * 6.28));
  });

  // 背面路灯与长椅 · Back-side street lamp and bench
  (function () {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 2.35, 7), mat(0x4d4a55));
    post.position.y = 1.17; g.add(post);
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.36), mat(0xffe9a8, { emissive: 0xffd27a, emissiveIntensity: 0.8 }));
    lantern.position.y = 2.5; g.add(lantern);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.28, 4), mat(0x4d4a55));
    cap.position.y = 2.85; cap.rotation.y = Math.PI / 4; g.add(cap);
    const light = new THREE.PointLight(0xffd9a0, 0.55, 9);
    light.position.y = 2.5; g.add(light);
    placeLat(g, -20, -40, 0);
  })();
  (function () {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.1, 0.44), mat(0x9a6b45));
    seat.position.y = 0.45; g.add(seat);
    [-0.55, 0.55].forEach(px => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.45, 0.38), mat(0x7c5836));
      leg.position.set(px, 0.22, 0); g.add(leg);
    });
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.42, 0.08), mat(0x9a6b45));
    back.position.set(0, 0.82, -0.22); back.rotation.x = -0.12; g.add(back);
    placeLat(g, -28, 55, 0.5);
  })();

  // 背面栅栏（沿南环）· Back-side fence (along the south ring)
  fence(-18, 15, -18, 55, dirLatLon);
  fence(-18, -85, -18, -45, dirLatLon);

  // 背面小花与灌木 · Back-side small flowers and shrubs
  for (let i = 0; i < 12; i++) {
    const lat = -(12 + rand() * 45), lon = rand() * 360 - 180;
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 5), mat(0x54b83e));
    stem.position.y = 0.13; g.add(stem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), mat(flowerColors[i % 4]));
    head.position.y = 0.29; g.add(head);
    placeLat(g, lat, lon, rand() * 6.28, 0.1);
  }
  [[-16, 95], [-35, -160], [-48, 45], [-25, -20]].forEach(([lat, lon]) => {
    const holder = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.36, 7, 6), mat(0x5ec250));
    b.scale.y = 0.75; b.position.y = 0.22; holder.add(b);
    placeLat(shadows(holder), lat, lon, rand() * 6.28);
  });

  return { houses, blossomDirs, fountainDirs, backHouses };
}
