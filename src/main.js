// src/main.js

// 1. [新增] 引入全局样式表，这是 Vite 工作所必需的
import './style.css';

// 使用 IIFE (立即调用函数表达式) 来创建独立作用域，避免污染全局变量
(() => {
  // --- DOM 元素获取 ---
  const searchInput = document.getElementById('searchInput');
  const statusMessage = document.getElementById('statusMessage');
  const entryView = document.getElementById('entryView');
  const form = document.getElementById('searchForm');
  const entryTemplate = document.getElementById('entryTemplate');

  // --- 常量和工具函数 ---
  const formTranslations = {
      'plural': '复数',
      'third_person_singular': '第三人称单数',
      'past_tense': '过去式',
      'past_participle': '过去分词',
      'present_participle': '现在分词',
  };
  
  // [新增] 用于缓存已查询单词数据的 Map
  const cache = new Map();

  // HTML 特殊字符转义函数
  function escapeHtml(value) {
    if (typeof value !== 'string') return '';
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  // [新增] 防抖函数：在事件触发后等待一段时间再执行，避免高频操作
  const debounce = (fn, delay = 300) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  };

  // --- 核心功能函数 ---

  // 设置状态提示信息
  function setStatus(message, tone = 'muted') {
    statusMessage.textContent = message ?? '';
    statusMessage.className =
      'mt-4 text-sm ' +
      (tone === 'error'
        ? 'text-error'
        : tone === 'info'
        ? 'text-on-surface'
        : 'text-on-surface-variant');
  }

  // [新增] 预加载函数：在用户输入时提前、静默地加载数据
  async function prefetch(word) {
    const normalized = word.trim().toLowerCase();
    // 如果没有输入，或者已经缓存了，就不执行
    if (!normalized || cache.has(normalized)) {
      return;
    }

    try {
      // 使用低优先级 fetch，不阻塞其他重要请求
      const response = await fetch(`/dictionary/${encodeURIComponent(normalized)}.json`, { priority: 'low' });
      if (!response.ok) return; // 预加载失败就静默处理，不打扰用户
      
      const data = await response.json();
      cache.set(normalized, data); // 成功后存入缓存
    } catch (error) {
      // 忽略预加载过程中的任何错误
    }
  }

  // [优化] 加载词条函数：优先从缓存读取
  async function loadEntry(word) {
    const normalized = word.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    setStatus('正在查询...', 'info');

    // 1. 优先检查缓存
    if (cache.has(normalized)) {
      renderEntry(cache.get(normalized));
      setStatus('');
      return;
    }

    // 2. 缓存未命中，则发起网络请求
    try {
      const response = await fetch(
        `/dictionary/${encodeURIComponent(normalized)}.json`
      );
      if (!response.ok) {
        throw new Error('词条不存在。');
      }

      const data = await response.json();
      cache.set(normalized, data); // 请求成功后，存入缓存
      renderEntry(data);
      setStatus('');
    } catch (error) {
      console.error(error);
      // [优化] 使用我们在 CSS 中定义的 .error-feedback-box 类
      entryView.innerHTML =
        '<p class="error-feedback-box">抱歉，此单词尚未收录。</p>';
      setStatus('抱歉，此单词尚未收录。', 'error');
    }
  }
  
  // 渲染词条详情函数 (逻辑与你原始版本基本一致)
  function renderEntry(entry) {
    const fragment = entryTemplate.content.cloneNode(true);

    // ... (此处省略了长长的 renderEntry 内部实现，直接复制你原始版本即可)
    // ... 为了完整性，我还是把它全部粘贴出来 ...
    
    fragment.querySelector('[data-field="word"]').textContent = entry.word ?? '—';
    fragment.querySelector('[data-field="pronunciation"]').textContent = entry.pronunciation ?? '—';
    fragment.querySelector('[data-field="concise_definition"]').textContent = entry.concise_definition ?? '—';

    const formsContainer = fragment.querySelector('[data-field="forms"]');
    formsContainer.innerHTML = '';
    if (entry.forms && typeof entry.forms === 'object' && Object.keys(entry.forms).length > 0) {
      Object.entries(entry.forms).forEach(([key, value]) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between gap-3 rounded-lg bg-surface-container-highest px-3 py-1.5';
        const displayName = formTranslations[key] || key;
        item.innerHTML = `
          <span class="text-sm tracking-wide text-on-surface-variant">${escapeHtml(displayName)}</span>
          <span class="text-sm text-on-surface">${escapeHtml(String(value))}</span>
        `;
        formsContainer.appendChild(item);
      });
    } else {
      formsContainer.innerHTML = '<p class="col-span-full text-sm text-on-surface-variant">无词形变化信息。</p>';
    }

    const definitionsContainer = fragment.querySelector('[data-field="definitions"]');
    definitionsContainer.innerHTML = '';
    if (Array.isArray(entry.definitions) && entry.definitions.length) {
      entry.definitions.forEach((definition, index) => {
        const block = document.createElement('div');
        block.className = 'rounded-2xl border border-outline/30 bg-surface-container-high p-4 space-y-3';
        block.innerHTML = `
          <header class="flex flex-wrap items-center gap-2">
            <span class="rounded-lg bg-primary-container px-2 py-1 text-xs font-medium uppercase tracking-wide text-on-primary-container">释义 ${index + 1}</span>
            <span class="text-xs text-on-surface-variant">${escapeHtml(definition.pos)}</span>
          </header>
          <p class="text-sm leading-relaxed text-on-surface">${escapeHtml(definition.explanation_cn)}</p>
          <p class="text-sm leading-relaxed text-on-surface-variant">${escapeHtml(definition.explanation_en)}</p>
          <div class="rounded-lg border border-outline/20 bg-surface-container p-3 text-sm">
            <p class="text-on-surface">例句（EN）：${escapeHtml(definition.example_en)}</p>
            <p class="mt-1 text-on-surface-variant">例句（CN）：${escapeHtml(definition.example_cn)}</p>
          </div>
        `;
        definitionsContainer.appendChild(block);
      });
    } else {
      definitionsContainer.innerHTML = '<p class="text-sm text-on-surface-variant">暂无详细释义。</p>';
    }

    const comparisonContainer = fragment.querySelector('[data-field="comparison"]');
    comparisonContainer.innerHTML = '';
    if (Array.isArray(entry.comparison) && entry.comparison.length) {
      entry.comparison.forEach((item) => {
        const block = document.createElement('div');
        block.className = 'rounded-2xl border border-outline/30 bg-surface-container-high p-4';
        block.innerHTML = `
          <h5 class="text-sm font-medium text-on-surface">${escapeHtml(item.word_to_compare)}</h5>
          <p class="mt-2 text-sm leading-relaxed text-on-surface-variant">${escapeHtml(item.analysis)}</p>
        `;
        comparisonContainer.appendChild(block);
      });
    } else {
      comparisonContainer.innerHTML = '<p class="text-sm text-on-surface-variant">暂无近义词比较。</p>';
    }

    entryView.innerHTML = '';
    entryView.appendChild(fragment);
  }

  // --- 事件监听器 ---

  // 监听表单提交事件
  form.addEventListener('submit', (event) => {
    event.preventDefault(); // 阻止表单默认的页面刷新行为
    loadEntry(searchInput.value);
  });
  
  // [新增] 监听输入框的输入事件，用于预加载
  const debouncedPrefetch = debounce(prefetch, 300); // 创建一个防抖版的预加载函数
  searchInput.addEventListener('input', () => {
    debouncedPrefetch(searchInput.value);
  });

  // --- 初始化 ---
  setStatus(''); // 页面加载后清空状态栏

})();