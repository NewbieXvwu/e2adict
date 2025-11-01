import './style.css';
import { 
  searchForm, searchInput, searchButton, suggestionList, searchComponentWrapper,
  entryView, setStatus, renderEntry, updatePhonetics 
} from './modules/ui.js';
import { fetchEntryData } from './modules/api.js';
import { handleAudioPlay } from './modules/audio.js';
import * as suggestionEngine from './modules/suggestionEngine.js';
import * as suggestionController from './modules/suggestionController.js';

// --- 涟漪效果 ---
function createRipple(event) {
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
    performSearch(activeWord || searchInput.value);
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

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
}

// --- 初始化 ---
(async () => {
  setStatus('');
  setupEventListeners();
  await suggestionEngine.init();
})();
