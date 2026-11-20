const KEY = 'clumi.my-weather-island.v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      version: 1,
      emotion: typeof data.emotion === 'string' ? data.emotion : 'joy',
      props: Array.isArray(data.props) ? data.props.filter((p) => p && p.type) : [],
      colors: data.colors && typeof data.colors === 'object' ? data.colors : {},
      seen: !!data.seen,
    };
  } catch {
    return null;
  }
}

let saveTimer = 0;
let pending = null;

export function saveState(state, immediate = false) {
  pending = state;
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(pending));
      saveTimer = 0;
    } catch {
      /* 저장 공간이 없을 때는 조용히 넘어감 */
    }
  };
  if (immediate) {
    clearTimeout(saveTimer);
    saveTimer = 0;
    write();
    return;
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(write, 220);
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

export { KEY as STORAGE_KEY };
