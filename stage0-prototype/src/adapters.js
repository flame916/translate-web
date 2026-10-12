import { DictionaryLibrary } from './dictionary-library.js';
import { desktopBridge } from './desktop-bridge.js';

export const desktopAdapter = desktopBridge;

export const dictionaryRepository = new DictionaryLibrary();
dictionaryRepository.loadIndex = () => dictionaryRepository.load();

export const termRepository = {
  list() {
    let pinned = [];
    try {
      const saved = JSON.parse(localStorage.getItem("lexicon:pinned") || "[]");
      if (Array.isArray(saved)) pinned = saved.filter(id => dictionaryRepository.allEntries().some(t => t.id === id));
    } catch { /* Corrupt or unavailable storage starts with an empty list. */ }
    return { terms: dictionaryRepository.list(), pinned };
  },
  togglePinned(id) {
    const { pinned } = this.list();
    const next = pinned.includes(id) ? pinned.filter((item) => item !== id) : [...pinned, id];
    localStorage.setItem("lexicon:pinned", JSON.stringify(next));
    return next;
  }
};

export const historyRepository = {
  list() {
    try {
      const saved = JSON.parse(localStorage.getItem("lexicon:history") || "[]");
      return Array.isArray(saved) ? saved.filter(e => e && typeof e.sourceText === "string" && typeof e.provider === "string" && typeof e.domain === "string" && !Number.isNaN(Date.parse(e.createdAt))).slice(0,20) : [];
    } catch {
      return [];
    }
  },
  add(entry) {
    const next = [entry, ...this.list()].slice(0, 20);
    localStorage.setItem("lexicon:history", JSON.stringify(next));
    return next;
  },
  clear() {
    localStorage.removeItem("lexicon:history");
    return [];
  }
};
