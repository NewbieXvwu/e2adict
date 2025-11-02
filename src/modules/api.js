// src/modules/api.js

class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    const value = this.cache.get(key);
    // 移动到最近使用的位置
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最久未使用的项
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }
}

const cache = new LRUCache(200);
let currentController;

function getDictionaryUrl(word) {
  const safeWord = encodeURIComponent(word.trim().toLowerCase());
  const cloudflareHostnames = ['e2adict.pages.dev'];
  
  if (cloudflareHostnames.includes(window.location.hostname)) {
    return `/api/dict/${safeWord}`;
  } else {
    return `https://objectstorageapi.eu-central-1.clawcloudrun.com/puhyby1u-e2cdict/${safeWord}.json`;
  }
}

async function fetchPhonetics(word, signal) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal });
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
    const res = await fetch(url, { priority: 'low' });
    if (!res.ok) return;
    const data = await res.json();
    cache.set(w, data);
  } catch {}
}

export async function fetchEntryData(word) {
  const w = word.trim().toLowerCase();
  if (!w) throw new Error("Empty word");

  if (currentController) currentController.abort();
  currentController = new AbortController();
  const signal = currentController.signal;

  if (cache.has(w)) {
    const definition = cache.get(w);
    const phoneticsPromise = fetchPhonetics(w, signal);
    return { definition, phoneticsPromise };
  }

  const definitionUrl = getDictionaryUrl(w);
  const definitionPromise = fetch(definitionUrl, { signal }).then(res => {
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  });

  const phoneticsPromise = fetchPhonetics(w, signal);

  try {
    const definition = await definitionPromise;
    cache.set(w, definition);
    return { definition, phoneticsPromise };
  } catch (err) {
    // 确保在请求失败后，下一次请求可以正常进行
    currentController = null;
    throw err;
  }
}