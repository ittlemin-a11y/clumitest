import { createProp, disposeProp, PROP_META } from '../objects/propFactory.js';
import { heightAt, ISLAND_RADIUS } from '../core/island.js';
import * as THREE from 'three';

/* ---------------------------------------------------------------------------
 * 섬 꾸미기 — 배치 / 선택 / 이동 / 삭제
 * ------------------------------------------------------------------------- */

const MAX_R = ISLAND_RADIUS - 0.68;

export class Placement {
  constructor({ camera, dom, layer, grass, objectRoot, onChange, onSelect, canInteract }) {
    this.camera = camera;
    this.dom = dom;
    this.layer = layer;
    this.grass = grass;
    this.objectRoot = objectRoot;
    this.onChange = onChange || (() => {});
    this.onSelect = onSelect || (() => {});
    this.canInteract = canInteract || (() => true);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.items = new Map();
    this.pendingType = null;
    this.selected = null;
    this.dragging = null;
    this.ghost = null;
    this.pointerDown = null;
    this.multiTouch = false;
    this.seq = 0;
    this.controls = null;
    this.clock = 0;

    /* 선택 표시 링 */
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.44, 0.022, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.ring.renderOrder = 3;
    this.objectRoot.add(this.ring);

    this._bind();
  }

  attachControls(controls) {
    this.controls = controls;
  }

  _bind() {
    this.onPointerDown = (e) => this._down(e);
    this.onPointerMove = (e) => this._move(e);
    this.onPointerUp = (e) => this._up(e);
    this.onPointerCancel = () => {
      this._endDrag();
      this.pointerDown = null;
    };
    this.dom.addEventListener('pointerdown', this.onPointerDown);
    this.dom.addEventListener('pointermove', this.onPointerMove);
    this.dom.addEventListener('pointerup', this.onPointerUp);
    this.dom.addEventListener('pointercancel', this.onPointerCancel);
    this.dom.addEventListener('pointerleave', this.onPointerCancel);
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this.onPointerDown);
    this.dom.removeEventListener('pointermove', this.onPointerMove);
    this.dom.removeEventListener('pointerup', this.onPointerUp);
    this.dom.removeEventListener('pointercancel', this.onPointerCancel);
    this.dom.removeEventListener('pointerleave', this.onPointerCancel);
  }

  _ndc(e) {
    const r = this.dom.getBoundingClientRect();
    this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    return this.pointer;
  }

  _hitGrass(e) {
    this.raycaster.setFromCamera(this._ndc(e), this.camera);
    const hits = this.raycaster.intersectObject(this.grass, false);
    return hits.length ? hits[0].point.clone() : null;
  }

  _hitProp(e) {
    this.raycaster.setFromCamera(this._ndc(e), this.camera);
    const targets = [];
    for (const item of this.items.values()) targets.push(item.group);
    const hits = this.raycaster.intersectObjects(targets, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.propId) o = o.parent;
    if (!o) return null;
    return this.items.get(o.userData.propId) || null;
  }

  /* ---- 모드 ---- */
  startPlacing(type) {
    this.pendingType = type;
    this._makeGhost(type);
    this.select(null);
    this.dom.style.cursor = 'copy';
  }

  cancelPlacing() {
    this.pendingType = null;
    this._removeGhost();
    this.dom.style.cursor = '';
  }

  _makeGhost(type) {
    this._removeGhost();
    const g = createProp(type);
    g.traverse((c) => {
      if (c.isMesh) {
        c.material = c.material.clone();
        c.material.transparent = true;
        c.material.opacity = 0.45;
        c.material.depthWrite = false;
        c.castShadow = false;
      }
    });
    g.visible = false;
    this.layer.add(g);
    this.ghost = g;
  }

  _removeGhost() {
    if (!this.ghost) return;
    this.layer.remove(this.ghost);
    disposeProp(this.ghost);
    this.ghost = null;
  }

  /* ---- 배치 ---- */
  place(type, x, z, rot) {
    const group = createProp(type);
    group.position.set(x, heightAt(x, z) + (PROP_META[type]?.offsetY || 0), z);
    group.rotation.y = rot ?? Math.random() * Math.PI * 2;
    const id = `p${++this.seq}`;
    group.userData.propId = id;
    group.userData.baseScale = group.scale.x;
    group.scale.setScalar(group.scale.x * 0.01);
    group.userData.appear = 0;
    this.layer.add(group);
    const item = { id, type, group, x, z, rot: group.rotation.y };
    this.items.set(id, item);
    return item;
  }

  addType(type, x, z, rot) {
    const item = this.place(type, x, z, rot);
    item.group.scale.setScalar(item.group.userData.baseScale);
    item.group.userData.appear = 1;
    return item;
  }

  remove(id) {
    const item = this.items.get(id);
    if (!item) return;
    this.layer.remove(item.group);
    disposeProp(item.group);
    this.items.delete(id);
    if (this.selected && this.selected.id === id) this.select(null);
    this.onChange();
  }

  clearAll() {
    for (const id of [...this.items.keys()]) {
      const item = this.items.get(id);
      this.layer.remove(item.group);
      disposeProp(item.group);
    }
    this.items.clear();
    this.select(null);
    this.onChange();
  }

  select(item) {
    this.selected = item || null;
    if (!this.selected) {
      this.ring.visible = false;
      this.onSelect(null);
      return;
    }
    this.ring.visible = true;
    this.ring.position.set(
      this.selected.x,
      heightAt(this.selected.x, this.selected.z) + 0.03,
      this.selected.z
    );
    this.onSelect(this.selected);
  }

  getSelected() {
    return this.selected;
  }

  serialize() {
    return [...this.items.values()].map((it) => ({
      type: it.type,
      x: +it.x.toFixed(3),
      z: +it.z.toFixed(3),
      rot: +it.rot.toFixed(3),
    }));
  }

  restore(list) {
    for (const p of list) {
      if (!PROP_META[p.type]) continue;
      const x = Math.max(-MAX_R, Math.min(MAX_R, Number(p.x) || 0));
      const z = Math.max(-MAX_R, Math.min(MAX_R, Number(p.z) || 0));
      const r = Math.hypot(x, z);
      const k = r > MAX_R ? MAX_R / r : 1;
      this.addType(p.type, x * k, z * k, typeof p.rot === 'number' ? p.rot : 0);
    }
  }

  /* ---- 포인터 ---- */
  _down(e) {
    if (!this.canInteract()) return;
    if (e.pointerType === 'touch' && e.isPrimary === false) {
      this.multiTouch = true;
      this._endDrag();
      return;
    }
    this.pointerDown = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    const hitSelect = this._hitProp(e);
    if (hitSelect && !this.pendingType) {
      this.select(hitSelect);
      this._startDrag(hitSelect);
    }
  }

  _startDrag(item) {
    this.dragging = item;
    if (this.controls) this.controls.enabled = false;
    this.dom.style.cursor = 'grabbing';
  }

  _endDrag() {
    if (this.dragging) {
      this.dragging.group.scale.setScalar(this.dragging.group.userData.baseScale || 1);
      this.onChange();
    }
    this.dragging = null;
    if (this.controls) this.controls.enabled = true;
    this.dom.style.cursor = this.pendingType ? 'copy' : '';
  }

  _move(e) {
    if (!this.canInteract()) return;
    if (this.multiTouch) return;

    if (this.dragging) {
      const p = this._hitGrass(e);
      if (p) {
        let { x, z } = p;
        const r = Math.hypot(x, z);
        if (r > MAX_R) {
          x = (x / r) * MAX_R;
          z = (z / r) * MAX_R;
        }
        const it = this.dragging;
        it.x = x;
        it.z = z;
        it.group.position.set(x, heightAt(x, z) + (PROP_META[it.type]?.offsetY || 0), z);
        this.ring.position.set(x, heightAt(x, z) + 0.03, z);
        it.group.scale.setScalar((it.group.userData.baseScale || 1) * 1.04);
      }
      return;
    }

    if (this.pendingType && this.ghost) {
      const p = this._hitGrass(e);
      if (p) {
        let { x, z } = p;
        const r = Math.hypot(x, z);
        if (r > MAX_R) {
          x = (x / r) * MAX_R;
          z = (z / r) * MAX_R;
        }
        this.ghost.visible = true;
        this.ghost.position.set(x, heightAt(x, z) + (PROP_META[this.pendingType]?.offsetY || 0), z);
      } else {
        this.ghost.visible = false;
      }
    }
  }

  _up(e) {
    const down = this.pointerDown;
    this.pointerDown = null;
    const wasMulti = this.multiTouch;
    this.multiTouch = false;
    if (this.dragging) {
      this._endDrag();
      return;
    }
    if (!down || wasMulti || !this.canInteract()) return;

    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const elapsed = performance.now() - down.t;
    if (moved > 9 || elapsed > 700) return; // 회전 드래그로 판단

    if (this.pendingType) {
      const propHit = this._hitProp(e);
      if (propHit) {
        this.cancelPlacing();
        this.select(propHit);
        return;
      }
      const p = this._hitGrass(e);
      if (p) {
        let { x, z } = p;
        const r = Math.hypot(x, z);
        if (r > MAX_R) {
          x = (x / r) * MAX_R;
          z = (z / r) * MAX_R;
        }
        const rot = Math.random() * Math.PI * 2;
        this.place(this.pendingType, x, z, rot);
        this._removeGhost();
        this._makeGhost(this.pendingType);
        this.onChange();
        if (this.onPlaced) this.onPlaced(this.pendingType);
      }
      return;
    }

    const hit = this._hitProp(e);
    this.select(hit || null);
  }

  update(dt, t) {
    this.clock = t;
    for (const item of this.items.values()) {
      if (item.group.userData.tick) item.group.userData.tick(t);
      const appear = item.group.userData.appear ?? 1;
      if (appear < 1) {
        item.group.userData.appear = Math.min(1, appear + dt * 3.4);
        const k = item.group.userData.appear;
        const overshoot = 1 + Math.sin(Math.min(1, k) * Math.PI) * 0.12;
        item.group.scale.setScalar((item.group.userData.baseScale || 1) * k * overshoot);
      }
    }
    if (this.ring.visible) {
      const s = 1 + Math.sin(t * 3) * 0.04;
      this.ring.scale.set(s, s, 1);
      this.ring.material.opacity = 0.75 + Math.sin(t * 3) * 0.15;
    }
  }
}
