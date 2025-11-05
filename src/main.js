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

const debouncedPrefetch = debounce((word) => {
  const doPrefetch = () => prefetch(word);
  
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(doPrefetch);
  } else {
    setTimeout(doPrefetch, 0);
  }
}, 250);

async function performSearch(word) {
  const w = word.trim();
  if (!w) return;
  
  suggestionController.hide();
  setStatus(''); // Clear status on new search
  entryView.innerHTML = '';
  
  try {
    const { definition, phoneticsPromise } = await fetchEntryData(w);
    renderEntry(definition);
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
    const value = e.target.value; // Don't trim here, let controller handle it
    suggestionController.update(value);
    
    // Prefetch only when it's likely a complete word
    if (suggestionEngine.isWord(value.trim())) {
      debouncedPrefetch(value.trim());
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
  setupEventListeners();
  shortcuts.init(searchInput);
  searchInput.setAttribute('aria-expanded', 'false');

  try {
    await suggestionEngine.init();
  } catch (error) {
    setStatus('搜索建议功能可能无法使用。请尝试刷新页面。', 'error');
  }

  // Prefetch other modules
  const prefetchFormMappings = () => {
    import('./modules/form-mappings.js').catch(err => console.error(err));
  };
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(prefetchFormMappings);
  } else {
    setTimeout(prefetchFormMappings, 1000);
  }
})();
