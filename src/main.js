// src/main.js

import './style.css';
import { 
  searchForm, searchInput, searchButton, suggestionList, searchComponentWrapper,
  entryView, setStatus, renderEntry, updatePhonetics, createRipple
} from './modules/ui.js';
import { fetchEntryData, prefetch } from './modules/api.js';
import { handleAudioPlay } from './modules/audio.js';
import * as suggestionEngine from './modules/suggestionEngine.js';
import * as suggestionController from './modules/suggestionController.js';
import * as shortcuts from './modules/shortcuts.js';
import { debounce } from './modules/utils.js';

// --- 预加载逻辑 ---
const debouncedPrefetch = debounce(prefetch, 150);

// --- 主要查询逻辑 ---
async function performSearch(word) {
  const w = word.trim();
  if (!w) return;
  
  suggestionController.hide();
  setStatus('正在查询…', 'info');
  entryView.innerHTML = '';
  
  try {
    const { definition, phoneticsPromise } = await fetchEntryData(w);
    renderEntry(definition);
    setStatus('');
    const phonetics = await phoneticsPromise;
    if (phonetics) updatePhonetics(phonetics);
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('Search failed:', err);

    let message = '抱歉，此单词尚未收录。';
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      message = '网络请求失败。请检查您的网络连接或稍后再试。';
    } else if (err.message.includes('status: 404')) {
      message = '抱歉，此单词尚未收录。';
    } else if (err.message.match(/status: 5\d{2}/)) {
      message = '服务器出现临时问题，请稍后再试。';
    }
    
    entryView.innerHTML = `<p class="error-feedback-box">${message}</p>`;
    setStatus(message, 'error');
  }
}

// --- 事件监听与委托 ---
function setupEventListeners() {
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const activeWord = suggestionController.getActiveWord();
    const wordToSearch = activeWord || searchInput.value;

    if (activeWord) {
      searchInput.value = activeWord;
    }
    
    if (wordToSearch) {
      performSearch(wordToSearch);
    }
  });

  searchButton.addEventListener("mousedown", createRipple);

  searchInput.addEventListener('input', (e) => {
    if (e.isComposing) return;
    const value = searchInput.value.trim();
    suggestionController.update(value);

    if (suggestionEngine.isWord(value)) {
      debouncedPrefetch(value);
    }
  });

  searchInput.addEventListener('compositionend', (e) => {
    const value = e.target.value.trim();
    suggestionController.update(value);
    if (suggestionEngine.isWord(value)) {
      debouncedPrefetch(value);
    }
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value) {
      suggestionController.update(searchInput.value);
    }
  });

  searchInput.addEventListener('keydown', (e) => {
    suggestionController.handleKeyDown(e);
    
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const activeWord = suggestionController.getActiveWord();
      if (activeWord) {
        debouncedPrefetch(activeWord);
      }
    }
  });
  
  suggestionList.addEventListener('mouseover', (e) => suggestionController.handleMouseOver(e));
  
  suggestionList.addEventListener('click', (e) => {
    const item = e.target.closest('li');
    if (item && item.dataset.word) {
      searchInput.value = item.dataset.word;
      performSearch(item.dataset.word);
    }
  });

  document.addEventListener('click', (e) => {
    if (!searchComponentWrapper.contains(e.target)) {
      suggestionController.hide();
    }
  });

  entryView.addEventListener('click', (e) => {
    const audioButton = e.target.closest('[data-action="play-audio"]');
    if (audioButton) handleAudioPlay(audioButton);
  });
}

// --- 初始化 ---
(async () => {
  setStatus('');
  setupEventListeners();
  shortcuts.init(searchInput);
  
  searchInput.setAttribute('aria-expanded', 'false');

  try {
    await suggestionEngine.init();
  } catch (error) {
    setStatus('建议功能加载失败，可离线使用其余功能。', 'error');
  }

  const prefetchFormMappings = () => {
    import('./modules/form-mappings.js')
      .then(() => console.log('Form mappings module prefetched.'))
      .catch(err => console.error('Failed to prefetch form mappings:', err));
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(prefetchFormMappings);
  } else {
    setTimeout(prefetchFormMappings, 1000);
  }
})();
