import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { EMOTIONS, EMOTION_BY_ID, DEFAULT_EMOTION, shade } from './config/emotions.js';
import { createIsland, heightAt, ISLAND_RADIUS } from './core/island.js';
import { Clumi } from './objects/clumi.js';
import { PROP_META } from './objects/propFactory.js';
import { createWeatherSystem, ClumiBurst } from './systems/particles.js';
import { Placement } from './systems/placement.js';
import { captureIsland } from './systems/capture.js';
import { loadState, saveState } from './systems/storage.js';
import { Hud } from './ui/hud.js';
import { buildPropThumbnails } from './ui/thumbnails.js';

const LOGO = './assets/logo.png';
const FOV = 40;

/* ------------------------------------------------------------------ state */
const stored = loadState();
const state = {
  emotion: stored && EMOTION_BY_ID[stored.emotion] ? stored.emotion : DEFAULT_EMOTION,
  colors: stored?.colors || {},
  started: false,
};

/* --------------------------------------------------------------- renderer */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance',
});
const IS_SMALL = Math.min(window.innerWidth, window.innerHeight) < 820;
const DPR_CAP = IS_SMALL ? 1.75 : 2;
renderer.setPixelRatio(Math.min(DPR_CAP, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(new THREE.Color('#E6F4FB'), 0.013);

const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 220);

/* ------------------------------------------------------------------- sky */
const skyUniforms = {
  topColor: { value: new THREE.Color('#FFF3CF') },
  bottomColor: { value: new THREE.Color('#A6DBF3') },
  offset: { value: 14 },
  exponent: { value: 0.85 },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(90, 32, 20),
  new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        float t = pow(clamp(h, 0.0, 1.0), exponent);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })
);
sky.frustumCulled = false;
scene.add(sky);

/* ----------------------------------------------------------------- lights */
const hemi = new THREE.HemisphereLight(new THREE.Color('#FFFFFF'), new THREE.Color('#CFE0E8'), 1.3);
scene.add(hemi);

const sunLight = new THREE.DirectionalLight(new THREE.Color('#FFF3D2'), 2.4);
sunLight.position.set(6.5, 12, 7.5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(IS_SMALL ? 1024 : 2048, IS_SMALL ? 1024 : 2048);
sunLight.shadow.camera.near = 2;
sunLight.shadow.camera.far = 40;
sunLight.shadow.camera.left = -8.5;
sunLight.shadow.camera.right = 8.5;
sunLight.shadow.camera.top = 8.5;
sunLight.shadow.camera.bottom = -8.5;
sunLight.shadow.bias = -0.0008;
sunLight.shadow.normalBias = 0.035;
sunLight.shadow.radius = 3.5;
scene.add(sunLight);
scene.add(sunLight.target);

const fillLight = new THREE.DirectionalLight(new THREE.Color('#D6E6FF'), 0.5);
fillLight.position.set(-7, 5, -6);
scene.add(fillLight);

// 카메라 쪽에서 얼굴을 살짝 밝혀주는 보조광
const faceFill = new THREE.DirectionalLight(new THREE.Color('#FFF7EA'), 0.55);
faceFill.position.set(1.5, 4, 9);
scene.add(faceFill);

const ambient = new THREE.AmbientLight(new THREE.Color('#FFF6E4'), 0.42);
scene.add(ambient);

/* ----------------------------------------------------------------- island */
const islandRoot = new THREE.Group();
scene.add(islandRoot);

const island = createIsland();
islandRoot.add(island.group);

const propLayer = new THREE.Group();
propLayer.name = 'props';
islandRoot.add(propLayer);

const weatherRoot = new THREE.Group();
weatherRoot.name = 'weather';
scene.add(weatherRoot);

/* ------------------------------------------------------------------ clumi */
const startEmotion = EMOTION_BY_ID[state.emotion];
const clumi = new Clumi({
  color: state.colors[state.emotion] || startEmotion.color,
  deep: state.colors[state.emotion] ? shade(state.colors[state.emotion], -0.32) : startEmotion.deep,
  emblem: state.emotion,
});
clumi.group.scale.setScalar(1.1);
islandRoot.add(clumi.group);

const burst = new ClumiBurst(scene, startEmotion.particleColor);

/* ---------------------------------------------------------------- controls */
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.enablePan = false;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.8;
controls.minDistance = 8;
controls.maxDistance = 34;
controls.minPolarAngle = 0.38;
controls.maxPolarAngle = 1.42;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

function mobileShift() {
  return window.innerWidth / window.innerHeight < 0.8 ? -0.8 : 0;
}

function computeDistance() {
  const aspect = Math.max(0.35, window.innerWidth / window.innerHeight);
  const visibleWidth = aspect < 0.8 ? 8.0 : aspect < 1.25 ? 12.4 : 13.0;
  const d = visibleWidth / (2 * Math.tan((FOV * Math.PI) / 360) * aspect);
  return Math.min(33, Math.max(9.5, d));
}

let baseDistance = computeDistance();

function placeCamera(distance, { elev = 0.46, targetY = -0.3 } = {}) {
  controls.target.set(0, targetY, 0);
  camera.position.set(0, targetY + Math.sin(elev) * distance, Math.cos(elev) * distance);
  camera.lookAt(controls.target);
}

placeCamera(baseDistance * 1.08, { elev: 0.5, targetY: 0.45 + mobileShift() });

/* ------------------------------------------------------------------ resize */
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(DPR_CAP, window.devicePixelRatio || 1));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();

let lastAspect = window.innerWidth / window.innerHeight;
window.addEventListener('resize', () => {
  resize();
  const aspect = window.innerWidth / window.innerHeight;
  // 화면 비율이 실제로 달라졌을 때만 (모바일 주소창 변화로는 카메라를 건드리지 않음)
  if (Math.abs(aspect - lastAspect) < 0.02) return;
  lastAspect = aspect;
  const next = computeDistance();
  baseDistance = next;
  const dist = camTween ? next : camera.position.distanceTo(controls.target);
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (!camTween) camera.position.copy(controls.target).addScaledVector(dir, dist);
});

/* ----------------------------------------------------------------- weather */
let weather = null;
let weatherFade = 1;
let weatherMats = [];

function collectWeatherMats(group) {
  const list = [];
  group.traverse((o) => {
    const m = o.material;
    if (!m) return;
    if (m.uniforms && m.uniforms.uOpacity) {
      if (m.userData.baseOpacity == null) m.userData.baseOpacity = m.uniforms.uOpacity.value;
      list.push({ m, kind: 'uniform' });
    } else if (m.transparent) {
      if (m.userData.baseOpacity == null) m.userData.baseOpacity = m.opacity;
      list.push({ m, kind: 'opacity' });
    }
  });
  return list;
}

function setWeather(kind, color) {
  if (weather) {
    weatherRoot.remove(weather.group);
    weather.dispose();
  }
  weather = createWeatherSystem(kind, color);
  weatherRoot.add(weather.group);
  weatherMats = collectWeatherMats(weather.group);
  weatherFade = 0;
}

/* ------------------------------------------------------------------ colors */
const skyTarget = { top: new THREE.Color(), bottom: new THREE.Color(), fog: new THREE.Color() };
const groundTarget = {
  grass: new THREE.Color(),
  light: new THREE.Color(),
  ambient: new THREE.Color(),
  hemi: new THREE.Color(),
};
let lightTarget = 2.4;

/* ---------------------------------------------------------------------- UI */
let placement = null;

let thumbnails = {};
try {
  thumbnails = buildPropThumbnails(renderer);
} catch (err) {
  console.warn('소품 썸네일을 만들지 못했습니다', err);
}

const hud = new Hud({
  thumbs: thumbnails,
  onStart: () => startGame(),
  onEmotion: (id) => {
    setEmotion(id);
    persist();
  },
  onPropType: (type) => {
    placement.startPlacing(type);
    hud.setPlacing(type);
    hud.setSelected(null);
    hud.closeTray();
  },
  onTrayOpen: () => {
    placement.cancelPlacing();
    placement.select(null);
    hud.setPlacing(null);
    hud.setSelected(null);
  },
  onCapture: () => shoot(),
  onDelete: () => {
    const sel = placement.getSelected();
    if (!sel) return;
    placement.remove(sel.id);
    hud.setSelected(null);
    hud.toast('소품을 지웠어요');
    persist();
  },
  onDone: () => {
    placement.cancelPlacing();
    placement.select(null);
    hud.setPlacing(null);
    hud.setSelected(null);
  },
  onReset: () => {
    placement.clearAll();
    hud.setSelected(null);
    hud.toast('섬을 처음 모습으로 되돌렸어요');
    persist();
  },
  onColor: (hex) => {
    state.colors[state.emotion] = hex;
    applyEmotionColors({ instant: false });
    persist();
  },
  onColorReset: () => {
    delete state.colors[state.emotion];
    applyEmotionColors({ instant: false });
    persist();
    hud.toast('기본 컬러로 돌아갔어요');
  },
});

/* --------------------------------------------------------------- placement */
placement = new Placement({
  camera,
  dom: canvas,
  layer: propLayer,
  grass: island.grass,
  objectRoot: islandRoot,
  canInteract: () => state.started,
  onChange: () => persist(),
  onSelect: (item) => {
    hud.setSelected(item);
    if (item) hud.setPlacing(null);
  },
});
placement.attachControls(controls);
placement.onPlaced = () => {
  hud.showHint(1600);
};

const STARTER = [
  ['tree', -2.6, 1.4, 0.4],
  ['tree', 2.5, -1.7, 1.1],
  ['house', 2.2, 1.9, -0.5],
  ['mushroom', -1.6, 2.6, 0.2],
  ['rock', 0.5, 2.9, 0.9],
  ['flower', 3.0, 0.2, 0],
  ['rainbow', 1.1, -2.7, 0],
  ['star', -2.5, -1.7, 0],
];

if (stored?.props?.length) {
  placement.restore(stored.props);
} else if (!stored?.seen) {
  // 첫 방문: 빈 섬보다 완성된 섬이 먼저 보이도록 기본 배치
  STARTER.forEach(([type, x, z, rot]) => placement.addType(type, x, z, rot));
  saveState({ version: 1, emotion: state.emotion, colors: state.colors, props: placement.serialize(), seen: true }, true);
}

/* ------------------------------------------------------------------ apply */
function applyEmotionColors({ instant = false } = {}) {
  const base = EMOTION_BY_ID[state.emotion];
  const custom = state.colors[state.emotion];
  const color = custom || base.color;
  const deep = custom ? shade(color, -0.32) : base.deep;
  const particleColor = custom ? shade(color, 0.42) : base.particleColor;

  skyTarget.top.set(base.skyTop);
  skyTarget.bottom.set(base.skyBottom);
  skyTarget.fog.set(base.fog);
  groundTarget.grass.set(base.grass);
  groundTarget.light.set(base.light);
  groundTarget.ambient.set(base.ambient);
  groundTarget.hemi.set(shade(base.grass, 0.35));
  lightTarget = base.lightIntensity;

  clumi.setEmotion({ color, deep, emblem: state.emotion });
  burst.setColor(particleColor);
  if (weather) weather.setColor(particleColor);

  hud.updateEmotion({ ...base, displayColor: color });

  if (instant) {
    skyUniforms.topColor.value.copy(skyTarget.top);
    skyUniforms.bottomColor.value.copy(skyTarget.bottom);
    scene.fog.color.copy(skyTarget.fog);
    island.grassMaterial.color.copy(groundTarget.grass);
    sunLight.color.copy(groundTarget.light);
    sunLight.intensity = lightTarget;
    ambient.color.copy(groundTarget.ambient);
    hemi.color.copy(groundTarget.hemi);
  }
}

function setEmotion(id, { instant = false, announce = false } = {}) {
  if (!EMOTION_BY_ID[id]) return;
  state.emotion = id;
  applyEmotionColors({ instant });
  const base = EMOTION_BY_ID[id];
  setWeather(base.particle, state.colors[id] ? shade(state.colors[id], 0.42) : base.particleColor);
  if (announce) hud.toast(`${base.ko} · ${base.character} — ${base.mood}`, 2600);
}

/* ------------------------------------------------------------------- save */
function persist() {
  saveState({
    version: 1,
    emotion: state.emotion,
    colors: state.colors,
    props: placement.serialize(),
    seen: true,
  });
}

/* ------------------------------------------------------------------- shot */
let shooting = false;
async function shoot() {
  if (shooting) return;
  shooting = true;
  const prevRotate = controls.autoRotate;
  controls.autoRotate = false;
  hud.toast('이미지를 만들고 있어요…', 1400);
  try {
    await captureIsland({
      renderer,
      scene,
      camera,
      emotionLabel: `${EMOTION_BY_ID[state.emotion].ko} ${EMOTION_BY_ID[state.emotion].character}`,
      logoSrc: LOGO,
    });
    hud.toast('이미지로 저장했어요', 2200);
  } catch (err) {
    console.warn('이미지 저장 실패', err);
    hud.toast('이미지를 저장하지 못했어요', 2200);
  } finally {
    controls.autoRotate = prevRotate;
    shooting = false;
  }
}

/* ------------------------------------------------------------------ start */
const titleEl = document.getElementById('title');

function startGame() {
  if (state.started) return;
  state.started = true;
  hud.showGame({ ...EMOTION_BY_ID[state.emotion], displayColor: currentColor() });
  controls.autoRotate = false;
  tweenCamera({ distance: baseDistance, elev: 0.49, targetY: -0.3 + mobileShift(), duration: 1.4 });
  if (stored?.props?.length) {
    setTimeout(() => hud.toast('지난번 섬을 그대로 불러왔어요', 2400), 900);
  }
}

function currentColor() {
  return state.colors[state.emotion] || EMOTION_BY_ID[state.emotion].color;
}

/* --------------------------------------------------------------- 카메라 연출 */
let camTween = null;
function tweenCamera({ distance, elev = 0.56, targetY = 0.9, duration = 1.4 }) {
  const startPos = camera.position.clone();
  const endTarget = new THREE.Vector3(0, targetY, 0);
  const endPos = new THREE.Vector3(0, targetY + Math.sin(elev) * distance, Math.cos(elev) * distance);
  camTween = { t: 0, duration, startPos, endPos, startTarget: controls.target.clone(), endTarget };
  controls.enabled = false;
}

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

/* --------------------------------------------------------------- glb 모델 */
async function tryLoadExternalModel() {
  try {
    const res = await fetch('./models/manifest.json', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (!data || typeof data.model !== 'string' || !data.model) return;
    const modelUrl = new URL(data.model, res.url).toString();
    const gltf = await new GLTFLoader().loadAsync(modelUrl);
    clumi.setExternalModel(gltf.scene);
    hud.toast('GLB 모델을 불러왔어요', 1800);
  } catch (err) {
    console.warn('GLB 모델을 불러오지 못해 기본 모델을 사용합니다', err);
  }
}

/* ------------------------------------------------------------- 클루미 터치 */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let tapDown = null;

canvas.addEventListener('pointerdown', (e) => {
  if (!state.started) return;
  tapDown = { x: e.clientX, y: e.clientY, t: performance.now() };
});

canvas.addEventListener('pointerup', (e) => {
  if (!state.started || !tapDown) return;
  const moved = Math.hypot(e.clientX - tapDown.x, e.clientY - tapDown.y);
  const elapsed = performance.now() - tapDown.t;
  tapDown = null;
  if (moved > 9 || elapsed > 650) return;
  if (placement.pendingType) return;
  if (placement.getSelected()) return;

  const r = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(clumi.hitbox, false);
  if (hits.length) {
    clumi.react();
    const p = new THREE.Vector3();
    clumi.group.getWorldPosition(p);
    burst.emit(p);
  }
});

/* ---------------------------------------------------------------- 루프 */
const clock = new THREE.Clock();
let elapsed = 0;

function frame() {
  const dt = Math.min(0.08, clock.getDelta());
  elapsed += dt;

  // 감정 색 전환 (부드럽게)
  const k = 1 - Math.exp(-dt * 3.2);
  skyUniforms.topColor.value.lerp(skyTarget.top, k);
  skyUniforms.bottomColor.value.lerp(skyTarget.bottom, k);
  scene.fog.color.lerp(skyTarget.fog, k);
  island.grassMaterial.color.lerp(groundTarget.grass, k);
  sunLight.color.lerp(groundTarget.light, k);
  ambient.color.lerp(groundTarget.ambient, k);
  hemi.color.lerp(groundTarget.hemi, k);
  sunLight.intensity += (lightTarget - sunLight.intensity) * k;

  // 섬 둥실
  islandRoot.position.y = Math.sin(elapsed * 0.55) * 0.07;
  islandRoot.rotation.y = Math.sin(elapsed * 0.06) * 0.015;
  island.update(elapsed);

  clumi.update(dt, elapsed, heightAt, 1.75, camera);
  placement.update(dt, elapsed);
  burst.update(dt);

  if (weather) {
    weather.update(dt, elapsed);
    if (weatherFade < 1) {
      weatherFade = Math.min(1, weatherFade + dt / 0.75);
      for (const { m, kind } of weatherMats) {
        const base = m.userData.baseOpacity ?? 1;
        if (kind === 'uniform') m.uniforms.uOpacity.value = base * weatherFade;
        else m.opacity = base * weatherFade;
      }
    }
  }

  if (!window.__mw?.freeze) {
    if (camTween) {
      camTween.t += dt;
      const p = Math.min(1, camTween.t / camTween.duration);
      const e = easeOutCubic(p);
      camera.position.lerpVectors(camTween.startPos, camTween.endPos, e);
      controls.target.lerpVectors(camTween.startTarget, camTween.endTarget, e);
      if (p >= 1) {
        camTween = null;
        controls.enabled = true;
      }
    } else {
      controls.update();
    }
  }
  if (window.__mw) window.__mw.dbg = { tween: !!camTween, freeze: !!window.__mw.freeze, dt };
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ init */
applyEmotionColors({ instant: true });
setEmotion(state.emotion, { instant: true });
requestAnimationFrame(frame);

window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  setTimeout(() => loader.classList.add('hidden'), 420);
  setTimeout(() => loader.remove(), 1400);
});
setTimeout(() => {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 900);
  }
}, 2500);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) clock.getDelta();
});

tryLoadExternalModel();

/* QA / 디버그용 */
window.__mw = {
  THREE,
  state,
  setEmotion,
  placement,
  clumi,
  camera,
  controls,
  baseDistance,
  shoot,
  persist,
  restore: () => stored,
  /** QA/디버그: 진행 중인 연출을 즉시 끝 상태로 */
  settle: () => {
    if (camTween) {
      camera.position.copy(camTween.endPos);
      controls.target.copy(camTween.endTarget);
      camTween = null;
      controls.enabled = true;
    }
    skyUniforms.topColor.value.copy(skyTarget.top);
    skyUniforms.bottomColor.value.copy(skyTarget.bottom);
    scene.fog.color.copy(skyTarget.fog);
    island.grassMaterial.color.copy(groundTarget.grass);
    sunLight.color.copy(groundTarget.light);
    sunLight.intensity = lightTarget;
    ambient.color.copy(groundTarget.ambient);
    hemi.color.copy(groundTarget.hemi);
    clumi.headMat.color.copy(clumi.targetColor);
    clumi.color.copy(clumi.targetColor);
    clumi.faceCamera(camera);
    weatherFade = 1;
    for (const { m, kind } of weatherMats) {
      const base = m.userData.baseOpacity ?? 1;
      if (kind === 'uniform') m.uniforms.uOpacity.value = base;
      else m.opacity = base;
    }
  },
};
