import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ---------------------------------------------------------------------------
 * 파스텔 소품 8종
 * 모든 소품은 Three.js 프리미티브로 직접 만든 입체 오브젝트입니다.
 * (외부 이미지/모델 파일 없이 동작)
 * ------------------------------------------------------------------------- */

const matCache = new Map();

function M(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.72,
    metalness: 0,
    ...opts,
  });
  matCache.set(key, m);
  return m;
}

function add(parent, geo, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(...pos);
  mesh.rotation.set(...rot);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

const sphere = (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
const blob = (r, detail = 1) => new THREE.IcosahedronGeometry(r, detail);

/* 1. 나무 ---------------------------------------------------------------- */
function buildTree() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.075, 0.11, 0.52, 10), M('#C7A583'), [0, 0.26, 0]);
  add(g, blob(0.34, 1), M('#9FD680'), [0, 0.68, 0], [0, 0.4, 0], [1, 0.92, 1]);
  add(g, blob(0.27, 1), M('#B4E497'), [-0.2, 0.86, 0.06]);
  add(g, blob(0.25, 1), M('#A6DC86'), [0.22, 0.8, -0.05]);
  add(g, blob(0.2, 1), M('#C0EAA4'), [0.03, 1.02, 0.02]);
  add(g, sphere(0.045, 10, 8), M('#F6A3A0'), [-0.16, 0.74, 0.26]);
  add(g, sphere(0.04, 10, 8), M('#F7C948'), [0.26, 0.7, 0.14]);
  return g;
}

/* 2. 꽃 ------------------------------------------------------------------ */
function buildFlower() {
  const g = new THREE.Group();
  const stemMat = M('#8FC46E');
  const specs = [
    { x: 0, z: 0, h: 0.34, s: 1.0, petal: '#FFFFFF', center: '#FFD35C' },
    { x: 0.19, z: 0.07, h: 0.24, s: 0.78, petal: '#FFFFFF', center: '#FFD35C' },
    { x: -0.15, z: -0.09, h: 0.28, s: 0.85, petal: '#F9B7C8', center: '#FFF3C4' },
  ];

  for (const sp of specs) {
    add(g, new THREE.CylinderGeometry(0.016, 0.022, sp.h, 6), stemMat, [sp.x, sp.h / 2, sp.z]);
    // 잎
    const leaf = add(
      g,
      sphere(0.06, 10, 8),
      stemMat,
      [sp.x + 0.06, sp.h * 0.4, sp.z],
      [0, 0, -0.6],
      [1.5, 0.45, 0.9]
    );
    leaf.castShadow = true;

    const head = new THREE.Group();
    head.position.set(sp.x, sp.h + 0.01, sp.z);
    head.scale.setScalar(sp.s);
    head.rotation.y = Math.random() * Math.PI;
    g.add(head);

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      add(
        head,
        sphere(0.058, 10, 8),
        M(sp.petal, { roughness: 0.6 }),
        [Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0],
        [0, 0, a],
        [1.15, 0.85, 0.5]
      );
    }
    add(head, sphere(0.042, 12, 10), M(sp.center), [0, 0, 0.012], [0, 0, 0], [1, 1, 0.7]);
  }
  return g;
}

/* 3. 구름 ---------------------------------------------------------------- */
function buildCloud() {
  const g = new THREE.Group();
  const cloud = new THREE.Group();
  cloud.position.y = 0.62;
  g.add(cloud);
  const puffs = [
    [0, 0, 0, 0.3],
    [0.28, -0.04, 0.04, 0.23],
    [-0.28, -0.03, -0.02, 0.24],
    [0.13, 0.16, 0, 0.22],
    [-0.14, 0.14, 0.03, 0.19],
    [0.42, -0.12, 0.06, 0.15],
    [-0.42, -0.12, -0.04, 0.14],
  ];
  for (const [x, y, z, r] of puffs) {
    add(cloud, blob(r, 2), M('#FFFFFF', { roughness: 0.95 }), [x, y, z], [0, x * 2, 0], [1, 0.92, 1]);
  }
  g.userData.tick = (t) => {
    cloud.position.y = 0.62 + Math.sin(t * 1.1) * 0.055;
    cloud.rotation.y = Math.sin(t * 0.4) * 0.12;
  };
  return g;
}

/* 4. 버섯 ---------------------------------------------------------------- */
function buildMushroom() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.075, 0.1, 0.26, 12), M('#FFF6E4'), [0, 0.13, 0]);
  const cap = add(
    g,
    new THREE.SphereGeometry(0.23, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    M('#F2A0A0'),
    [0, 0.26, 0],
    [0, 0, 0],
    [1, 0.85, 1]
  );
  cap.castShadow = true;
  add(g, new THREE.CylinderGeometry(0.232, 0.232, 0.03, 22), M('#FFF0EC'), [0, 0.265, 0]);
  const dots = [
    [0.1, 0.36, 0.1],
    [-0.12, 0.35, -0.04],
    [0.02, 0.4, -0.1],
    [-0.03, 0.33, 0.16],
  ];
  dots.forEach(([x, y, z], i) => {
    add(g, sphere(0.038 - (i % 2) * 0.008, 8, 8), M('#FFFFFF'), [x, y, z], [0, 0, 0], [1, 0.6, 1]);
  });
  return g;
}

/* 5. 작은 집 -------------------------------------------------------------- */
function buildHouse() {
  const g = new THREE.Group();
  const body = add(
    g,
    new RoundedBoxGeometry(0.6, 0.46, 0.52, 3, 0.05),
    M('#FFF6E6'),
    [0, 0.23, 0]
  );
  body.castShadow = true;

  // 지붕 (4각 뿔)
  add(
    g,
    new THREE.ConeGeometry(0.52, 0.34, 4, 1),
    M('#F09A87'),
    [0, 0.6, 0],
    [0, Math.PI / 4, 0]
  );

  // 문
  add(g, new RoundedBoxGeometry(0.16, 0.24, 0.04, 2, 0.03), M('#D9A483'), [0, 0.12, 0.26]);
  add(g, sphere(0.017, 8, 8), M('#F7C948'), [0.05, 0.14, 0.285]);

  // 창문
  for (const x of [-0.18, 0.18]) {
    add(g, new RoundedBoxGeometry(0.13, 0.13, 0.03, 2, 0.02), M('#BFE3F0'), [x, 0.32, 0.262]);
    add(g, new RoundedBoxGeometry(0.135, 0.02, 0.02, 1, 0.006), M('#FFFFFF'), [x, 0.325, 0.278]);
  }

  // 굴뚝
  add(g, new THREE.BoxGeometry(0.1, 0.22, 0.1), M('#E8C9B4'), [0.18, 0.68, -0.1]);
  add(g, new RoundedBoxGeometry(0.13, 0.04, 0.13, 2, 0.02), M('#F6E3D3'), [0.18, 0.8, -0.1]);
  return g;
}

/* 6. 별 장식 -------------------------------------------------------------- */
function starShape(outer = 0.26, inner = 0.115) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function buildStar() {
  const g = new THREE.Group();
  // 작은 구름 받침
  [
    [0, 0.09, 0, 0.17],
    [0.13, 0.06, 0.02, 0.12],
    [-0.13, 0.06, -0.02, 0.12],
  ].forEach(([x, y, z, r]) => add(g, blob(r, 2), M('#FFFFFF', { roughness: 0.95 }), [x, y, z], [0, 0, 0], [1.1, 0.7, 1.05]));

  const geo = new THREE.ExtrudeGeometry(starShape(0.3, 0.132), {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  geo.center();

  const star = add(
    g,
    geo,
    M('#FFD86B', { roughness: 0.42, metalness: 0.05, emissive: new THREE.Color('#F0B02A'), emissiveIntensity: 0.35 }),
    [0, 0.62, 0]
  );
  g.userData.tick = (t) => {
    star.rotation.y = t * 0.7;
    star.position.y = 0.62 + Math.sin(t * 1.4) * 0.04;
  };
  return g;
}

/* 7. 돌 장식 -------------------------------------------------------------- */
function buildRock() {
  const g = new THREE.Group();
  add(g, new THREE.DodecahedronGeometry(0.22, 0), M('#C6CFD6'), [0, 0.16, 0], [0.2, 0.5, 0.1], [1.15, 0.8, 1]);
  add(g, new THREE.DodecahedronGeometry(0.13, 0), M('#B7C2CB'), [0.23, 0.1, 0.1], [0.4, 0.9, 0.2], [1, 0.85, 1]);
  add(g, new THREE.DodecahedronGeometry(0.09, 0), M('#D6DEE4'), [-0.16, 0.07, 0.16], [0.1, 0.2, 0.5]);
  add(g, blob(0.05, 0), M('#AFC99C'), [0.02, 0.29, 0.02], [0, 0.3, 0], [1.4, 0.5, 1.2]);
  return g;
}

/* 8. 무지개 장식 ---------------------------------------------------------- */
function buildRainbow() {
  const g = new THREE.Group();
  const colors = ['#F6A6A6', '#F8C98A', '#F7E39A', '#B8E0A0', '#A6CBEF', '#C3B0E8'];
  colors.forEach((c, i) => {
    const r = 0.62 - i * 0.055;
    add(
      g,
      new THREE.TorusGeometry(r, 0.028, 8, 40, Math.PI),
      M(c, { roughness: 0.6 }),
      [0, 0.62, i * 0.001],
      [0, 0, 0]
    );
  });
  // 양쪽 구름 발
  for (const sx of [-1, 1]) {
    const base = new THREE.Group();
    base.position.set(sx * 0.62, 0.12, 0);
    g.add(base);
    [
      [0, 0, 0, 0.17],
      [0.13, -0.03, 0.02, 0.12],
      [-0.13, -0.02, -0.02, 0.12],
      [0.02, 0.09, 0, 0.12],
    ].forEach(([x, y, z, r]) => add(base, blob(r, 2), M('#FFFFFF', { roughness: 0.95 }), [x, y, z]));
  }
  return g;
}

const BUILDERS = {
  tree: buildTree,
  flower: buildFlower,
  cloud: buildCloud,
  mushroom: buildMushroom,
  house: buildHouse,
  star: buildStar,
  rock: buildRock,
  rainbow: buildRainbow,
};

for (const [type, fn] of Object.entries(BUILDERS)) {
  fn.propType = type;
}

export const PROP_TYPES = Object.keys(BUILDERS);

export const PROP_META = {
  tree: { label: '나무', scale: 1.35, offsetY: 0 },
  flower: { label: '꽃', scale: 1.5, offsetY: 0 },
  cloud: { label: '구름', scale: 1.25, offsetY: 0.1 },
  mushroom: { label: '버섯', scale: 1.5, offsetY: 0 },
  house: { label: '작은 집', scale: 1.28, offsetY: 0 },
  star: { label: '별', scale: 1.3, offsetY: 0 },
  rock: { label: '돌', scale: 1.4, offsetY: 0 },
  rainbow: { label: '무지개', scale: 1.3, offsetY: 0 },
};

export function createProp(type) {
  const build = BUILDERS[type];
  if (!build) throw new Error(`unknown prop type: ${type}`);
  const g = build();
  const meta = PROP_META[type];
  g.scale.setScalar(meta.scale);
  g.userData.type = type;
  g.userData.offsetY = meta.offsetY;
  return g;
}

export function disposeProp(obj) {
  obj.traverse((c) => {
    if (c.isMesh) c.geometry?.dispose();
  });
}
