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
      const res = await fetch(`/dictionary/${encodeURIComponent(w)}.json`, { priority: 'low', signal: new AbortController().signal });
      if (!res.ok) return;
      const data = await res.json();
      cache.set(w, data);
    } catch {}
  }

  /* ---------- 主要查询 ---------- */
  async function loadEntry(word) {
    const w = word.trim().toLowerCase();
    if (!w) return;
  
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
  
    setStatus('正在查询…', 'info');
  
    if (cache.has(w)) {
      renderEntry(cache.get(w));
      setStatus('');
      return;
    }
  
    try {
      // 关键改动：请求新的 Worker API
      const res = await fetch(`/api/dict/${encodeURIComponent(w)}`, {
        signal: ctrl.signal,
      });
  
      if (!res.ok) {
          // 如果 API 返回 404 或其他错误，直接抛出
          throw new Error(`HTTP error! status: ${res.status}`);
      }
  
      const data = await res.json();
      cache.set(w, data);
      renderEntry(data);
      setStatus('');
  
    } catch (err) {
      if (err.name === 'AbortError') return; // 用户快速删除→取消，不提示
      entryView.innerHTML = '<p class="error-feedback-box">抱歉，此单词尚未收录。</p>';
      setStatus('抱歉，此单词尚未收录。', 'error');
    }
  }

  /* ---------- 渲染词条 ---------- */
  function renderEntry(entry) {
    const frag = entryTmpl.content.cloneNode(true);

    frag.querySelector('[data-field="word"]').textContent            = entry.word ?? '—';
    frag.querySelector('[data-field="pronunciation"]').textContent  = entry.pronunciation ?? '—';
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

  /* ---------- 事件 ---------- */
  searchForm.addEventListener('submit', e => {
    e.preventDefault();
    loadEntry(searchInput.value);
  });

  /* ---------- 预加载（未加 ≥2 限制，保留你的原版逻辑） ---------- */
  const debouncedPrefetch = debounce(() => prefetch(searchInput.value), 300);
  searchInput.addEventListener('input', debouncedPrefetch);

  /* ---------- 初始化 ---------- */
  setStatus('');
})();
