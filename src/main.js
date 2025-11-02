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

const debouncedPrefetch = debounce(prefetch, 150);

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
    if (err.message.includes('Failed to fetch')) {
      message = '网络请求失败。请检查您的网络连接。';
    } else if (err.message.includes('404')) {
      message = '抱歉，此单词尚未收录。';
    } else if (err.message.match(/5\d{2}/)) {
      message = '服务器出现临时问题，请稍后再试。';
    }
    entryView.innerHTML = `<p class="error-feedback-box">${message}</p>`;
    setStatus(message, 'error');
  }
}

function setupEventListeners() {
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const wordToSearch = suggestionController.getActiveWord() || searchInput.value;
    if (suggestionController.getActiveWord()) {
      searchInput.value = suggestionController.getActiveWord();
    }
    if (wordToSearch) performSearch(wordToSearch);
  });

  searchButton.addEventListener("mousedown", createRipple);

  const handleInput = (e) => {
    const value = e.target.value.trim();
    suggestionController.update(value);
    if (suggestionEngine.isWord(value)) {
      debouncedPrefetch(value);
    }
  };

  searchInput.addEventListener('input', (e) => {
    if (e.isComposing) return;
    handleInput(e);
  });

  searchInput.addEventListener('compositionend', handleInput);

  searchInput.addEventListener('focus', () => {
    if (searchInput.value) {
      suggestionController.update(searchInput.value);
    }
  });

  searchInput.addEventListener('keydown', (e) => {
    suggestionController.handleKeyDown(e);
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const activeWord = suggestionController.getActiveWord();
      if (activeWord) debouncedPrefetch(activeWord);
    }
  });
  
  suggestionList.addEventListener('mouseover', (e) => suggestionController.handleMouseOver(e));
  
  suggestionList.addEventListener('click', (e) => {
    const item = e.target.closest('li');
    if (item?.dataset.word) {
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

// --- Initialization ---
(async () => {
  setStatus('正在初始化词典...', 'info');
  setupEventListeners();
  shortcuts.init(searchInput);
  searchInput.setAttribute('aria-expanded', 'false');

  try {
    await suggestionEngine.init();
    setStatus('');
  } catch (error) {
    setStatus('建议功能加载失败，可离线使用其余功能。', 'error');
  }

  // Prefetch other modules
  const prefetchFormMappings = () => {
    import('./modules/form-mappings.js').catch(err => console.error(err));
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(prefetchFormMappings);
  } else {
    setTimeout(prefetchFormMappings, 1000);
  }
})();