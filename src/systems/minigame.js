import * as THREE from 'three';

/* ---------------------------------------------------------------------------
 * ☁️ 미니게임: 구름 방울 잡기 (30초 타임어택)
 *  - 하늘에서 떨어지는 감정 구름 방울(+10), 황금 별(+30), 먹구름(-5)을 터치!
 *  - 연속 콤보 보너스 + 클루미 점프 반응 + Web Audio 효과음
 * ------------------------------------------------------------------------- */

const BEST_KEY = 'clumi.my-weather-island.minigame.best';
const DURATION = 30;

function playTone(freq, type = 'sine', dur = 0.14, gainVal = 0.08) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!playTone.ctx) playTone.ctx = new AC();
    const ctx = playTone.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, ctx.currentTime + dur);
    g.gain.setValueAtTime(gainVal, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch {
    // 오디오 차단 환경 무시
  }
}

function makeDropMesh(kind, emotionColor) {
  const group = new THREE.Group();

  if (kind === 'star') {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.28 : 0.125;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 });
    geo.center();
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#FFD93D'),
      emissive: new THREE.Color('#FFAA00'),
      emissiveIntensity: 0.45,
      roughness: 0.25,
    });
    group.add(new THREE.Mesh(geo, mat));
  } else if (kind === 'storm') {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5C6478'),
      roughness: 0.85,
    });
    const puffs = [
      [0, 0, 0, 0.22],
      [-0.16, -0.04, 0.02, 0.16],
      [0.16, -0.04, -0.02, 0.16],
      [0.05, 0.1, 0, 0.15],
    ];
    puffs.forEach(([x, y, z, r]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat);
      m.position.set(x, y, z);
      group.add(m);
    });
  } else {
    // 감정 구름 방울
    const col = new THREE.Color(emotionColor || '#FFD426');
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 18, 14),
      new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.28,
        roughness: 0.28,
      })
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.29, 0.032, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72 })
    );
    ring.rotation.x = Math.PI * 0.38;
    group.add(core, ring);
  }

  // 모바일/PC 넉넉한 터치 히트박스
  const hitbox = new THREE.Mesh(
    new THREE.SphereGeometry(0.56, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.userData.minigameItem = group;
  group.add(hitbox);

  return { group, hitbox };
}

export class MiniGame {
  constructor({ scene, burst, clumi, getEmotionColor, onUpdate, onEnd }) {
    this.scene = scene;
    this.burst = burst;
    this.clumi = clumi;
    this.getEmotionColor = getEmotionColor;
    this.onUpdate = onUpdate;
    this.onEnd = onEnd;

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.active = false;
    this.items = [];
    this.score = 0;
    this.combo = 0;
    this.timeLeft = DURATION;
    this.spawnTimer = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
  }

  start() {
    this.clearItems();
    this.active = true;
    this.score = 0;
    this.combo = 0;
    this.timeLeft = DURATION;
    this.spawnTimer = 0.15;
    playTone(523.25, 'sine', 0.15, 0.08);
    this.onUpdate({ timeLeft: this.timeLeft, score: this.score, combo: this.combo, best: this.best });
  }

  stop(silent = false) {
    if (!this.active) return;
    this.active = false;
    this.clearItems();
    const isNewBest = this.score > this.best;
    if (isNewBest) {
      this.best = this.score;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        // ignore
      }
    }
    if (!silent) {
      playTone(659.25, 'triangle', 0.22, 0.09);
      this.onEnd({ score: this.score, best: this.best, isNewBest });
    }
  }

  clearItems() {
    for (const it of this.items) {
      this.root.remove(it.group);
      it.group.traverse((c) => {
        c.geometry?.dispose();
        if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
        else c.material?.dispose();
      });
    }
    this.items = [];
  }

  getHitboxes() {
    return this.items.map((it) => it.hitbox);
  }

  hit(hitbox) {
    if (!this.active) return false;
    const idx = this.items.findIndex((it) => it.hitbox === hitbox);
    if (idx === -1) return false;
    const it = this.items[idx];
    const worldPos = it.group.position.clone();

    if (it.kind === 'storm') {
      this.combo = 0;
      this.score = Math.max(0, this.score - 5);
      playTone(190, 'sawtooth', 0.16, 0.06);
    } else {
      this.combo += 1;
      const basePts = it.kind === 'star' ? 30 : 10;
      const bonus = Math.min(20, (this.combo - 1) * 2);
      this.score += basePts + bonus;
      playTone(it.kind === 'star' ? 880 : 587 + Math.min(300, this.combo * 28), 'sine', 0.14, 0.08);
      this.burst.emit(worldPos);
      this.clumi.hop(0.78);
    }

    this.root.remove(it.group);
    it.group.traverse((c) => {
      c.geometry?.dispose();
      if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
      else c.material?.dispose();
    });
    this.items.splice(idx, 1);

    this.onUpdate({
      timeLeft: Math.ceil(this.timeLeft),
      score: this.score,
      combo: this.combo,
      best: this.best,
      lastKind: it.kind,
    });
    return true;
  }

  spawn() {
    const r = Math.random();
    const kind = r < 0.16 ? 'star' : r < 0.34 ? 'storm' : 'drop';
    const { group, hitbox } = makeDropMesh(kind, this.getEmotionColor());
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.5 + Math.random() * 2.8;
    group.position.set(Math.cos(angle) * dist, 4.4 + Math.random() * 0.6, Math.sin(angle) * dist);
    this.root.add(group);
    this.items.push({
      kind,
      group,
      hitbox,
      speed: kind === 'star' ? 1.45 : kind === 'storm' ? 1.15 : 0.95 + Math.random() * 0.45,
      spin: (Math.random() - 0.5) * 2.4,
    });
  }

  update(dt, elapsed) {
    if (!this.active) return;

    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.items.length < 9) {
      this.spawn();
      this.spawnTimer = 0.55 + Math.random() * 0.35;
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.group.position.y -= it.speed * dt;
      it.group.rotation.y += it.spin * dt;
      it.group.position.x += Math.sin(elapsed * 2 + i) * 0.004;
      if (it.group.position.y < 0.2) {
        this.root.remove(it.group);
        it.group.traverse((c) => {
          c.geometry?.dispose();
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material?.dispose();
        });
        this.items.splice(i, 1);
      }
    }

    this.onUpdate({
      timeLeft: Math.ceil(this.timeLeft),
      score: this.score,
      combo: this.combo,
      best: this.best,
    });

    if (this.timeLeft <= 0) {
      this.stop(false);
    }
  }
}
