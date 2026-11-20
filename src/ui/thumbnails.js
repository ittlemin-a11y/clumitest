import * as THREE from 'three';
import { createProp, disposeProp, PROP_TYPES } from '../objects/propFactory.js';

/**
 * 꾸미기 트레이에 쓸 소품 썸네일.
 * 별도의 WebGL 컨텍스트를 만들지 않고, 메인 렌더러 + 렌더타깃으로 그려서
 * 이미지 데이터로 변환합니다. (컨텍스트 손실/리소스 충돌 방지)
 */
export function buildPropThumbnails(renderer, types = PROP_TYPES, size = 192) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#DFEAF3');
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9d4e2', 2.4));
  const key = new THREE.DirectionalLight('#ffffff', 2.2);
  key.position.set(2.5, 4, 3.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#dfe9ff', 0.9);
  fill.position.set(-3, 1.5, -2);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 60);
  const target = new THREE.WebGLRenderTarget(size, size, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.SRGBColorSpace,
  });

  const out = {};
  const buffer = new Uint8Array(size * size * 4);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const prevTarget = renderer.getRenderTarget();
  const prevToneMapping = renderer.toneMapping;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  for (const type of types) {
    const prop = createProp(type);
    const group = new THREE.Group();
    group.add(prop);
    const box0 = new THREE.Box3().setFromObject(prop);
    const size0 = box0.getSize(new THREE.Vector3());
    const baseR = Math.max(0.28, Math.max(size0.x, size0.z) * 0.62);
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(baseR, baseR * 0.94, 0.06, 40),
      new THREE.MeshStandardMaterial({ color: '#CFE3BE', roughness: 1 })
    );
    pedestal.position.y = box0.min.y + 0.012;
    group.add(pedestal);
    scene.add(group);
    const box = new THREE.Box3().setFromObject(group);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const c = sphere.center;
    const fov = (camera.fov * Math.PI) / 180;
    const dist = (sphere.radius / Math.sin(fov / 2)) * 1.02;
    const dir = new THREE.Vector3(0.55, 0.42, 1).normalize();
    camera.position.copy(c).addScaledVector(dir, dist);
    camera.lookAt(c);
    camera.near = Math.max(0.01, dist - sphere.radius * 3);
    camera.far = dist + sphere.radius * 6;
    camera.updateProjectionMatrix();

    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, size, size, buffer);

    // 아래가 위로 뒤집혀 나오므로 행을 뒤집어 그립니다.
    const img = ctx.createImageData(size, size);
    const rowBytes = size * 4;
    for (let y = 0; y < size; y++) {
      const src = (size - 1 - y) * rowBytes;
      img.data.set(buffer.subarray(src, src + rowBytes), y * rowBytes);
    }
    ctx.putImageData(img, 0, 0);
    out[type] = canvas.toDataURL('image/png');

    scene.remove(group);
    disposeProp(prop);
    pedestal.geometry.dispose();
    pedestal.material.dispose();
  }

  renderer.setRenderTarget(prevTarget);
  renderer.toneMapping = prevToneMapping;
  target.dispose();
  return out;
}
