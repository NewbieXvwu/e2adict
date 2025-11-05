// src/modules/api.js

function getOptimalCacheSize() {
  if (typeof navigator !== 'undefined') {
    const memoryGB = Number.isFinite(navigator.deviceMemory) ? navigator.deviceMemory : null;
    if (memoryGB) {
      if (memoryGB >= 8) return 500;
      if (memoryGB >= 4) return 300;
    }

    const cores = Number.isFinite(navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : null;
    if (cores) {
      if (cores >= 12) return 450;
      if (cores >= 8) return 350;
      if (cores >= 4) return 250;
    }
  }
  return 200;
}

const CACHE_MAX_SIZE = getOptimalCacheSize();

function createAbortController() {
  if (typeof AbortController === 'function') {
    return new AbortController();
  }
  return null;
}

class LRUCache {
  constructor(maxSize = CACHE_MAX_SIZE) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }
}

const cache = new LRUCache();
let currentController;

function getDictionaryUrl(word) {
  const safeWord = encodeURIComponent(word.trim().toLowerCase());
  const cloudflareHostnames = ['e2adict.pages.dev'];
  
  const hostname = typeof window !== 'undefined' && window.location ? window.location.hostname : '';
  if (cloudflareHostnames.includes(hostname)) {
    return `/api/dict/${safeWord}`;
  } else {
    return `https://objectstorageapi.eu-central-1.clawcloudrun.com/puhyby1u-e2cdict/${safeWord}.json`;
  }
}

async function fetchPhonetics(word, signal) {
  try {
    const fetchOptions = signal ? { signal } : {};
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, fetchOptions);
    if (!res.ok) return null;
    const data = await res.json();
    const phonetic = data[0]?.phonetics?.find(p => p.text && p.audio);
    return phonetic ? { text: phonetic.text, audio: phonetic.audio } : null;
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn(`Could not fetch phonetics for "${word}":`, err.message);
    }
    return null;
  }
}

export async function prefetch(word) {
  const w = word.trim().toLowerCase();
  if (!w || cache.has(w)) return;
  try {
    const url = getDictionaryUrl(w);
    const fetchOptions = {};
    if (typeof Request !== 'undefined' && Request.prototype && 'priority' in Request.prototype) {
      fetchOptions.priority = 'low';
    }
    const res = await fetch(url, fetchOptions);
    if (!res.ok) return;
    const data = await res.json();
    cache.set(w, data);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn(`Prefetch failed for "${w}":`, err.message);
    }
  }
}

export async function fetchEntryData(word) {
  const w = word.trim().toLowerCase();
  if (!w) throw new Error("Empty word");

  if (currentController && typeof currentController.abort === 'function') {
    currentController.abort();
  }
  currentController = createAbortController();
  const signal = currentController ? currentController.signal : null;

  if (cache.has(w)) {
    const definition = cache.get(w);
    const phoneticsPromise = fetchPhonetics(w, signal);
    return { definition, phoneticsPromise };
  }

  const definitionUrl = getDictionaryUrl(w);
  const fetchOptions = signal ? { signal } : {};
  const definitionPromise = fetch(definitionUrl, fetchOptions).then(res => {
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  });

  const phoneticsPromise = fetchPhonetics(w, signal);

  try {
    const definition = await definitionPromise;
    cache.set(w, definition);
    return { definition, phoneticsPromise };
  } catch (err) {
    currentController = null;
    throw err;
  }
}
