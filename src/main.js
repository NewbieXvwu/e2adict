// 引入全局样式
import './style.css';

(() => {
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

  // SVG 图标常量。移除了 fill 属性，让 CSS 来控制颜色。
  const SPEAKER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M560-131v-82q90-26 145-100t55-168q0-94-55-168T560-749v-82q124 28 202 125.5T840-481q0 127-78 224.5T560-131ZM120-360v-240h160l200-200v640L280-360H120Zm440 40v-322q47 22 73.5 66t26.5 96q0 51-26.5 94.5T560-320ZM400-606l-86 86H200v80h114l86 86v-252ZM300-480Z"/></svg>`;

  // 浅色和深色模式使用同一个加载SVG结构，颜色由CSS控制
  const LOADING_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 105 105" xmlns="http://www.w3.org/2000/svg"><circle cx="12.5" cy="12.5" r="12.5"><animate attributeName="fill-opacity" begin="0s" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="12.5" cy="52.5" r="12.5" fill-opacity=".5"><animate attributeName="fill-opacity" begin="100ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="52.5" cy="12.5" r="12.5"><animate attributeName="fill-opacity" begin="300ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="52.5" cy="52.5" r="12.5"><animate attributeName="fill-opacity" begin="600ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="92.5" cy="12.5" r="12.5"><animate attributeName="fill-opacity" begin="800ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="92.5" cy="52.5" r="12.5"><animate attributeName="fill-opacity" begin="400ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="12.5" cy="92.5" r="12.5"><animate attributeName="fill-opacity" begin="700ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="52.5" cy="92.5" r="12.5"><animate attributeName="fill-opacity" begin="500ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="92.5" cy="92.5" r="12.5"><animate attributeName="fill-opacity" begin="200ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle></svg>`;

  /* ---------- 缓存 & 工具 ---------- */
  const cache = new Map();
  let   ctrl;                 // AbortController 用于取消前序请求

  const debounce = (fn, d = 300) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), d); };
  };

  const escapeHtml = (v) => {
    if (typeof v !== 'string') return '';
    return v.replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;')
            .replace(/'/g,'&#39;');
  };

  /* ---------- 状态提示 ---------- */
  function setStatus(msg = '', tone = 'muted') {
    statusMsg.textContent = msg;
    statusMsg.className   =
      'mt-4 text-sm ' +
      (tone === 'error' ? 'text-error' : tone === 'info' ? 'text-on-surface' : 'text-on-surface-variant');
  }

  /* ---------- 预加载 ---------- */
  async function prefetch(word) {
    const w = word.trim().toLowerCase();
    if (!w || cache.has(w)) return;

    try {
      // 为保持一致性，预加载也使用 /api/dict 端点
      const res = await fetch(`/api/dict/${encodeURIComponent(w)}`, { priority: 'low', signal: new AbortController().signal });
      if (!res.ok) return;
      const data = await res.json();
      cache.set(w, data);
    } catch {}
  }

  /**
   * 从 dictionaryapi.dev 获取音标和发音
   * 返回一个包含 text 和 audio 的对象
   */
  async function fetchPhonetics(word, signal) {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal });
      if (!res.ok) return null;
      
      const data = await res.json();
      // 找到第一个同时包含 text 和 audio 的音标对象
      const phonetic = data[0]?.phonetics?.find(p => p.text && p.audio);
      return phonetic ? { text: phonetic.text, audio: phonetic.audio } : null;
    } catch (err) {
      console.warn(`Could not fetch phonetics for "${word}":`, err.message);
      return null;
    }
  }

  /**
   * 异步更新音标和发音按钮
   */
  function updatePhonetics(phonetics) {
    const pronunciationEl = entryView.querySelector('[data-field="pronunciation"]');
    const audioButtonEl = entryView.querySelector('[data-action="play-audio"]');
    
    if (pronunciationEl && audioButtonEl && phonetics?.text) {
      pronunciationEl.textContent = phonetics.text;
      pronunciationEl.style.display = '';

      // 如果有音频链接，则设置并显示按钮
      if (phonetics.audio) {
        audioButtonEl.innerHTML = SPEAKER_ICON_SVG;
        audioButtonEl.dataset.src = phonetics.audio; // 将音频URL存储在data属性中
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
      // 即使缓存命中，也去获取音标
      fetchPhonetics(w, ctrl.signal).then(phonetics => {
        if (phonetics) {
          updatePhonetics(phonetics);
        }
      });
      return;
    }
  
    try {
      // 1. 并行发起两个请求
      const definitionPromise = fetch(`/api/dict/${encodeURIComponent(w)}`, {
        signal: ctrl.signal,
      });
      const phoneticsPromise = fetchPhonetics(w, ctrl.signal);

      // 2. 首先等待核心释义的返回
      const definitionRes = await definitionPromise;
  
      if (!definitionRes.ok) {
          throw new Error(`HTTP error! status: ${definitionRes.status}`);
      }
  
      const data = await definitionRes.json();
      cache.set(w, data);

      // 3. 立即渲染释义页面
      renderEntry(data);
      setStatus(''); // 清除“正在查询”状态

      // 4. 等待音标请求完成，并用结果更新页面
      const phonetics = await phoneticsPromise;
      if (phonetics) {
        updatePhonetics(phonetics);
      }
  
    } catch (err) {
      if (err.name === 'AbortError') return; // 用户快速删除→取消，不提示
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

    // 确保音频按钮在初始渲染时是隐藏的
    const audioButtonEl = frag.querySelector('[data-action="play-audio"]');
    if (audioButtonEl) {
      audioButtonEl.classList.add('hidden');
    }

    frag.querySelector('[data-field="concise_definition"]').textContent = entry.concise_definition ?? '—';

    /* ---- 词形变化 ---- */
    const formsBox = frag.querySelector('[data-field="forms"]');
    formsBox.innerHTML = '';
    if (entry.forms && typeof entry.forms === 'object' && Object.keys(entry.forms).length) {
      Object.entries(entry.forms).forEach(([k, v]) => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between gap-3 rounded-lg bg-surface-container-highest px-3 py-1.5';
        div.innerHTML = `
          <span class="text-sm tracking-wide text-on-surface-variant">${escapeHtml(formTranslations[k]||k)}</span>
          <span class="text-sm text-on-surface">${escapeHtml(String(v))}</span>`;
        formsBox.appendChild(div);
      });
    } else {
      formsBox.innerHTML = '<p class="col-span-full text-sm text-on-surface-variant">无词形变化信息。</p>';
    }

    /* ---- 详细释义 ---- */
    const defBox = frag.querySelector('[data-field="definitions"]');
    defBox.innerHTML = '';
    if (Array.isArray(entry.definitions) && entry.definitions.length) {
      entry.definitions.forEach((d, i) => {
        const block = document.createElement('div');
        block.className = 'rounded-2xl border border-outline/30 bg-surface-container-high p-4 space-y-3';
        block.innerHTML = `
          <header class="flex flex-wrap items-center gap-2">
            <span class="rounded-lg bg-primary-container px-2 py-1 text-xs font-medium uppercase tracking-wide text-on-primary-container">释义 ${i+1}</span>
            <span class="text-xs text-on-surface-variant">${escapeHtml(d.pos)}</span>
          </header>
          <p class="text-sm leading-relaxed text-on-surface">${escapeHtml(d.explanation_cn)}</p>
          <p class="text-sm leading-relaxed text-on-surface-variant">${escapeHtml(d.explanation_en)}</p>
          <div class="rounded-lg border border-outline/20 bg-surface-container p-3 text-sm">
            <p class="text-on-surface">例句（EN）：${escapeHtml(d.example_en)}</p>
            <p class="mt-1 text-on-surface-variant">例句（CN）：${escapeHtml(d.example_cn)}</p>
          </div>`;
        defBox.appendChild(block);
      });
    } else {
      defBox.innerHTML = '<p class="text-sm text-on-surface-variant">暂无详细释义。</p>';
    }

    /* ---- 近义词比较 ---- */
    const cmpBox = frag.querySelector('[data-field="comparison"]');
    cmpBox.innerHTML = '';
    if (Array.isArray(entry.comparison) && entry.comparison.length) {
      entry.comparison.forEach((c) => {
        const block = document.createElement('div');
        block.className = 'rounded-2xl border border-outline/30 bg-surface-container-high p-4';
        block.innerHTML = `
          <h5 class="text-sm font-medium text-on-surface">${escapeHtml(c.word_to_compare)}</h5>
          <p class="mt-2 text-sm leading-relaxed text-on-surface-variant">${escapeHtml(c.analysis)}</p>`;
        cmpBox.appendChild(block);
      });
    } else {
      cmpBox.innerHTML = '<p class="text-sm text-on-surface-variant">暂无近义词比较。</p>';
    }

    entryView.innerHTML = '';
    entryView.appendChild(frag);
  }

  /**
   * 处理音频播放
   */
  async function handleAudioPlay(buttonEl) {
    const audioSrc = buttonEl.dataset.src;
    if (!audioSrc || buttonEl.dataset.state === 'loading') {
      return; // 如果没有音频源或正在加载，则不执行任何操作
    }

    const audio = new Audio(audioSrc);

    try {
      // 1. 进入加载状态
      buttonEl.dataset.state = 'loading';
      buttonEl.innerHTML = LOADING_ICON_SVG;
      
      // 2. 播放音频
      await audio.play();

      // 3. 播放结束后恢复图标
      audio.addEventListener('ended', () => {
        buttonEl.innerHTML = SPEAKER_ICON_SVG;
        delete buttonEl.dataset.state;
      });

    } catch (err) {
      console.error("Audio playback failed:", err);
      // 如果播放失败，立即恢复图标
      buttonEl.innerHTML = SPEAKER_ICON_SVG;
      delete buttonEl.dataset.state;
    }
  }

  /* ---------- 事件 ---------- */
  searchForm.addEventListener('submit', e => {
    e.preventDefault();
    loadEntry(searchInput.value);
  });

  // 使用事件委托处理音频按钮点击
  entryView.addEventListener('click', (e) => {
    const audioButton = e.target.closest('[data-action="play-audio"]');
    if (audioButton) {
      handleAudioPlay(audioButton);
    }
  });

  const debouncedPrefetch = debounce(() => prefetch(searchInput.value), 300);
  searchInput.addEventListener('input', debouncedPrefetch);

  /* ---------- 初始化 ---------- */
  setStatus('');
})();