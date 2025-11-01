// src/modules/ui.js

/* ---------- DOM 元素 ---------- */
export const statusMsg    = document.getElementById('statusMessage');
export const entryView    = document.getElementById('entryView');
export const entryTmpl    = document.getElementById('entryTemplate');
export const searchForm = document.getElementById('searchForm');
export const searchInput = document.getElementById('searchInput');
export const searchButton = document.getElementById('searchButton');
export const suggestionList = document.getElementById('suggestion-list');
export const searchComponentWrapper = document.getElementById('search-component-wrapper');

// 用于缓存按需加载的词形映射模块
let formMappingsModule = null;

/* ---------- UI 常量 ---------- */
export const SPEAKER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M560-131v-82q90-26 145-100t55-168q0-94-55-168T560-749v-82q124 28 202 125.5T840-481q0 127-78 224.5T560-131ZM120-360v-240h160l200-200v640L280-360H120Zm440 40v-322q47 22 73.5 66t26.5 96q0 51-26.5 94.5T560-320ZM400-606l-86 86H200v80h114l86 86v-252ZM300-480Z"/></svg>`;
export const NETWORKING_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient x1="8.042%" y1="0%" x2="65.682%" y2="23.865%" id="a"><stop stop-color="currentColor" stop-opacity="0" offset="0%"/><stop stop-color="currentColor" stop-opacity=".631" offset="63.146%"/><stop stop-color="currentColor" offset="100%"/></linearGradient></defs><g fill="none" fill-rule="evenodd"><g transform="translate(1 1)"><path d="M36 18c0-9.94-8.06-18-18-18" id="Oval-2" stroke="url(#a)" stroke-width="2"><animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="0.9s" repeatCount="indefinite" /></path><circle fill="currentColor" cx="36" cy="18" r="1"><animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="0.9s" repeatCount="indefinite" /></circle></g></g></svg>`;
export const PLAYING_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 105 105" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><circle cx="12.5" cy="12.5" r="12.5"><animate attributeName="fill-opacity" begin="0s" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="12.5" cy="52.5" r="12.5" fill-opacity=".5"><animate attributeName="fill-opacity" begin="100ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="52.5" cy="12.5" r="12.5"><animate attributeName="fill-opacity" begin="300ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="52.5" cy="52.5" r="12.5"><animate attributeName="fill-opacity" begin="600ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="92.5" cy="12.5" r="12.5"><animate attributeName="fill-opacity" begin="800ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="92.5" cy="52.5" r="12.5"><animate attributeName="fill-opacity" begin="400ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="12.5" cy="92.5" r="12.5"><animate attributeName="fill-opacity" begin="700ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="52.5" cy="92.5" r="12.5"><animate attributeName="fill-opacity" begin="500ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle><circle cx="92.5" cy="92.5" r="12.5"><animate attributeName="fill-opacity" begin="200ms" dur="1s" values="1;.2;1" calcMode="linear" repeatCount="indefinite" /></circle></svg>`;

/* ---------- 工具函数 ---------- */
const escapeHtml = (v) => {
  if (typeof v !== 'string') return '';
  return v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
};

/**
 * 在按钮上创建 MD3 风格的涟漪效果。
 * @param {MouseEvent} event - mousedown 事件对象。
 */
export function createRipple(event) {
  const button = event.currentTarget;
  const circle = document.createElement("span");
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;
  circle.style.width = circle.style.height = `${diameter}px`;
  const rect = button.getBoundingClientRect();
  circle.style.left = `${event.clientX - rect.left - radius}px`;
  circle.style.top = `${event.clientY - rect.top - radius}px`;
  circle.classList.add("ripple");
  const existingRipple = button.querySelector(".ripple");
  if (existingRipple) existingRipple.remove();
  button.appendChild(circle);
  circle.addEventListener('animationend', () => circle.remove());
}

/* ---------- UI 更新函数 ---------- */
export function setStatus(msg = '', tone = 'muted') {
  statusMsg.textContent = msg;
  statusMsg.className   = 'mt-4 text-sm ' + (tone === 'error' ? 'text-error' : tone === 'info' ? 'text-on-surface' : 'text-on-surface-variant');
}

export function updatePhonetics(phonetics) {
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

/**
 * 按需加载并缓存词形映射模块。
 * @returns {Promise<{formKeyAliases: object, formTranslations: object}>}
 */
async function getFormMappings() {
  if (formMappingsModule) {
    return formMappingsModule;
  }
  const mappings = await import('./form-mappings.js');
  formMappingsModule = mappings;
  return mappings;
}

export async function renderEntry(entry) {
  const { formKeyAliases, formTranslations } = await getFormMappings();

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
  let formsRendered = false;

  if (entry.forms && typeof entry.forms === 'object') {
    Object.entries(entry.forms).forEach(([originalKey, value]) => {
      const standardKey = formKeyAliases[originalKey] || originalKey;
      const translation = formTranslations[standardKey];
      
      if (translation) {
        formsRendered = true;
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between gap-3 rounded-lg bg-surface-container-highest px-3 py-1.5';
        const escapedTranslation = escapeHtml(translation);
        const escapedValue = escapeHtml(String(value));
        div.innerHTML = `<span class="text-sm tracking-wide text-on-surface-variant">${escapedTranslation}</span><span class="text-sm text-on-surface">${escapedValue}</span>`;
        formsBox.appendChild(div);
      }
    });
  }

  if (!formsRendered) {
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
