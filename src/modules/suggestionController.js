// src/modules/suggestionController.js

import { searchInput, suggestionList } from './ui.js';
import * as suggestionEngine from './suggestionEngine.js';

let activeIndex = -1;
let isVisible = false;

// --- 私有函数 ---
function _show() {
  if (isVisible || suggestionList.querySelector('li') === null) return;
  suggestionList.classList.remove('opacity-0', 'scale-95', 'invisible');
  suggestionList.classList.add('opacity-100', 'scale-100');
  isVisible = true;
}

function _updateActiveDescendant(event = null) {
  const items = suggestionList.querySelectorAll('li');
  items.forEach((item, index) => {
    if (index === activeIndex) {
      item.classList.add('bg-surface-container-highest');
      item.setAttribute('aria-selected', 'true');
      searchInput.setAttribute('aria-activedescendant', item.id);
      if (event && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else {
      item.classList.remove('bg-surface-container-highest');
      item.setAttribute('aria-selected', 'false');
    }
  });
}

// --- 公共 API ---
export function update(input) {
  const suggestions = suggestionEngine.getSuggestions(input);
  if (suggestions.length === 0) {
    suggestionList.innerHTML = '';
    hide();
    return;
  }
  suggestionList.innerHTML = `
    <ul class="max-h-[40vh] overflow-y-auto p-2">
      ${suggestions.map((word, index) => `
        <li id="suggestion-${index}" role="option" class="min-h-[48px] flex items-center px-4 py-2 text-on-surface rounded-lg cursor-pointer transition-colors duration-150" data-word="${word}">
          <strong>${word.substring(0, input.length)}</strong>${word.substring(input.length)}
        </li>
      `).join('')}
    </ul>
  `;
  _show();
  activeIndex = -1;
  _updateActiveDescendant();
}

export function hide() {
  if (!isVisible) return;
  suggestionList.classList.remove('opacity-100', 'scale-100');
  suggestionList.classList.add('opacity-0', 'scale-95');
  const onTransitionEnd = () => {
    if (!isVisible) suggestionList.classList.add('invisible');
    suggestionList.removeEventListener('transitionend', onTransitionEnd);
  };
  suggestionList.addEventListener('transitionend', onTransitionEnd);
  activeIndex = -1;
  isVisible = false;
  searchInput.removeAttribute('aria-activedescendant');
}

export function handleKeyDown(e) {
  if (!isVisible) return;
  const items = suggestionList.querySelectorAll('li');
  if (items.length === 0) return;
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      _updateActiveDescendant(e);
      break;
    case 'ArrowUp':
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      _updateActiveDescendant(e);
      break;
    case 'Escape':
      hide();
      break;
  }
}

export function handleMouseOver(e) {
  const item = e.target.closest('li');
  if (item) {
    const allItems = Array.from(suggestionList.querySelectorAll('li'));
    const newIndex = allItems.indexOf(item);
    if (newIndex !== activeIndex) {
      activeIndex = newIndex;
      _updateActiveDescendant();
    }
  }
}

export function getActiveWord() {
    if (isVisible && activeIndex > -1) {
        const items = suggestionList.querySelectorAll('li');
        return items[activeIndex]?.dataset.word || null;
    }
    return null;
}
