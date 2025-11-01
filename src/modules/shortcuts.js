// src/modules/shortcuts.js

/**
 * 初始化全局键盘快捷键。
 * @param {HTMLInputElement} searchInputEl - 对搜索输入框的引用。
 */
export function init(searchInputEl) {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K 聚焦搜索框
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInputEl.focus();
      searchInputEl.select();
    }
  });
}
