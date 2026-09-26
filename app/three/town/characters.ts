// @ts-nocheck
/* =====================================================================
 * town/characters.ts —— 角色工厂与游走系统：小精灵（低空飞行）+ 小人（地面漫步）
 * 自 planetTown.ts 逐段搬移，逻辑未变；投放顺序保持原样（rand 固定种子）。
 * makeElf / makePerson 同时导出给演唱会模块（舞台主唱/观众/车上人物）。
 * town/characters.ts — character factories & the wander system: elves (low flight) + people (ground strolls).
 * Moved verbatim from planetTown.ts; logic unchanged; spawn order preserved (fixed-seed rand).
 * makeElf / makePerson are also exported to the concert module (stage leads / audiences / float riders).
 * ===================================================================== */
export function createCharacters(ctx) {
  const { THREE, R, rand, mat, refine, placeOnPlanet, placeLat, makeBlob, updateBlob } = ctx;

  /* ---------- 小精灵（长耳朵圆身子，散布正反面村庄） · Elves (long ears, round body, scattered across front & back villages) ---------- */
  const ELF_BODY = 0xf5e6c8;   // 米白身体 · off-white body
  const ELF_TUMMY = 0xffffff;  // 白肚皮 · white tummy
  function makeElf(earColor) {
    const g = new THREE.Group();
    // 身体（水滴状：圆身 + 收拢的头）· Body (teardrop: round body + tucked head)
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), mat(ELF_BODY));
    body.scale.y = 1.12; g.add(body);
    // 白肚皮 · White tummy
    const tummy = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), mat(ELF_TUMMY));
    tummy.position.set(0, -0.03, 0.2); tummy.scale.set(1, 1.15, 0.6); g.add(tummy);
    // 长耳朵（两只尖尖的长耳，微微外张）· Long ears (two pointed ears, slightly splayed out)
    [-1, 1].forEach(sd => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.62, 6), mat(earColor));
      ear.position.set(sd * 0.15, 0.52, 0);
      ear.rotation.z = -sd * 0.32;
      g.add(ear);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), mat(0xffffff));
      // 耳尖小球：沿耳朵轴向顶端移动 · ear-tip ball: moved to the tip along the ear axis
      tip.position.set(sd * 0.15 + Math.sin(-sd * 0.32) * -0.31 * -sd * (sd > 0 ? 1 : 1), 0.52 + Math.cos(0.32) * 0.31, 0);
      g.add(tip);
    });
    // 大眼睛 · Big eyes
    [-0.12, 0.12].forEach(ex => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 7), mat(0x35322f));
      eye.position.set(ex, 0.16, 0.29); g.add(eye);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), mat(0xffffff));
      glint.position.set(ex + 0.025, 0.19, 0.35); g.add(glint);
    });
    // 腮红 · Blush
    [-0.2, 0.2].forEach(cx => {
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), new THREE.MeshBasicMaterial({ color: 0xf2a3a3, transparent: true, opacity: 0.85 }));
      blush.position.set(cx, 0.02, 0.315);
      blush.rotation.y = cx * 2.4;
      g.add(blush);
    });
    // 小嘴 · Little mouth
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 5, 8, Math.PI), mat(0x35322f));
    mouth.rotation.z = Math.PI; mouth.position.set(0, 0.03, 0.32); g.add(mouth);
    // 小翅膀（半透明，扇动）· Little wings (translucent, flapping)
    const wingMat = new THREE.MeshBasicMaterial({ color: 0xfdf3ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    [-1, 1].forEach(sd => {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.34), wingMat);
      wing.position.set(sd * 0.36, 0.18, -0.05);
      wing.rotation.y = sd * 0.5;
      g.add(wing);
    });
    return refine(g);
  }
  /* ---------- 小人（地面行走的村民，接入游走系统） · Little people (ground-walking villagers, hooked into the wander system) ---------- */
  const SKIN = [0xf6c9a0, 0xeab088, 0xd99a73];        // 肤色 · skin tones
  function makePerson(shirt, hair) {
    const g = new THREE.Group();
    const legs = [];
    // 两条腿（腿根在原点，向前后摆动）· Two legs (hip at origin, swinging fore/aft)
    [-0.06, 0.06].forEach(lx => {
      const hip = new THREE.Group();
      hip.position.set(lx, 0.21, 0);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.19, 6), mat(0x5c6f8a));
      leg.position.y = -0.095; hip.add(leg);
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), mat(0x8a5a3b));
      shoe.scale.set(1, 0.6, 1.3); shoe.position.set(0, -0.2, 0.015); hip.add(shoe);
      g.add(hip); legs.push(hip);
    });
    // 上身（衫衣）· Torso (shirt)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.2, 9), mat(shirt));
    torso.position.y = 0.35; g.add(torso);
    // 两只小手臂 · Two little arms
    [-1, 1].forEach(sd => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.14, 6), mat(shirt));
      arm.position.set(sd * 0.135, 0.37, 0); arm.rotation.z = sd * 0.5; g.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 5), mat(SKIN[0]));
      hand.position.set(sd * 0.165, 0.3, 0); g.add(hand);
    });
    // 头 + 头发cap + 眼睛 · Head + hair cap + eyes
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mat(SKIN[Math.floor(rand() * 3)]));
    head.position.y = 0.58; g.add(head);
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 6, 0, 6.283, 0, 1.25), mat(hair));
    hairCap.position.y = 0.58; hairCap.rotation.x = -0.2; g.add(hairCap);
    [-0.045, 0.045].forEach(ex => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 5, 4), mat(0x35322f));
      eye.position.set(ex, 0.58, 0.1); g.add(eye);
    });
    return { g: refine(g), legs };
  }
  /* ---------- 游走系统：精灵飞行 + 小人地面漫步 · Wander system: elves fly + people stroll on the ground ---------- */
  const wanderers = [];
  function addWanderer(g, d, opt) {
    // 随机初始行进方向（切平面内的单位切向量）· random initial heading (unit tangent vector in the tangent plane)
    const rnd = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5);
    let tv = new THREE.Vector3().crossVectors(d, rnd);
    if (tv.lengthSq() < 1e-4) tv.crossVectors(d, new THREE.Vector3(1, 0, 0));
    wanderers.push(Object.assign({
      g, d: d.clone(), t: tv.normalize(),
      state: 'idle', timer: rand() * 2, phase: rand() * 6.28,
      speed: 0.4, lift: 0.06,
      isElf: false,
    }, opt));
    const w = wanderers[wanderers.length - 1];
    const bSize = w.isElf ? 0.85 : 0.5;
    w.blob = makeBlob(bSize);
    w.blob.userData.size = bSize;
  }
  // 活动范围：正面村庄 y∈[0.44,0.985]（北纬24°以上），背面村庄 y∈[-0.92,-0.28]
  // Roaming bounds: front village y∈[0.44,0.985] (above latitude 24°N), back village y∈[-0.92,-0.28]
  const BOUNDS = {
    v: { yMin: 0.44, yMax: 0.985 },
    l: { yMin: -0.92, yMax: -0.28 },
  };

  // 精灵位置：正面村庄 6 只 + 背面村庄 9 只共 15 只（全部不同耳色），低空飞着逛
  // Elf spawns: 6 front + 9 back = 15 (all distinct ear colors), drifting around at low altitude
  const elfDefs = [
    // [模式, lat 或 村庄x, lon 或 村庄z, 耳朵色] · [mode, lat or village x, lon or village z, ear color]
    ['v', 3.4, 3.4, 0xdcb8e8],    // 淡紫 · lilac
    ['v', -3.0, -3.4, 0xa8d8ea],  // 天蓝 · sky blue
    ['v', 5.9, 6.4, 0xf2b9cc],    // 粉 · pink
    ['v', -6.2, 1.2, 0xcdeab0],   // 嫩绿 · light green
    ['v', 0.2, -3.2, 0xf5cf5e],   // 鹅黄 · goose yellow
    ['v', -5.9, 6.1, 0xf0a8b8],   // 蜜桃粉 · peach pink
    // 背面 9 只，各不相同 · 9 back-side, all distinct
    ['l', -16, 70, 0xb8e8d8],     // 薄荷 · mint
    ['l', -30, -10, 0xe8c8a8],    // 杏色 · apricot
    ['l', -44, -70, 0xc8b8e8],    // 深紫 · deep purple
    ['l', -26, -70, 0xa8e8e8],    // 青色 · cyan
    ['l', -34, 65, 0xe8a8c8],     // 玫红 · rose
    ['l', -50, 60, 0xd8e88a],     // 柠檬绿 · lemon green
    ['l', -12, -170, 0xe88aa8],   // 山茶红 · camellia red
    ['l', -20, 20, 0xb0c8f0],     // 雾蓝 · misty blue
    ['l', -50, -80, 0xf0d8a8],    // 奶咖 · milk coffee
  ];
  elfDefs.forEach(([mode, a, b, earColor]) => {
    const elf = makeElf(earColor);
    const d = mode === 'v' ? placeOnPlanet(elf, a, b, rand() * 6.28, 0.55) : placeLat(elf, a, b, rand() * 6.28, 0.55);
    const wings = [];
    // 记录翅膀引用（两片 PlaneGeometry 网格）· record wing references (the two PlaneGeometry meshes)
    elf.children.forEach(ch => { if (ch.isMesh && ch.geometry && ch.geometry.type === 'PlaneGeometry') wings.push(ch); });
    addWanderer(elf, d, { isElf: true, speed: 0.75, lift: 0.55, wings, yMin: BOUNDS[mode].yMin, yMax: BOUNDS[mode].yMax });
  });

  // 小人：正面村庄 5 + 背面村庄 3，沿地面漫步（腿根即原点，lift 把脚底抬离球面）
  // People: 5 front + 3 back villages, strolling on the ground (hip at origin; lift raises the feet off the sphere)
  const personDefs = [
    // [模式, lat 或 村庄x, lon 或 村庄z, 衫色, 发色] · [mode, lat or village x, lon or village z, shirt color, hair color]
    ['v', 2.2, -6.8, 0xe05f5f, 0x4a3628],
    ['v', -3.4, 6.0, 0x4fa3e0, 0x2e2a26],
    ['v', 7.0, 4.6, 0x8ecf6a, 0x7a5230],
    ['v', -7.4, -4.2, 0xffb74d, 0x3b3b4a],
    ['v', 1.0, 4.8, 0xb98af5, 0x5a3a2a],
    ['l', -22, 95, 0x5ee0c8, 0x2e2a26],
    ['l', -40, -120, 0xf2b9cc, 0x4a3628],
    ['l', -30, 30, 0x4fa3e0, 0x7a5230],
  ];
  personDefs.forEach(([mode, a, b, shirt, hair]) => {
    const p = makePerson(shirt, hair);
    const d = mode === 'v' ? placeOnPlanet(p.g, a, b, rand() * 6.28, 0.2) : placeLat(p.g, a, b, rand() * 6.28, 0.2);
    addWanderer(p.g, d, { isPerson: true, legs: p.legs, walkT: rand() * 6.28, speed: 0.28, lift: 0.2, yMin: BOUNDS[mode].yMin, yMax: BOUNDS[mode].yMax });
  });

  // 每帧复用的临时对象（从 animate 循环外迁，避免每帧 new 造成 GC 抖动）
  // Per-frame scratch objects (hoisted out of the loop to avoid per-frame new and GC churn)
  const _v1 = new THREE.Vector3(), _m1 = new THREE.Matrix4(), _nd = new THREE.Vector3();

  /* ---------- 每帧游走更新 · Per-frame wander update ---------- */
  function updateWanderers(t, dt) {
    // 游走：精灵低空飞行扇翅，小人地面迈步摆腿；停顿时原地打转张望
    // Wander: elves fly low and flap; people stride and swing legs; when idle they spin in place looking around
    wanderers.forEach(w => {
      w.timer -= dt;
      if (w.timer <= 0) {
        if (w.state === 'idle') { w.state = 'walk'; w.timer = 2 + rand() * 2.5; }
        else { w.state = 'idle'; w.timer = 1.5 + rand() * 2.5; }
      }
      const moving = w.state === 'walk';
      if (moving) {
        // 平缓随机转向 · gentle random steering
        w.t.applyAxisAngle(w.d, Math.sin(t * 0.6 + w.phase) * 0.9 * dt);
        const nd = _nd.copy(w.d).addScaledVector(w.t, w.speed * dt);
        if (nd.y > w.yMax || nd.y < w.yMin) {
          w.t.negate();   // 走到活动范围边界，折返 · hit the roaming bound, turn back
        } else {
          w.d.copy(nd).normalize();
          w.t.addScaledVector(w.d, -w.t.dot(w.d)).normalize();   // 重新正交化 · re-orthogonalize
        }
      }
      // 朝向：头顶对齐法线，面朝行进方向 · Facing: up-axis aligned to the normal, heading toward the travel direction
      const right = _v1.crossVectors(w.d, w.t).normalize();
      w.g.quaternion.setFromRotationMatrix(_m1.makeBasis(right, w.d, w.t));

      let lift = w.lift;
      if (w.isElf) {
        lift += 0.1 + Math.sin(t * 1.4 + w.phase) * 0.08;
        const flap = Math.sin(t * 8 + w.phase) * 0.6;
        w.wings[0].rotation.z = flap; w.wings[1].rotation.z = -flap;
        if (w.state === 'idle') w.g.rotateY(dt * 0.8 * Math.sin(t * 0.5 + w.phase));
      }
      if (w.isPerson) {
        // 迈步：行走时双腿反相摆动 + 身体轻微颠簸，停下时腿归位 · Stride: legs swing anti-phase + slight body bob while walking; legs reset when stopped
        if (moving) w.walkT += dt * 7;
        const sw = moving ? Math.sin(w.walkT) * 0.5 : 0;
        w.legs[0].rotation.x = sw; w.legs[1].rotation.x = -sw;
        lift += moving ? Math.abs(Math.sin(w.walkT)) * 0.012 : 0;
        if (w.state === 'idle') w.g.rotateY(dt * 0.6 * Math.sin(t * 0.4 + w.phase));
      }
      w.g.position.copy(w.d).multiplyScalar(R + lift);
      updateBlob(w.blob, w.d, lift);
    });
  }

  return { makeElf, makePerson, updateWanderers };
}
