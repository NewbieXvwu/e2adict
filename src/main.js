// 引入全局样式
import './style.css';

(() => {
  const previewParams = (() => {
    // 获取当前页面 URL 的查询参数
    const params = new URLSearchParams(window.location.search);
    const token = params.get('eo_token');
    const time = params.get('eo_time');

    // 如果存在预览所需的 token 和 time 参数
    if (token && time) {
      console.log('EdgeOne preview mode detected. Patching fetch requests.');
      // 返回一个包含这些参数的查询字符串，供后续使用
      return `?eo_token=${token}&eo_time=${time}`;
    }
    return ''; // 如果不是预览环境，则返回空字符串
  })();

  if (previewParams) {
    // 替换全局的 fetch 函数
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
      let resource = input;
      // 检查请求是否是站内相对路径或同源 URL
      if (typeof resource === 'string' && (resource.startsWith('/') || resource.startsWith(window.location.origin))) {
          // 如果是，则将预览参数附加到 URL 后面
          const url = new URL(resource, window.location.origin);
          url.search += (url.search ? '&' : '') + previewParams.substring(1);
          resource = url.toString();
      }
      // 使用修改后的 URL 调用原始的 fetch 函数
      return originalFetch.call(this, resource, init);
    };
  }

  /* ---------- DOM ---------- */
  const searchInput  = document.getElementById('searchInput');
  const statusMsg    = document.getElementById('statusMessage');
  const entryView    = document.getElementById('entryView');
  const searchForm   = document.getElementById('searchForm');
  const entryTmpl    = document.getElementById('entryTemplate');

  /* ---------- 常量 ---------- */
  const formTranslations = {
    plural: '复数',
    third_person_singular: '第三人称单数',
    past_tense: '过去式',
    past_participle: '过去分词',
    present_participle: '现在分词',
  };

  // SVG 图标常量。使用 'currentColor' 让 CSS 控制颜色。
  const SPEAKER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M560-131v-82q90-26 145-100t55-168q0-94-55-168T560-749v-82q124 28 202 125.5T840-481q0 127-78 224.5T560-131ZM120-360v-240h160l200-200v640L280-360H120Zm440 40v-322q47 22 73.5 66t26.5 96q0 51-26.5 94.5T560-320ZM400-606l-86 86H200v80h114l86 86v-252ZM300-480Z"/></svg>`;

  const NETWORKING_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient x1="8.042%" y1="0%" x2="65.682%" y2="23.865%" id="a"><stop stop-color="currentColor" stop-opacity="0" offset="0%"/><stop stop-color="currentColor" stop-opacity=".631" offset="63.146%"/><stop stop-color="currentColor" offset="100%"/></linearGradient></defs><g fill="none" fill-rule="evenodd"><g transform="translate(1 1)"><path d="M36 18c0-9.94-8.06-18-18-18" id="Oval-2" stroke="url(#a)" stroke-width="2"><animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="0.9s" repeatCount="indefinite" /></path><circle fill="currentColor" cx="36" cy="18" r="1"><animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="0.9s" repeatCount="indefinite" /></circle></g></g></svg>`;
  
  const PLAYING_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 105 105" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><circle cx="12.5" cy="12.5" r="12.5"><animate attributeName="fill-opacity" begin="0s" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="12.5" cy="52.5" r="12.5" fill-opacity=".5"><animate attributeName="fill-opacity" begin="100ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="52.5" cy="12.5" r="12.5"><animate attributeName="fill-opacity" begin="300ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="52.5" cy="52.5" r="12.5"><animate attributeName="fill-opacity" begin="600ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="92.5" cy="12.5" r="12.5"><animate attributeName="fill-opacity" begin="800ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="92.5" cy="52.5" r="12.5"><animate attributeName="fill-opacity" begin="400ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="12.5" cy="92.5" r="12.5"><animate attributeName="fill-opacity" begin="700ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="52.5" cy="92.5" r="12.5"><animate attributeName="fill-opacity" begin="500ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="92.5" cy="92.5" r="12.5"><animate attributeName="fill-opacity" begin="200ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle></svg>`;

  /* ---------- 缓存 & 工具 ---------- */
  const cache = new Map();
  let   ctrl;

  const debounce = (fn, d = 300) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), d); };
  };

  const escapeHtml = (v) => {
    if (typeof v !== 'string') return '';
    return v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  };

  /* ---------- 状态提示 ---------- */
  function setStatus(msg = '', tone = 'muted') {
    statusMsg.textContent = msg;
    statusMsg.className   = 'mt-4 text-sm ' + (tone === 'error' ? 'text-error' : tone === 'info' ? 'text-on-surface' : 'text-on-surface-variant');
  }

  /* ---------- 预加载 ---------- */
  async function prefetch(word) {
    const w = word.trim().toLowerCase();
    if (!w || cache.has(w)) return;
    try {
      const res = await fetch(`/api/dict/${encodeURIComponent(w)}`, { priority: 'low', signal: new AbortController().signal });
      if (!res.ok) return;
      const data = await res.json();
      cache.set(w, data);
    } catch {}
  }

  /* ---------- 音标获取 ---------- */
  async function fetchPhonetics(word, signal) {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal });
      if (!res.ok) return null;
      const data = await res.json();
      const phonetic = data[0]?.phonetics?.find(p => p.text && p.audio);
      return phonetic ? { text: phonetic.text, audio: phonetic.audio } : null;
    } catch (err) {
      console.warn(`Could not fetch phonetics for "${word}":`, err.message);
      return null;
    }
  }

  /* ---------- 异步更新音标 ---------- */
  function updatePhonetics(phonetics) {
    const pronunciationEl = entryView.querySelector('[data-field="pronunciation"]');
    const audioButtonEl = entryView.querySelector('[data-action="play-audio"]');
    if (pronunciationEl && audioButtonEl && phonetics?.text) {
      pronunciationEl.textContent = phonetics.text;
      pronunciationEl.style.display = '';
      if (phonetics.audio) {
        audioButtonEl.innerHTML = SPEAKER_ICON_SVG;
        audioButtonEl.dataset.src = phonetics.audio;
        audioButtonEl.classList.remove('hidden');
      }
    }
  }

  /* ---------- 主要查询 ---------- */
  async function loadEntry(word) {
    const w = word.trim().toLowerCase();
    if (!w) return;
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    setStatus('正在查询…', 'info');
    if (cache.has(w)) {
      const data = cache.get(w);
      renderEntry(data);
      setStatus('');
      fetchPhonetics(w, ctrl.signal).then(phonetics => {
        if (phonetics) updatePhonetics(phonetics);
      });
      return;
    }
    try {
      const definitionPromise = fetch(`/api/dict/${encodeURIComponent(w)}`, { signal: ctrl.signal });
      const phoneticsPromise = fetchPhonetics(w, ctrl.signal);
      const definitionRes = await definitionPromise;
      if (!definitionRes.ok) throw new Error(`HTTP error! status: ${definitionRes.status}`);
      const data = await definitionRes.json();
      cache.set(w, data);
      renderEntry(data);
      setStatus('');
      const phonetics = await phoneticsPromise;
      if (phonetics) updatePhonetics(phonetics);
    } catch (err) {
      if (err.name === 'AbortError') return;
      entryView.innerHTML = '<p class="error-feedback-box">抱歉，此单词尚未收录。</p>';
      setStatus('抱歉，此单词尚未收录。', 'error');
    }
  }

  /* ---------- 渲染词条 ---------- */
  function renderEntry(entry) {
    const frag = entryTmpl.content.cloneNode(true);
    frag.querySelector('[data-field="word"]').textContent = entry.word ?? '—';
    const pronunciationEl = frag.querySelector('[data-field="pronunciation"]');
    pronunciationEl.textContent = '';
    pronunciationEl.style.display = 'none';
    const audioButtonEl = frag.querySelector('[data-action="play-audio"]');
    if (audioButtonEl) audioButtonEl.classList.add('hidden');
    frag.querySelector('[data-field="concise_definition"]').textContent = entry.concise_definition ?? '—';

    const formsBox = frag.querySelector('[data-field="forms"]');
    formsBox.innerHTML = '';
    if (entry.forms && typeof entry.forms === 'object' && Object.keys(entry.forms).length) {
      Object.entries(entry.forms).forEach(([k, v]) => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between gap-3 rounded-lg bg-surface-container-highest px-3 py-1.5';
        div.innerHTML = `<span class="text-sm tracking-wide text-on-surface-variant">${escapeHtml(formTranslations[k]||k)}</span><span class="text-sm text-on-surface">${escapeHtml(String(v))}</span>`;
        formsBox.appendChild(div);
      });
    } else {
      formsBox.innerHTML = '<p class="col-span-full text-sm text-on-surface-variant">无词形变化信息。</p>';
    }

    const defBox = frag.querySelector('[data-field="definitions"]');
    defBox.innerHTML = '';
    if (Array.isArray(entry.definitions) && entry.definitions.length) {
      entry.definitions.forEach((d, i) => {
        const block = document.createElement('div');
        block.className = 'rounded-2xl border border-outline/30 bg-surface-container-high p-4 space-y-3';
        block.innerHTML = `<header class="flex flex-wrap items-center gap-2"><span class="rounded-lg bg-primary-container px-2 py-1 text-xs font-medium uppercase tracking-wide text-on-primary-container">释义 ${i+1}</span><span class="text-xs text-on-surface-variant">${escapeHtml(d.pos)}</span></header><p class="text-sm leading-relaxed text-on-surface">${escapeHtml(d.explanation_cn)}</p><p class="text-sm leading-relaxed text-on-surface-variant">${escapeHtml(d.explanation_en)}</p><div class="rounded-lg border border-outline/20 bg-surface-container p-3 text-sm"><p class="text-on-surface">例句（EN）：${escapeHtml(d.example_en)}</p><p class="mt-1 text-on-surface-variant">例句（CN）：${escapeHtml(d.example_cn)}</p></div>`;
        defBox.appendChild(block);
      });
    } else {
      defBox.innerHTML = '<p class="text-sm text-on-surface-variant">暂无详细释义。</p>';
    }

    const cmpBox = frag.querySelector('[data-field="comparison"]');
    cmpBox.innerHTML = '';
    if (Array.isArray(entry.comparison) && entry.comparison.length) {
      entry.comparison.forEach((c) => {
        const block = document.createElement('div');
        block.className = 'rounded-2xl border border-outline/30 bg-surface-container-high p-4';
        block.innerHTML = `<h5 class="text-sm font-medium text-on-surface">${escapeHtml(c.word_to_compare)}</h5><p class="mt-2 text-sm leading-relaxed text-on-surface-variant">${escapeHtml(c.analysis)}</p>`;
        cmpBox.appendChild(block);
      });
    } else {
      cmpBox.innerHTML = '<p class="text-sm text-on-surface-variant">暂无近义词比较。</p>';
    }
    entryView.innerHTML = '';
    entryView.appendChild(frag);
  }

  /* ---------- 音频播放处理 ---------- */
  function handleAudioPlay(buttonEl) {
    const audioSrc = buttonEl.dataset.src;
    if (!audioSrc || buttonEl.dataset.state) return;

    const audio = new Audio(audioSrc);
    
    const resetState = () => {
      buttonEl.innerHTML = SPEAKER_ICON_SVG;
      delete buttonEl.dataset.state;
      audio.removeEventListener('canplaythrough', onCanPlayThrough);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
    
    const onCanPlayThrough = () => {
      buttonEl.dataset.state = 'playing';
      buttonEl.innerHTML = PLAYING_ICON_SVG;
      audio.play().catch(onError);
    };

    const onEnded = () => resetState();
    const onError = (err) => {
      console.error("Audio playback failed:", err);
      resetState();
    };

    buttonEl.dataset.state = 'networking';
    buttonEl.innerHTML = NETWORKING_ICON_SVG;
    
    audio.addEventListener('canplaythrough', onCanPlayThrough);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
  }

  /* ---------- 事件 ---------- */
  searchForm.addEventListener('submit', e => {
    e.preventDefault();
    loadEntry(searchInput.value);
  });

  entryView.addEventListener('click', (e) => {
    const audioButton = e.target.closest('[data-action="play-audio"]');
    if (audioButton) handleAudioPlay(audioButton);
  });

  const debouncedPrefetch = debounce(() => prefetch(searchInput.value), 300);
  searchInput.addEventListener('input', debouncedPrefetch);

  /* ---------- 初始化 ---------- */
  setStatus('');
})();
