import './style.css';
import { 
  searchForm, searchInput, searchButton, suggestionList, searchComponentWrapper,
  entryView, setStatus, renderEntry, updatePhonetics, createRipple
} from './modules/ui.js';
import { fetchEntryData } from './modules/api.js';
import { handleAudioPlay } from './modules/audio.js';
import * as suggestionEngine from './modules/suggestionEngine.js';
import * as suggestionController from './modules/suggestionController.js';
import * as shortcuts from './modules/shortcuts.js';

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

  searchInput.addEventListener('input', () => suggestionController.update(searchInput.value));
  searchInput.addEventListener('focus', () => {
    if (searchInput.value) {
      suggestionController.update(searchInput.value);
    }
  });
  searchInput.addEventListener('keydown', (e) => suggestionController.handleKeyDown(e));
  
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
  shortcuts.init(searchInput); // <-- 初始化全局快捷键
  await suggestionEngine.init();
})();
