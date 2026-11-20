import * as THREE from 'three';

/* ---------------------------------------------------------------------------
 * 감정별 날씨 파티클
 * - 빛 입자 / 빗방울 / 열기 스파크 / 소용돌이 바람 / 별빛 / 안개 / 새싹 빛가루
 * ------------------------------------------------------------------------- */

function makeTexture(kind) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;

  if (kind === 'streak') {
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 5, 0, 10, size);
  } else if (kind === 'star') {
    ctx.translate(cx, cy);
    const spikes = 4;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? cx * 0.95 : cx * 0.16;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, cx);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fill();
  } else if (kind === 'leaf') {
    ctx.translate(cx, cy);
    ctx.rotate(-0.5);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, cx * 0.8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, cx * 0.5, cx * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const TEX = {};

function tex(kind) {
  if (!TEX[kind]) TEX[kind] = makeTexture(kind);
  return TEX[kind];
}

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSizeScale;
  varying float vTwinkle;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float tw = 0.62 + 0.38 * sin(uTime * 2.2 + aPhase);
    vTwinkle = tw;
    float size = aSize * uSizeScale * uPixelRatio * tw;
    gl_PointSize = size * (300.0 / max(0.001, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vTwinkle;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    float a = t.a * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`;

class ParticleField {
  constructor({ count, kind, color, opacity = 0.9, sizeScale = 1, sizeRange = [0.1, 0.2], twinkleSpeed = 1 }) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.phases = new Float32Array(count);
    this.data = new Array(count);
    for (let i = 0; i < count; i++) {
      this.sizes[i] = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
      this.phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(this.phases, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 40);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: tex(kind) },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) },
        uSizeScale: { value: sizeScale },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.material.uniforms.uTime.value = 0;
    void twinkleSpeed;
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(this.points);
    this.time = 0;
  }

  setColor(hex) {
    this.material.uniforms.uColor.value.set(hex);
  }

  update(dt, t) {
    this.time = t;
    this.material.uniforms.uTime.value = t;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

/* ---- 감정별 시스템 ---- */
function rainSystem(color) {
  const field = new ParticleField({
    count: 460,
    kind: 'streak',
    color,
    opacity: 0.55,
    sizeScale: 0.55,
    sizeRange: [0.55, 1.1],
  });
  const d = field.data;
  for (let i = 0; i < field.count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 7.5;
    d[i] = {
      speed: 5.5 + Math.random() * 4,
      x: Math.cos(a) * r,
      y: Math.random() * 11 - 2,
      z: Math.sin(a) * r,
    };
    field.positions[i * 3] = d[i].x;
    field.positions[i * 3 + 1] = d[i].y;
    field.positions[i * 3 + 2] = d[i].z;
  }
  const update = (dt, t) => {
    field.update(dt, t);
    for (let i = 0; i < field.count; i++) {
      const p = d[i];
      p.y -= p.speed * dt;
      if (p.y < -3.2) {
        p.y = 8.5 + Math.random() * 2.5;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 7.5;
        p.x = Math.cos(a) * r;
        p.z = Math.sin(a) * r;
      }
      field.positions[i * 3] = p.x;
      field.positions[i * 3 + 1] = p.y;
      field.positions[i * 3 + 2] = p.z;
    }
    field.points.geometry.attributes.position.needsUpdate = true;
  };
  return { group: field.group, update, setColor: (c) => field.setColor(c), dispose: () => field.dispose() };
}

function riseSystem({ color, count, kind, speed, spread, yMin, yMax, sizeRange, opacity, sizeScale, drift = 1, twinkle = 1 }) {
  const field = new ParticleField({
    count,
    kind,
    color,
    opacity,
    sizeScale,
    sizeRange,
  });
  const d = field.data;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * spread;
    d[i] = {
      x: Math.cos(a) * r,
      y: yMin + Math.random() * (yMax - yMin),
      z: Math.sin(a) * r,
      vy: speed * (0.6 + Math.random() * 0.8),
      phase: Math.random() * Math.PI * 2,
      swirl: (Math.random() - 0.5) * 0.6,
      wob: 0.25 + Math.random() * 0.45,
    };
    field.positions[i * 3] = d[i].x;
    field.positions[i * 3 + 1] = d[i].y;
    field.positions[i * 3 + 2] = d[i].z;
  }
  void twinkle;
  const update = (dt, t) => {
    field.update(dt, t);
    for (let i = 0; i < count; i++) {
      const p = d[i];
      p.y += p.vy * dt;
      p.x += Math.sin(t * 0.7 + p.phase) * p.wob * dt * drift;
      p.z += Math.cos(t * 0.55 + p.phase * 1.3) * p.wob * dt * drift;
      const r = Math.hypot(p.x, p.z);
      if (p.y > yMax) {
        p.y = yMin;
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * spread;
        p.x = Math.cos(a) * rr;
        p.z = Math.sin(a) * rr;
      } else if (r > spread * 1.15) {
        p.x *= 0.985;
        p.z *= 0.985;
      }
      field.positions[i * 3] = p.x;
      field.positions[i * 3 + 1] = p.y;
      field.positions[i * 3 + 2] = p.z;
    }
    field.points.geometry.attributes.position.needsUpdate = true;
  };
  return { group: field.group, update, setColor: (c) => field.setColor(c), dispose: () => field.dispose() };
}

function swirlSystem(color) {
  const field = new ParticleField({
    count: 260,
    kind: 'streak',
    color,
    opacity: 0.5,
    sizeScale: 0.5,
    sizeRange: [0.5, 1.0],
  });
  const d = field.data;
  for (let i = 0; i < 260; i++) {
    d[i] = {
      angle: Math.random() * Math.PI * 2,
      radius: 3.6 + Math.random() * 3.6,
      y: -0.4 + Math.random() * 4.2,
      speed: (0.35 + Math.random() * 0.7) * (Math.random() > 0.25 ? 1 : -1),
      bob: Math.random() * Math.PI * 2,
    };
  }
  const arcs = new THREE.Group();
  const arcMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  for (let i = 0; i < 3; i++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(4.6 + i * 0.9, 0.012, 4, 90, Math.PI * 1.25), arcMat);
    arc.rotation.x = Math.PI / 2 - 0.25 + i * 0.08;
    arc.position.y = 0.9 + i * 0.8;
    arc.userData.spin = (i % 2 ? -1 : 1) * (0.1 + i * 0.03);
    arcs.add(arc);
  }
  const group = new THREE.Group();
  group.add(field.group, arcs);

  const update = (dt, t) => {
    field.update(dt, t);
    for (let i = 0; i < 260; i++) {
      const p = d[i];
      p.angle += p.speed * dt;
      const r = p.radius + Math.sin(t * 0.8 + p.bob) * 0.35;
      field.positions[i * 3] = Math.cos(p.angle) * r;
      field.positions[i * 3 + 1] = p.y + Math.sin(t * 0.9 + p.bob) * 0.3;
      field.positions[i * 3 + 2] = Math.sin(p.angle) * r;
    }
    field.points.geometry.attributes.position.needsUpdate = true;
    arcs.children.forEach((a) => (a.rotation.z += a.userData.spin * dt));
  };
  return {
    group,
    update,
    setColor: (c) => {
      field.setColor(c);
      arcMat.color.set(c);
    },
    dispose: () => {
      field.dispose();
      arcs.children.forEach((a) => a.geometry.dispose());
      arcMat.dispose();
    },
  };
}

function starSystem(color) {
  const field = new ParticleField({
    count: 240,
    kind: 'star',
    color,
    opacity: 0.95,
    sizeScale: 1.15,
    sizeRange: [0.12, 0.3],
  });
  const d = field.data;
  for (let i = 0; i < 240; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.pow(Math.random(), 0.6) * 8.5;
    d[i] = {
      a,
      r,
      y: 0.6 + Math.random() * 6.4,
      speed: 0.02 + Math.random() * 0.05,
      bob: Math.random() * Math.PI * 2,
    };
  }
  const group = new THREE.Group();
  group.add(field.group);
  const update = (dt, t) => {
    field.update(dt, t);
    for (let i = 0; i < 240; i++) {
      const p = d[i];
      p.a += p.speed * dt;
      field.positions[i * 3] = Math.cos(p.a) * p.r;
      field.positions[i * 3 + 1] = p.y + Math.sin(t * 0.5 + p.bob) * 0.25;
      field.positions[i * 3 + 2] = Math.sin(p.a) * p.r;
    }
    field.points.geometry.attributes.position.needsUpdate = true;
    group.rotation.y = Math.sin(t * 0.05) * 0.15;
  };
  return { group, update, setColor: (c) => field.setColor(c), dispose: () => field.dispose() };
}

function mistSystem(color) {
  const field = new ParticleField({
    count: 40,
    kind: 'soft',
    color,
    opacity: 0.2,
    sizeScale: 4.0,
    sizeRange: [0.5, 1.1],
  });
  const d = field.data;
  for (let i = 0; i < 46; i++) {
    d[i] = {
      x: (Math.random() - 0.5) * 13,
      y: -0.6 + Math.random() * 3.2,
      z: (Math.random() - 0.5) * 13,
      vx: 0.12 + Math.random() * 0.2,
      bob: Math.random() * Math.PI * 2,
    };
  }
  const update = (dt, t) => {
    field.update(dt, t);
    for (let i = 0; i < 46; i++) {
      const p = d[i];
      p.x += p.vx * dt;
      if (p.x > 7) p.x = -7;
      field.positions[i * 3] = p.x;
      field.positions[i * 3 + 1] = p.y + Math.sin(t * 0.25 + p.bob) * 0.18;
      field.positions[i * 3 + 2] = p.z;
    }
    field.points.geometry.attributes.position.needsUpdate = true;
  };
  return { group: field.group, update, setColor: (c) => field.setColor(c), dispose: () => field.dispose() };
}

function sproutSystem(color) {
  const field = new ParticleField({
    count: 150,
    kind: 'leaf',
    color,
    opacity: 0.85,
    sizeScale: 0.85,
    sizeRange: [0.12, 0.26],
  });
  const d = field.data;
  for (let i = 0; i < 150; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 4.6;
    d[i] = {
      x: Math.cos(a) * r,
      y: Math.random() * 3.4,
      z: Math.sin(a) * r,
      vy: 0.16 + Math.random() * 0.22,
      phase: Math.random() * Math.PI * 2,
    };
  }
  const update = (dt, t) => {
    field.update(dt, t);
    for (let i = 0; i < 150; i++) {
      const p = d[i];
      p.y += p.vy * dt;
      p.x += Math.sin(t * 0.9 + p.phase) * 0.18 * dt;
      p.z += Math.cos(t * 0.7 + p.phase) * 0.18 * dt;
      if (p.y > 3.5) {
        p.y = 0;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 4.6;
        p.x = Math.cos(a) * r;
        p.z = Math.sin(a) * r;
      }
      field.positions[i * 3] = p.x;
      field.positions[i * 3 + 1] = p.y;
      field.positions[i * 3 + 2] = p.z;
    }
    field.points.geometry.attributes.position.needsUpdate = true;
  };
  return { group: field.group, update, setColor: (c) => field.setColor(c), dispose: () => field.dispose() };
}

export function createWeatherSystem(kind, color) {
  switch (kind) {
    case 'rain':
      return rainSystem(color);
    case 'embers':
      return riseSystem({
        color,
        count: 170,
        kind: 'soft',
        speed: 0.9,
        spread: 5.2,
        yMin: -1.2,
        yMax: 3.8,
        sizeRange: [0.09, 0.21],
        opacity: 0.95,
        sizeScale: 1,
        drift: 1.4,
      });
    case 'wind':
      return swirlSystem(color);
    case 'stars':
      return starSystem(color);
    case 'mist':
      return mistSystem(color);
    case 'sprouts':
      return sproutSystem(color);
    case 'motes':
    default:
      return riseSystem({
        color,
        count: 130,
        kind: 'soft',
        speed: 0.22,
        spread: 5.6,
        yMin: 0,
        yMax: 4.2,
        sizeRange: [0.07, 0.19],
        opacity: 0.8,
        sizeScale: 1.3,
        drift: 1,
      });
  }
}

/** 클루미를 쓰다듬었을 때 터지는 작은 반짝이 */
export class ClumiBurst {
  constructor(scene, color) {
    this.count = 16;
    this.pos = new Float32Array(this.count * 3);
    this.vel = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.material = new THREE.PointsMaterial({
      size: 0.22,
      map: tex('star'),
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.life = 0;
    this.origin = new THREE.Vector3();
  }

  setColor(hex) {
    this.material.color.set(hex);
  }

  emit(position) {
    this.origin.copy(position);
    this.life = 1;
    this.vel = [];
    for (let i = 0; i < this.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = 0.6 + Math.random() * 1.4;
      const r = 0.4 + Math.random() * 1.1;
      this.vel.push(new THREE.Vector3(Math.cos(a) * r, up, Math.sin(a) * r));
      this.pos[i * 3] = position.x + (Math.random() - 0.5) * 0.3;
      this.pos[i * 3 + 1] = position.y + 1.0 + (Math.random() - 0.5) * 0.4;
      this.pos[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.3;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    if (this.life <= 0) {
      this.material.opacity = 0;
      return;
    }
    this.life = Math.max(0, this.life - dt * 0.85);
    this.material.opacity = this.life * 0.95;
    for (let i = 0; i < this.count; i++) {
      const v = this.vel[i];
      v.y -= 0.9 * dt;
      this.pos[i * 3] += v.x * dt;
      this.pos[i * 3 + 1] += v.y * dt;
      this.pos[i * 3 + 2] += v.z * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
