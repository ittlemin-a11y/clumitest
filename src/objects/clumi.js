import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------------------------------------------------------------------------
 * 클루미 (임시 3D 모델)
 *  - 구름처럼 뾰족뾰족한 머리, 두 개의 긴 귀, 가슴 심벌, 구름 꼬리
 *  - GLTFLoader 로 교체 가능 (setExternalModel)
 * ------------------------------------------------------------------------- */

const CREAM = '#FDF7EA';
const CREAM_SHADE = '#F4E9D4';
const INK = '#2C2A33';

function applyTransform(geo, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] }) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));
  m.compose(new THREE.Vector3(...pos), q, new THREE.Vector3(...scale));
  const g = geo.clone();
  g.applyMatrix4(m);
  return g;
}

function mergeParts(parts) {
  const geos = parts.map((p) => applyTransform(p.geo, p));
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return merged;
}

function toyMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: 0.52,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.55,
    sheen: 0.25,
    sheenColor: new THREE.Color('#FFFFFF'),
    sheenRoughness: 0.8,
  });
}

/* 가슴 심벌 -------------------------------------------------------------- */
function buildEmblem(type, color) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.45 });

  const bar = (w, h, x, y, rot = 0) => {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(Math.min(w, h) / 2, Math.max(w, h) - Math.min(w, h), 4, 8), m);
    mesh.rotation.z = rot;
    mesh.position.set(x, y, 0);
    g.add(mesh);
  };

  if (type === 'joy') {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.062, 26), m);
    disc.position.z = 0.004;
    g.add(disc);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const len = 0.05;
      const ray = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, len, 4, 6), m);
      ray.position.set(Math.cos(a) * 0.105, Math.sin(a) * 0.105, 0.004);
      ray.rotation.z = a - Math.PI / 2;
      g.add(ray);
    }
  } else if (type === 'sad') {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.072, 18, 14), m);
    drop.scale.set(1, 1.05, 0.45);
    drop.position.y = -0.012;
    g.add(drop);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.072, 0.1, 18), m);
    tip.position.y = 0.058;
    tip.scale.z = 0.45;
    g.add(tip);
  } else if (type === 'anger') {
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 12), m);
    flame.scale.set(1, 1.15, 0.45);
    flame.position.y = -0.02;
    g.add(flame);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.13, 16), m);
    tip.position.y = 0.07;
    tip.scale.z = 0.45;
    tip.rotation.z = 0.2;
    g.add(tip);
  } else if (type === 'fear') {
    for (let i = 0; i < 3; i++) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.014, 6, 16, Math.PI * 1.15), m);
      arc.position.set(i % 2 ? 0.012 : -0.012, 0.045 - i * 0.048, 0.004);
      arc.rotation.z = i % 2 ? 0.35 : -0.2;
      g.add(arc);
    }
  } else if (type === 'new') {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.098 : 0.042;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    }
    shape.closePath();
    const star = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false }), m);
    star.position.z = 0.0;
    g.add(star);
  } else if (type === 'tired') {
    const widths = [0.19, 0.13, 0.16];
    widths.forEach((w, i) => {
      const line = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, w, 4, 8), m);
      line.rotation.z = Math.PI / 2;
      line.position.set(i === 1 ? 0.02 : -0.02, 0.05 - i * 0.05, 0.004);
      g.add(line);
    });
  } else if (type === 'hope') {
    const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.1, 4, 8), m);
    stem.position.y = -0.045;
    g.add(stem);
    for (const s of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 10), m);
      leaf.scale.set(1, 0.52, 0.35);
      leaf.rotation.z = s * 0.6;
      leaf.position.set(s * 0.045, 0.03, 0);
      g.add(leaf);
    }
  } else {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), m);
    g.add(disc);
  }
  void bar;
  return g;
}

export class Clumi {
  constructor({ color, deep, emblem = 'joy' }) {
    this.group = new THREE.Group();
    this.group.name = 'clumi';

    this.color = new THREE.Color(color);
    this.targetColor = new THREE.Color(color);
    this.deep = new THREE.Color(deep);
    this.emblemType = emblem;

    this.headMat = toyMaterial(color);
    this.bodyMat = toyMaterial(CREAM);
    this.tailMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#FFFFFF'), roughness: 0.9 });

    this.bob = new THREE.Group();
    this.group.add(this.bob);

    this.bodyGroup = new THREE.Group();
    this.bob.add(this.bodyGroup);

    /* ---- 몸통 ---- */
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 24), this.bodyMat);
    body.scale.set(1, 1.06, 0.92);
    body.position.y = 0.6;
    body.castShadow = true;
    body.receiveShadow = true;
    this.bodyGroup.add(body);

    /* ---- 머리 (구름 실루엣) ---- */
    const headParts = [{ geo: new THREE.SphereGeometry(0.54, 32, 26), pos: [0, 0, 0], scale: [1.03, 1, 0.98] }];
    const ringA = 10;
    for (let i = 0; i < ringA; i++) {
      const a = (i / ringA) * Math.PI * 2;
      const r = 0.468;
      headParts.push({
        geo: new THREE.SphereGeometry(0.123, 14, 12),
        pos: [Math.cos(a) * r, -0.075 + Math.sin(a * 2) * 0.012, Math.sin(a) * r * 0.985],
      });
    }
    const headGeo = mergeParts(headParts);
    headParts.forEach((p) => p.geo.dispose());
    this.head = new THREE.Mesh(headGeo, this.headMat);
    this.head.castShadow = true;
    this.head.receiveShadow = true;

    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 1.38;
    this.headGroup.add(this.head);
    this.bodyGroup.add(this.headGroup);

    /* ---- 귀 ---- */
    this.ears = [];
    for (const s of [-1, 1]) {
      const earParts = [
        { geo: new THREE.CapsuleGeometry(0.15, 0.62, 8, 20), pos: [0, 0.22, 0], scale: [1, 1, 0.62] },
      ];
      const earGeo = mergeParts(earParts);
      earParts.forEach((p) => p.geo.dispose());
      const ear = new THREE.Mesh(earGeo, this.headMat);
      ear.position.set(s * 0.2, 0.42, -0.03);
      ear.rotation.z = s * -0.12;
      ear.rotation.x = -0.06;
      ear.castShadow = true;
      ear.userData.base = ear.rotation.z;
      ear.userData.side = s;
      this.headGroup.add(ear);
      this.ears.push(ear);
    }

    /* ---- 얼굴 ---- */
    const eyeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(INK), roughness: 0.22 });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.eyes = [];
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.088, 22, 18), eyeMat);
      eye.scale.set(0.95, 1.15, 0.42);
      eye.position.set(s * 0.175, 0.035, 0.472);
      this.headGroup.add(eye);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), glintMat);
      glint.position.set(s * 0.175 + 0.028, 0.08, 0.512);
      glint.scale.set(1, 1, 0.5);
      this.headGroup.add(glint);
      this.eyes.push(eye, glint);
    }
    // 점 코
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.033, 14, 12), eyeMat);
    nose.scale.set(1.5, 1, 0.6);
    nose.position.set(0, -0.088, 0.522);
    this.headGroup.add(nose);

    // U자 미소 (두 개의 호)
    const mouthMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(INK), roughness: 0.4 });
    this.mouths = [];
    for (const s of [-1, 1]) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0095, 8, 20, Math.PI), mouthMat);
      arc.position.set(s * 0.033, -0.142, 0.508);
      arc.rotation.z = Math.PI;
      this.headGroup.add(arc);
      this.mouths.push(arc);
    }

    // 볼터치 (아주 옅게)
    this.cheeks = [];
    for (const s of [-1, 1]) {
      const cheek = new THREE.Mesh(
        new THREE.CircleGeometry(0.052, 18),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color('#F6B7A8'),
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
        })
      );
      cheek.position.set(s * 0.305, -0.055, 0.432);
      cheek.rotation.set(-0.12, s * 0.32, 0);
      this.headGroup.add(cheek);
      this.cheeks.push(cheek);
    }

    /* ---- 팔 ---- */
    this.arms = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.086, 0.15, 6, 14), this.headMat);
      arm.position.set(s * 0.35, 0.76, 0.02);
      arm.rotation.z = s * 0.5;
      arm.castShadow = true;
      arm.userData.base = arm.rotation.z;
      arm.userData.side = s;
      this.bodyGroup.add(arm);
      this.arms.push(arm);
    }

    /* ---- 다리 ---- */
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.098, 0.07, 6, 14), this.bodyMat);
      leg.position.set(s * 0.145, 0.14, 0.03);
      leg.castShadow = true;
      this.bodyGroup.add(leg);
    }

    /* ---- 구름 꼬리 ---- */
    const tailParts = [];
    const puffs = [
      [0, 0.02, 0, 0.13],
      [0.1, -0.02, 0.02, 0.095],
      [-0.1, -0.02, 0.01, 0.095],
      [0, 0.1, 0.02, 0.095],
      [0.05, -0.075, 0.03, 0.085],
      [-0.06, -0.065, 0.02, 0.08],
    ];
    puffs.forEach(([x, y, z, r]) => {
      tailParts.push({ geo: new THREE.SphereGeometry(r, 12, 10), pos: [x, y, z] });
    });
    const tailGeo = mergeParts(tailParts);
    tailParts.forEach((p) => p.geo.dispose());
    const tail = new THREE.Mesh(tailGeo, this.tailMat);
    tail.position.set(0, 0.54, -0.31);
    tail.castShadow = true;
    this.bodyGroup.add(tail);

    /* ---- 가슴 심벌 ---- */
    this.emblem = buildEmblem(this.emblemType, deep);
    this.emblem.scale.setScalar(0.98);
    this.emblem.position.set(0, 0.63, 0.302);
    this.bodyGroup.add(this.emblem);

    /* ---- 클릭 판정용 히트박스 (보이지 않음) ---- */
    this.hitbox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.72, 2.5, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hitbox.position.y = 1.15;
    this.hitbox.userData.clumi = this;
    this.group.add(this.hitbox);

    /* ---- 상태 ---- */
    this.state = {
      targetXZ: new THREE.Vector2(0, 0),
      tripTimer: 3.5,
      tripT: 0,
      tripDur: 0,
      moveYaw: 0,
      jump: 0,
      jumpVel: 0,
      hopTimer: 2.5 + Math.random() * 3,
      lookTimer: 1.5,
      lookTarget: new THREE.Vector2(),
      look: new THREE.Vector2(),
      blinkTimer: 2 + Math.random() * 3,
      blink: 0,
      facing: 0,
      reactCooldown: 0,
    };
    this.group.scale.setScalar(0.92);
  }

  setEmotion({ color, deep, emblem }) {
    this.targetColor.set(color);
    this.deep.set(deep);
    if (emblem && emblem !== this.emblemType) {
      this.emblemType = emblem;
      this.bodyGroup.remove(this.emblem);
      this.emblem.traverse((c) => c.geometry?.dispose());
      this.emblem = buildEmblem(emblem, deep);
      this.emblem.scale.setScalar(0.98);
      this.emblem.position.set(0, 0.63, 0.302);
      this.bodyGroup.add(this.emblem);
    } else {
      this.emblem.traverse((c) => {
        if (c.isMesh) c.material.color.copy(this.deep);
      });
    }
  }

  setColorDirect(hex) {
    this.targetColor.set(hex);
    this.color.set(hex);
    this.headMat.color.set(hex);
  }

  /** 자율 행동: 카메라를 바라보다가 가끔 톡톡 걸어가고, 점프·두리번·깜빡임 */
  update(dt, t, heightAt, bounds, camera) {
    const s = this.state;

    // 머리색 보간 (HSL 경로로 섞어 중간색이 탁해지지 않게)
    this.headMat.color.lerpHSL(this.targetColor, Math.min(1, dt * 6));
    this.color.lerpHSL(this.targetColor, Math.min(1, dt * 6));

    /* --- 짧은 산책 / 휴식 --- */
    s.tripTimer -= dt;
    if (s.tripTimer <= 0) {
      s.tripTimer = 5 + Math.random() * 6;
      s.tripT = 0;
      s.tripDur = 1.1 + Math.random() * 1.4;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (bounds - 0.5);
      s.targetXZ.set(Math.cos(a) * r, Math.sin(a) * r);
    }
    const walking = s.tripT < (s.tripDur || 0);
    if (walking) {
      s.tripT += dt;
      const dx = s.targetXZ.x - this.group.position.x;
      const dz = s.targetXZ.y - this.group.position.z;
      const dist = Math.hypot(dx, dz);
      const step = Math.min(dist, 0.62 * dt);
      if (dist > 0.001) {
        this.group.position.x += (dx / dist) * step;
        this.group.position.z += (dz / dist) * step;
        s.moveYaw = Math.atan2(dx, dz);
      }
    }

    // 시선 방향: 걸을 땐 진행 방향, 쉴 땐 카메라 쪽
    let yawTarget;
    if (walking) {
      yawTarget = s.moveYaw ?? 0;
    } else if (camera) {
      yawTarget = Math.atan2(
        camera.position.x - this.group.position.x,
        camera.position.z - this.group.position.z
      );
      yawTarget += Math.sin(t * 0.45) * 0.12;
    } else {
      yawTarget = s.facing;
    }
    const diff = ((yawTarget - s.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    s.facing += diff * Math.min(1, dt * 3.2);
    this.group.rotation.y = s.facing;

    // 지면 높이
    this.group.position.y = heightAt(this.group.position.x, this.group.position.z);

    // 자발적 점프
    s.hopTimer -= dt;
    if (s.hopTimer <= 0) {
      s.hopTimer = 3.5 + Math.random() * 4.5;
      this.hop(0.55);
    }

    // 점프 물리
    if (s.jumpVel !== 0 || s.jump > 0) {
      s.jump += s.jumpVel * dt;
      s.jumpVel -= 9.2 * dt;
      if (s.jump <= 0) {
        s.jump = 0;
        s.jumpVel = 0;
      }
    }
    this.bodyGroup.position.y = s.jump;
    const stretch = 1 + Math.max(-0.12, Math.min(0.14, s.jumpVel * 0.02));
    this.bodyGroup.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));

    // 숨쉬기
    const breathe = 1 + Math.sin(t * 1.6) * 0.012;
    this.bob.position.y = Math.sin(t * 1.6 + 0.4) * 0.012;
    this.bob.scale.set(1 / Math.sqrt(breathe), breathe, 1 / Math.sqrt(breathe));

    // 두리번
    s.lookTimer -= dt;
    if (s.lookTimer <= 0) {
      s.lookTimer = 1.6 + Math.random() * 2.6;
      s.lookTarget.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.2) * 0.22);
    }
    s.look.x += (s.lookTarget.x - s.look.x) * Math.min(1, dt * 2.2);
    s.look.y += (s.lookTarget.y - s.look.y) * Math.min(1, dt * 2.2);
    this.headGroup.rotation.y = s.look.x;
    this.headGroup.rotation.x = -s.look.y + Math.sin(t * 0.9) * 0.012;

    // 귀 흔남
    for (const ear of this.ears) {
      const side = ear.userData.side;
      ear.rotation.z =
        ear.userData.base + Math.sin(t * 1.5 + side) * 0.045 - s.jump * 0.12 * side;
      ear.rotation.x = -0.08 + Math.sin(t * 1.1 + side * 0.7) * 0.03 + s.jumpVel * 0.01;
    }

    // 팔 흔들
    for (const arm of this.arms) {
      const side = arm.userData.side;
      arm.rotation.z = arm.userData.base + Math.sin(t * 1.7 + side * 1.4) * 0.05 - s.jump * 0.5;
    }

    // 깜빡임
    s.blinkTimer -= dt;
    if (s.blinkTimer <= 0) {
      s.blinkTimer = 2.4 + Math.random() * 3.4;
      s.blink = 1;
    }
    if (s.blink > 0) {
      s.blink = Math.max(0, s.blink - dt * 7);
      const k = Math.max(0.08, Math.abs(Math.cos((1 - s.blink) * Math.PI)));
      for (let i = 0; i < this.eyes.length; i++) {
        if (i % 2 === 0) this.eyes[i].scale.y = 1.12 * k;
      }
    }
    this.cheeks.forEach((c) => (c.material.opacity = 0.16 + Math.sin(t * 1.3) * 0.03));
    s.reactCooldown = Math.max(0, s.reactCooldown - dt);
  }

  faceCamera(camera) {
    const dx = camera.position.x - this.group.position.x;
    const dz = camera.position.z - this.group.position.z;
    this.state.facing = Math.atan2(dx, dz);
    this.state.tripT = 99;
    this.group.rotation.y = this.state.facing;
  }

  hop(strength = 1) {
    this.state.jumpVel = 3.1 * strength + 0.6;
    if (this.state.jump <= 0) this.state.jump = 0.001;
  }

  react() {
    this.hop(1.15);
    this.state.blink = 1;
    this.state.blinkTimer = 2.2;
    this.state.lookTarget.set(0, 0.05);
    this.state.hopTimer = Math.max(this.state.hopTimer, 3.5);
  }

  /** 외부 GLB 모델로 교체 */
  setExternalModel(model) {
    // 기존 절차적 몸체 숨김
    this.bodyGroup.visible = false;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const targetH = 2.15;
    const k = targetH / Math.max(size.y, 0.0001);
    model.scale.setScalar(k);
    model.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(model);
    model.position.y -= box2.min.y;
    const center = box2.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    this.external = new THREE.Group();
    this.external.add(model);
    this.bob.add(this.external);
    this.hitbox.position.y = 1.1;
    this.hitbox.scale.setScalar(0.9);
  }
}
