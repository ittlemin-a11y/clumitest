import { EMOTIONS } from '../config/emotions.js';
import { PROP_META, PROP_TYPES } from '../objects/propFactory.js';

/* ---------------------------------------------------------------------------
 * HUD / 시트 UI
 * ------------------------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(handlers) {
    this.h = handlers;
    this.trayOpen = false;
    this.infoOpen = false;
    this.selected = null;
    this.toastTimer = 0;
    this.hintTimer = 0;
    this.resetArmed = false;

    this.el = {
      title: $('title'),
      hud: $('hud'),
      start: $('startBtn'),
      chips: $('emotionChips'),
      emotionLabel: $('emotionLabel'),
      hint: $('hintPill'),
      toast: $('toast'),
      infoBtn: $('infoBtn'),
      propsBtn: $('propsBtn'),
      shotBtn: $('shotBtn'),
      tray: $('tray'),
      trayClose: $('trayClose'),
      propGrid: $('propGrid'),
      resetBtn: $('resetBtn'),
      infoOverlay: $('infoOverlay'),
      infoClose: $('infoClose'),
      selectionBar: $('selectionBar'),
      selectionName: $('selectionName'),
      deleteBtn: $('deleteBtn'),
      doneBtn: $('doneBtn'),
      placingBar: $('placingBar'),
      placingName: $('placingName'),
      placingDone: $('placingDone'),
      colorInput: $('colorInput'),
      colorEmotionName: $('colorEmotionName'),
      colorReset: $('colorReset'),
    };

    this._buildChips();
    this._buildProps();
    this._bind();
  }

  _buildChips() {
    this.el.chips.innerHTML = '';
    this.chips = {};
    for (const e of EMOTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'emotion-chip';
      btn.dataset.id = e.id;
      btn.style.setProperty('--chip-color', e.color);
      btn.setAttribute('aria-label', `${e.ko} · ${e.character}`);
      btn.innerHTML = `<span class="dot" style="background:${e.color}"></span><span class="label">${e.ko}</span>`;
      btn.addEventListener('click', () => this.h.onEmotion(e.id));
      this.el.chips.appendChild(btn);
      this.chips[e.id] = btn;
    }
  }

  _buildProps() {
    const thumbs = this.h.thumbs || {};
    this.el.propGrid.innerHTML = '';
    this.propCards = {};
    for (const type of PROP_TYPES) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'prop-card';
      card.dataset.type = type;
      card.setAttribute('aria-label', `${PROP_META[type].label} 놓기`);
      const img = thumbs[type]
        ? `<img src="${thumbs[type]}" alt="" />`
        : `<img alt="" style="background:#eef2f7" />`;
      card.innerHTML = `${img}<span>${PROP_META[type].label}</span>`;
      card.addEventListener('click', () => this.h.onPropType(type));
      this.el.propGrid.appendChild(card);
      this.propCards[type] = card;
    }
  }

  _bind() {
    const e = this.el;
    e.start.addEventListener('click', () => this.h.onStart());
    e.infoBtn.addEventListener('click', () => this.openInfo());
    e.infoClose.addEventListener('click', () => this.closeInfo());
    e.infoOverlay.addEventListener('click', (ev) => {
      if (ev.target === e.infoOverlay) this.closeInfo();
    });
    e.propsBtn.addEventListener('click', () => this.toggleTray());
    e.trayClose.addEventListener('click', () => this.closeTray());
    e.shotBtn.addEventListener('click', () => this.h.onCapture());
    e.deleteBtn.addEventListener('click', () => this.h.onDelete());
    e.doneBtn.addEventListener('click', () => this.h.onDone());
    e.placingDone.addEventListener('click', () => this.h.onDone());
    e.resetBtn.addEventListener('click', () => this._resetClick());
    e.colorInput.addEventListener('input', (ev) => this.h.onColor(ev.target.value));
    e.colorReset.addEventListener('click', () => this.h.onColorReset());

    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        if (this.infoOpen) this.closeInfo();
        else if (this.trayOpen) this.closeTray();
        else this.h.onDone();
      }
      const idx = Number(ev.key);
      if (idx >= 1 && idx <= 7 && !ev.metaKey && !ev.ctrlKey) {
        const target = EMOTIONS[idx - 1];
        if (target) this.h.onEmotion(target.id);
      }
    });
  }

  /* ---- 상태 표시 ---- */
  showGame(emotion) {
    this.el.title.classList.add('gone');
    this.el.hud.classList.add('on');
    this.el.hud.setAttribute('aria-hidden', 'false');
    this.showHint(7000);
    this.updateEmotion(emotion);
  }

  updateEmotion(emotion) {
    for (const id of Object.keys(this.chips)) {
      this.chips[id].classList.toggle('active', id === emotion.id);
    }
    this.el.emotionLabel.textContent = `${emotion.ko} · ${emotion.character}`;
    this.el.colorInput.value = toHex6(emotion.displayColor || emotion.color);
    this.el.colorEmotionName.textContent = `${emotion.ko} · ${emotion.character}`;
    document.documentElement.style.setProperty('--accent', emotion.displayColor || emotion.color);
  }

  setSelected(item) {
    this.selected = item;
    if (!item) {
      this.el.selectionBar.classList.remove('on');
      return;
    }
    this.el.selectionName.textContent = `${PROP_META[item.type].label} · 끌어서 옮기기`;
    this.el.selectionBar.classList.add('on');
  }

  setPlacing(type) {
    if (!type) {
      this.el.placingBar.classList.remove('on');
      for (const id of Object.keys(this.propCards)) this.propCards[id].classList.remove('active');
      return;
    }
    this.el.placingName.textContent = `${PROP_META[type].label} 놓는 중 · 섬을 터치`;
    this.el.placingBar.classList.add('on');
    for (const id of Object.keys(this.propCards)) {
      this.propCards[id].classList.toggle('active', id === type);
    }
  }

  toast(message, ms = 2000) {
    const t = this.el.toast;
    t.textContent = message;
    t.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('on'), ms);
  }

  showHint(ms = 6000) {
    const h = this.el.hint;
    h.classList.add('on');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => h.classList.remove('on'), ms);
  }

  hideHint() {
    this.el.hint.classList.remove('on');
  }

  /* ---- 시트 ---- */
  toggleTray() {
    this.trayOpen ? this.closeTray() : this.openTray();
  }

  openTray() {
    this.trayOpen = true;
    this.h.onTrayOpen?.();
    this.el.tray.classList.add('on');
    this.el.tray.setAttribute('aria-hidden', 'false');
    this.el.propsBtn.classList.add('open');
    this.hideHint();
  }

  closeTray() {
    this.trayOpen = false;
    this.el.tray.classList.remove('on');
    this.el.tray.setAttribute('aria-hidden', 'true');
    this.el.propsBtn.classList.remove('open');
  }

  openInfo() {
    this.infoOpen = true;
    this.el.infoOverlay.classList.add('on');
    this.el.infoOverlay.setAttribute('aria-hidden', 'false');
  }

  closeInfo() {
    this.infoOpen = false;
    this.el.infoOverlay.classList.remove('on');
    this.el.infoOverlay.setAttribute('aria-hidden', 'true');
  }

  _resetClick() {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.el.resetBtn.textContent = '한 번 더 누르면 지워져요';
      this.el.resetBtn.style.color = '#c05a4e';
      clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => this._disarmReset(), 3200);
      return;
    }
    this._disarmReset();
    this.h.onReset();
  }

  _disarmReset() {
    this.resetArmed = false;
    this.el.resetBtn.textContent = '전체 초기화';
    this.el.resetBtn.style.color = '';
  }
}

function toHex6(c) {
  if (!c) return '#F7C948';
  return c.startsWith('#') && c.length === 7 ? c : '#F7C948';
}
