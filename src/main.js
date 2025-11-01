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
    await renderEntry(definition); // 确保 await renderEntry
    setStatus('');
    const phonetics = await phoneticsPromise;
    if (phonetics) updatePhonetics(phonetics);
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('Search failed:', err);
    entryView.innerHTML = '<p class="error-feedback-box">抱歉，此单词尚未收录。</p>';
    setStatus('抱歉，此单词尚未收录。', 'error');
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

  searchInput.addEventListener('input', () => {
    const value = searchInput.value.trim();
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
  
  // 初始化核心功能（Trie树）
  await suggestionEngine.init();

  // 在浏览器空闲时预加载词形映射模块
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
