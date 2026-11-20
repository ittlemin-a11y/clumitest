import * as THREE from 'three';

/**
 * 현재 섬을 PNG 카드로 저장합니다.
 * WebGL 캔버스에서 바로 읽지 않고(드로잉 버퍼가 비어 있을 수 있음)
 * 렌더타깃에 한 번 그린 뒤 픽셀을 읽어와 합성합니다.
 */
export async function captureIsland({ renderer, scene, camera, emotionLabel, logoSrc }) {
  // 캔버스가 아주 크면(고해상도 화면) 읽어올 픽셀 수를 줄여 부담을 낮춥니다.
  const cw = renderer.domElement.width;
  const ch = renderer.domElement.height;
  const k = Math.min(1, 1800 / Math.max(cw, ch));
  const W = Math.max(1, Math.round(cw * k));
  const H = Math.max(1, Math.round(ch * k));

  const rt = new THREE.WebGLRenderTarget(W, H, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.SRGBColorSpace,
  });
  const prevTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(scene, camera);
  const buffer = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, buffer);
  renderer.setRenderTarget(prevTarget);
  rt.dispose();

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(W, H);
  const rowBytes = W * 4;
  for (let y = 0; y < H; y++) {
    const src = (H - 1 - y) * rowBytes;
    img.data.set(buffer.subarray(src, src + rowBytes), y * rowBytes);
  }
  ctx.putImageData(img, 0, 0);

  const scale = W / 1400;
  const pad = 34 * scale;
  const stripH = 96 * scale;

  // 하단 크림 스트립
  const grad = ctx.createLinearGradient(0, H - stripH * 2.2, 0, H);
  grad.addColorStop(0, 'rgba(255,253,247,0)');
  grad.addColorStop(0.55, 'rgba(255,253,247,0.86)');
  grad.addColorStop(1, 'rgba(255,253,247,0.98)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - stripH * 2.2, W, stripH * 2.2);

  try {
    const logo = await loadImage(logoSrc);
    const logoSize = 58 * scale;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(logo, pad, H - stripH * 0.95, logoSize, logoSize);
    ctx.restore();
  } catch {
    /* 로고가 없어도 저장은 계속 */
  }

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(35,42,77,0.62)';
  ctx.font = `600 ${17 * scale}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText('CLUMI UNIVERSE', pad + 72 * scale, H - stripH * 0.72);

  ctx.fillStyle = '#232A4D';
  ctx.font = `700 ${30 * scale}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText('MY WEATHER ISLAND', pad + 72 * scale, H - stripH * 0.4);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(35,42,77,0.55)';
  ctx.font = `500 ${19 * scale}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`오늘의 감정 · ${emotionLabel}`, W - pad, H - stripH * 0.55);
  ctx.font = `400 ${15 * scale}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(35,42,77,0.4)';
  ctx.fillText('Every heart has its own weather.', W - pad, H - stripH * 0.28);

  const url = out.toDataURL('image/png');
  const a = document.createElement('a');
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  a.href = url;
  a.download = `my-weather-island-${emotionLabel.replace(/\s+/g, '-')}-${stamp}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return url;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
