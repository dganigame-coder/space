// Persistent key/value store with a safe in-memory fallback
// (private mode, sandboxed iframes and file:// origins can throw on access).
const memory = new Map();

function resolveBackend() {
  try {
    const s = window.localStorage;
    const probe = '__aiwe_probe__';
    s.setItem(probe, probe);
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

const backend = resolveBackend();

export const storage = {
  get(key, fallback = '') {
    try {
      const v = backend ? backend.getItem(key) : memory.get(key);
      return v ?? fallback;
    } catch {
      return memory.get(key) ?? fallback;
    }
  },
  set(key, value) {
    memory.set(key, value);
    try { backend?.setItem(key, value); } catch { /* ignore */ }
  },
  remove(key) {
    memory.delete(key);
    try { backend?.removeItem(key); } catch { /* ignore */ }
  },
  persistent: !!backend,
};
