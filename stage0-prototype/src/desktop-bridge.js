/*
 * Native boundary for the future Tauri shell.
 * The browser fallback is intentionally kept here so the reading desk stays
 * runnable while Rust/Tauri is not installed on the development machine.
 */
function tauriInvoke() {
  const tauri = globalThis.__TAURI__;
  if (typeof tauri?.core?.invoke === 'function') return tauri.core.invoke.bind(tauri.core);
  if (typeof tauri?.invoke === 'function') return tauri.invoke.bind(tauri);
  return null;
}

export const desktopBridge = {
  get isNative() {
    return Boolean(tauriInvoke());
  },

  async readClipboard() {
    const invoke = tauriInvoke();
    if (invoke) {
      try {
        const result = await invoke('read_clipboard');
        return typeof result === 'string' ? result : result?.text || '';
      } catch {
        // Fall through to the browser API if the native command is unavailable.
      }
    }
    if (globalThis.navigator?.clipboard?.readText) {
      try { return await globalThis.navigator.clipboard.readText(); } catch { return ''; }
    }
    return '';
  },

  async writeClipboard(text) {
    const invoke = tauriInvoke();
    if (invoke) {
      try { await invoke('write_clipboard', { text }); return true; } catch { /* browser fallback */ }
    }
    if (globalThis.navigator?.clipboard?.writeText) {
      try { await globalThis.navigator.clipboard.writeText(text); return true; } catch { return false; }
    }
    return false;
  },

  async showQuickTranslate() {
    const invoke = tauriInvoke();
    if (!invoke) return false;
    try { await invoke('show_quick_translate'); return true; } catch { return false; }
  }
};
