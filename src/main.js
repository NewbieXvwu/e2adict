import './style.css';
import { searchInput, statusMsg, entryView, searchForm, setStatus, renderEntry, updatePhonetics } from './modules/ui.js';
import { fetchEntryData, prefetch } from './modules/api.js';
import { handleAudioPlay } from './modules/audio.js';

const debounce = (fn, d = 300) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), d); };
};

/* ---------- 主要查询逻辑 ---------- */
async function performSearch(word) {
  const w = word.trim();
  if (!w) return;

  setStatus('正在查询…', 'info');
  entryView.innerHTML = ''; // 清空旧内容

  try {
    const { definition, phoneticsPromise } = await fetchEntryData(w);
    
    // 立即渲染主要内容
    renderEntry(definition);
    setStatus('');
    
    // 异步更新音标
    const phonetics = await phoneticsPromise;
    if (phonetics) {
      updatePhonetics(phonetics);
    }
  } catch (err) {
    if (err.name === 'AbortError') return; // 用户中止，静默处理
    console.error('Search failed:', err);
    entryView.innerHTML = '<p class="error-feedback-box">抱歉，此单词尚未收录。</p>';
    setStatus('抱歉，此单词尚未收录。', 'error');
  }
}

/* ---------- 事件监听 ---------- */
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  performSearch(searchInput.value);
});

entryView.addEventListener('click', (e) => {
  const audioButton = e.target.closest('[data-action="play-audio"]');
  if (audioButton) {
    handleAudioPlay(audioButton);
  }
});

const debouncedPrefetch = debounce(() => prefetch(searchInput.value), 300);
searchInput.addEventListener('input', debouncedPrefetch);

/* ---------- 键盘快捷键 ---------- */
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + K 聚焦搜索框
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
  
  // ESC 在搜索框中时清空并失焦
  if (e.key === 'Escape' && document.activeElement === searchInput) {
    searchInput.value = '';
    searchInput.blur();
  }
});

/* ---------- 初始化 ---------- */
setStatus('');