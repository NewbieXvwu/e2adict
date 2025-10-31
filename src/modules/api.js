const cache = new Map();
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
    const res = await fetch(url, { priority: 'low', signal: new AbortController().signal });
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
    // 即使有缓存，也异步获取音标
    const phoneticsPromise = fetchPhonetics(w, signal);
    return { definition, phoneticsPromise };
  }

  const definitionUrl = getDictionaryUrl(w);
  const definitionPromise = fetch(definitionUrl, { signal }).then(res => {
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  });

  const phoneticsPromise = fetchPhonetics(w, signal);

  const definition = await definitionPromise;
  cache.set(w, definition);

  return { definition, phoneticsPromise };
}