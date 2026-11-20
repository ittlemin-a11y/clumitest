import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------------------------------------------------------------------------
 * 떠 있는 구름 섬
 * - 폭신한 다층 구름 베이스 + 둥근 파스텔 잔디
 * - heightAt() 으로 소품/캐릭터를 지면에 정확히 앉힘
 * ------------------------------------------------------------------------- */

export const ISLAND_RADIUS = 4.3;
const DOME = 0.36;

/* 잔디 표면 프로파일 (중심 → 가장자리) : 높이 계산과 지오메트리가 같은 값을 씁니다. */
export const GRASS_PROFILE = [
  [0.0, DOME],
  [0.4, DOME * 0.998],
  [0.8, DOME * 0.985],
  [1.2, DOME * 0.962],
  [1.6, DOME * 0.925],
  [2.0, DOME * 0.872],
  [2.4, DOME * 0.802],
  [2.8, DOME * 0.712],
  [3.15, DOME * 0.605],
  [3.5, DOME * 0.48],
  [3.8, DOME * 0.335],
  [4.02, DOME * 0.175],
  [4.16, 0.0],
  [4.26, -0.18],
  [4.2, -0.37],
  [4.02, -0.5],
];

export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  if (r >= 4.16) return 0;
  for (let i = 0; i < GRASS_PROFILE.length - 1; i++) {
    const [r0, y0] = GRASS_PROFILE[i];
    const [r1, y1] = GRASS_PROFILE[i + 1];
    if (r >= r0 && r <= r1) {
      const t = (r - r0) / Math.max(0.0001, r1 - r0);
      return y0 + (y1 - y0) * t;
    }
  }
  return 0;
}

function makeGrassTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  // 부드러운 얼룩
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 8 + Math.random() * 46;
    const shadeVal = 226 + Math.floor(Math.random() * 29);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${shadeVal},${shadeVal},${shadeVal},0.5)`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 잔풀 점
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.35})`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function lathe(points, segments = 72) {
  // 프로파일은 위쪽(중심) → 아래쪽(가장자리) 순서로 작성하므로,
  // LatheGeometry 의 법선이 바깥을 향하도록 뒤집어 전달합니다.
  const pts = points.map(([r, y]) => new THREE.Vector2(r, y)).reverse();
  return new THREE.LatheGeometry(pts, segments);
}

function puffCloud({ count, ringMin, ringMax, y, sizeMin, sizeMax, color, seed = 1 }) {
  const geos = [];
  let rnd = seed * 9301;
  const rand = () => {
    rnd = (rnd * 9301 + 49297) % 233280;
    return rnd / 233280;
  };
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.5;
    const ring = ringMin + rand() * (ringMax - ringMin);
    const r = sizeMin + rand() * (sizeMax - sizeMin);
    const geo = new THREE.SphereGeometry(r, 20, 14);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(Math.cos(a) * ring, y + rand() * 0.12, Math.sin(a) * ring),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * Math.PI, 0)),
      new THREE.Vector3(1, 0.62 + rand() * 0.12, 1)
    );
    geo.applyMatrix4(m);
    geos.push(geo);
  }
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 1, metalness: 0 })
  );
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function createIsland() {
  const group = new THREE.Group();
  group.name = 'island';

  /* ---- 잔디 돔 ---- */
  const grassGeo = lathe(GRASS_PROFILE, 96);
  // 위에서 봐도 둥근 돔처럼 보이도록 꼭대기는 밝게, 가장자리는 살짝 가라앉게
  {
    const pos = grassGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      const t = Math.min(1, r / 4.3);
      let s = 1.06 - 0.26 * Math.pow(t, 2.0);
      s += Math.sin(x * 2.7 + z * 1.9) * 0.012 + Math.sin(z * 3.3 - x * 1.4) * 0.012;
      colors[i * 3] = s;
      colors[i * 3 + 1] = s;
      colors[i * 3 + 2] = s;
    }
    grassGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  const grassTex = makeGrassTexture();
  const grassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#BFE59C'),
    map: grassTex,
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.receiveShadow = true;
  grass.castShadow = true;
  grass.name = 'grass';
  group.add(grass);

  /* ---- 흙 층 ---- */
  const soilGeo = lathe([
    [4.06, -0.44],
    [3.86, -0.66],
    [3.35, -0.85],
    [2.5, -1.0],
    [1.3, -1.1],
    [0.0, -1.14],
  ]);
  const soil = new THREE.Mesh(
    soilGeo,
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#E7D2AF'), roughness: 1 })
  );
  soil.receiveShadow = true;
  soil.castShadow = true;
  group.add(soil);

  /* ---- 구름 베이스 (다층) ---- */
  const collar = puffCloud({
    count: 34,
    ringMin: 4.2,
    ringMax: 4.58,
    y: -0.34,
    sizeMin: 0.42,
    sizeMax: 0.72,
    color: '#FFFFFF',
    seed: 21,
  });
  const collarLow = puffCloud({
    count: 22,
    ringMin: 3.7,
    ringMax: 4.4,
    y: -1.0,
    sizeMin: 0.5,
    sizeMax: 0.78,
    color: '#FBFDFF',
    seed: 33,
  });
  const cloudLayer1 = puffCloud({
    count: 16,
    ringMin: 2.2,
    ringMax: 3.9,
    y: -1.42,
    sizeMin: 0.7,
    sizeMax: 1.05,
    color: '#FFFFFF',
    seed: 3,
  });
  const cloudLayer2 = puffCloud({
    count: 11,
    ringMin: 0.8,
    ringMax: 2.6,
    y: -1.85,
    sizeMin: 0.75,
    sizeMax: 1.1,
    color: '#F8FBFF',
    seed: 7,
  });
  const cloudLayer3 = puffCloud({
    count: 7,
    ringMin: 0.8,
    ringMax: 2.2,
    y: -2.25,
    sizeMin: 0.7,
    sizeMax: 1.05,
    color: '#EDF3FC',
    seed: 11,
  });
  group.add(collar, collarLow, cloudLayer1, cloudLayer2, cloudLayer3);

  /* ---- 잔디 위 디테일 (풀포기 · 작은 꽃) ---- */
  const rand = seededRandom(42);
  const tuftGeos = [];
  for (let i = 0; i < 88; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.5 + rand() * (ISLAND_RADIUS - 0.75);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = heightAt(x, z);
    const s = 0.45 + rand() * 0.55;
    const geo = new THREE.ConeGeometry(0.035, 0.13, 5);
    geo.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, y + 0.055 * s, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 0.3, rand() * 3, rand() * 0.3)),
        new THREE.Vector3(s, s, s)
      )
    );
    tuftGeos.push(geo);
  }
  const tuftMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#9FD180'), roughness: 1 });
  const tufts = new THREE.Mesh(mergeGeometries(tuftGeos, false), tuftMat);
  tuftGeos.forEach((g) => g.dispose());
  tufts.castShadow = true;
  group.add(tufts);

  // 작은 들꽃 (색별로 묶어서)
  const flowerPalette = ['#FFFDF2', '#FFE9A8', '#FBD0DC'];
  flowerPalette.forEach((col, ci) => {
    const geos = [];
    for (let i = 0; i < 8; i++) {
      const a = rand() * Math.PI * 2;
      const r = 1.0 + rand() * (ISLAND_RADIUS - 1.6);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = heightAt(x, z);
      for (let k = 0; k < 3; k++) {
        const ox = (rand() - 0.5) * 0.26;
        const oz = (rand() - 0.5) * 0.26;
        const geo = new THREE.SphereGeometry(0.038 + rand() * 0.014, 8, 6);
        geo.applyMatrix4(
          new THREE.Matrix4().compose(
            new THREE.Vector3(x + ox, heightAt(x + ox, z + oz) + 0.045, z + oz),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(), rand(), rand())),
            new THREE.Vector3(1, 0.6, 1)
          )
        );
        geos.push(geo);
      }
    }
    const mesh = new THREE.Mesh(
      mergeGeometries(geos, false),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(col), roughness: 0.85 })
    );
    geos.forEach((g) => g.dispose());
    mesh.castShadow = false;
    group.add(mesh);
    void ci;
  });

  // 이끼·풀 패치
  {
    const geos = [];
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const r = 0.6 + rand() * (ISLAND_RADIUS - 1.1);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const geo = new THREE.SphereGeometry(0.1 + rand() * 0.16, 10, 6);
      geo.applyMatrix4(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, heightAt(x, z) - 0.02, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * 3, 0)),
          new THREE.Vector3(1.35, 0.16, 1.2)
        )
      );
      geos.push(geo);
    }
    const patches = new THREE.Mesh(
      mergeGeometries(geos, false),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#A8D488'), roughness: 1 })
    );
    geos.forEach((g) => g.dispose());
    patches.receiveShadow = true;
    group.add(patches);
  }

  // 디딤돌 오솔길 (작은 집에서 중앙 쪽으로 이어지는 아기자기한 돌길)
  {
    const stoneCoords = [
      [1.85, 0.85, 0.22],
      [1.45, 0.72, 0.18],
      [1.05, 0.56, 0.21],
      [0.68, 0.42, 0.17],
      [0.32, 0.26, 0.16],
      [-0.55, 0.85, 0.19],
      [-0.95, 1.08, 0.22],
      [-1.38, 1.25, 0.18],
    ];
    const geos = stoneCoords.map(([x, z, r]) => {
      const g = new THREE.CylinderGeometry(r, r * 1.08, 0.05, 10);
      g.applyMatrix4(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, heightAt(x, z) + 0.012, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, x * 2, 0)),
          new THREE.Vector3(1.15, 1, 0.88)
        )
      );
      return g;
    });
    const stones = new THREE.Mesh(
      mergeGeometries(geos, false),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#EFE6D5'), roughness: 0.92 })
    );
    geos.forEach((g) => g.dispose());
    stones.receiveShadow = true;
    group.add(stones);
  }

  // 작은 정원 가로등 (중앙 옆 따뜻한 포인트)
  {
    const lx = -1.25;
    const lz = 0.65;
    const ly = heightAt(lx, lz);
    const lanternGroup = new THREE.Group();
    lanternGroup.position.set(lx, ly, lz);
    const woodMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#9D7A58'), roughness: 0.85 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.55, 8), woodMat);
    post.position.y = 0.27;
    post.castShadow = true;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8), woodMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0.08, 0.52, 0);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 12, 10),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#FFF3C4'),
        emissive: new THREE.Color('#FFD166'),
        emissiveIntensity: 0.75,
        roughness: 0.3,
      })
    );
    bulb.position.set(0.15, 0.45, 0);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.06, 8), woodMat);
    cap.position.set(0.15, 0.51, 0);
    lanternGroup.add(post, arm, bulb, cap);
    group.add(lanternGroup);
  }

  /* ---- 주변을 떠다니는 구름 ---- */
  const ambientClouds = new THREE.Group();
  ambientClouds.name = 'ambient-clouds';
  const cloudMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FFFFFF'),
    roughness: 1,
    transparent: true,
    opacity: 0.92,
  });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand() * 0.4;
    const dist = 8 + rand() * 7;
    const c = new THREE.Group();
    const n = 5 + Math.floor(rand() * 4);
    for (let j = 0; j < n; j++) {
      const r = 0.35 + rand() * 0.5;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), cloudMat);
      puff.position.set((j - n / 2) * r * 0.9, rand() * 0.16, (rand() - 0.5) * 0.7);
      puff.scale.set(1.15, 0.62, 1.05);
      c.add(puff);
    }
    c.position.set(Math.cos(a) * dist, -2.0 + rand() * 5.2, Math.sin(a) * dist);
    c.userData.speed = 0.04 + rand() * 0.05;
    c.userData.phase = rand() * Math.PI * 2;
    c.userData.baseY = c.position.y;
    ambientClouds.add(c);
  }
  group.add(ambientClouds);

  /* ---- 멀리 보이는 작은 섬들 ---- */
  const farIslands = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = 2.1 + i * 2.0;
    const d = 20 + i * 4;
    const fi = new THREE.Group();
    const top = new THREE.Mesh(
      lathe(
        [
          [0, 0.5],
          [0.7, 0.44],
          [1.2, 0.3],
          [1.5, 0.05],
          [1.55, -0.12],
        ],
        32
      ),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#BEE3A0'), roughness: 1 })
    );
    const base = puffCloud({
      count: 5,
      ringMin: 0.2,
      ringMax: 0.9,
      y: -0.35,
      sizeMin: 0.5,
      sizeMax: 0.8,
      color: '#FFFFFF',
      seed: 17 + i,
    });
    fi.add(top, base);
    fi.position.set(Math.cos(a) * d, -0.5 + i * 1.1, Math.sin(a) * d);
    fi.rotation.y = rand() * Math.PI;
    farIslands.add(fi);
  }
  group.add(farIslands);

  return {
    group,
    grass,
    ambientClouds,
    grassMaterial: grassMat,
    update(t) {
      ambientClouds.children.forEach((c) => {
        c.position.x += Math.sin(t * 0.12 + c.userData.phase) * 0.0018;
        c.position.y = c.userData.baseY + Math.sin(t * 0.28 + c.userData.phase) * 0.22;
      });
      ambientClouds.rotation.y = t * 0.012;
      farIslands.rotation.y = -t * 0.006;
    },
  };
}
