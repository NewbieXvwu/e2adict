// src/modules/suggestionController.js

import { searchInput, suggestionList, MAGIC_WAND_SVG } from './ui.js';
import * as suggestionEngine from './suggestionEngine.js';

let activeIndex = -1;
let isVisible = false;
let currentPrefix = '';

// --- Private Functions ---
function _show() {
    if (isVisible || suggestionList.querySelector('li') === null) return;
    suggestionList.classList.remove('opacity-0', 'scale-95', 'invisible');
    suggestionList.classList.add('opacity-100', 'scale-100');
    searchInput.setAttribute('aria-expanded', 'true');
    isVisible = true;
}

function _updateActiveDescendant(event = null) {
    const items = suggestionList.querySelectorAll('li');
    items.forEach((item, index) => {
        if (index === activeIndex) {
            item.classList.add('bg-surface-container-highest');
            item.setAttribute('aria-selected', 'true');
            searchInput.setAttribute('aria-activedescendant', item.id);
            if (event?.key === 'ArrowUp' || event?.key === 'ArrowDown') {
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        } else {
            item.classList.remove('bg-surface-container-highest');
            item.setAttribute('aria-selected', 'false');
        }
    });
}

function _renderSuggestions({ prefixResults = [], fuzzyResults = [] }) {
    if (prefixResults.length === 0 && fuzzyResults.length === 0) {
        suggestionList.innerHTML = '';
        hide();
        return;
    }
    
    const prefixHtml = prefixResults.map((word, index) => `
        <li id="suggestion-${index}" role="option" class="flex items-center justify-between px-4 py-2 text-on-surface rounded-lg cursor-pointer transition-colors duration-150" data-word="${word}">
            <span><strong>${word.substring(0, currentPrefix.length)}</strong>${word.substring(currentPrefix.length)}</span>
        </li>
    `).join('');
    
    const fuzzyOffset = prefixResults.length;
    const fuzzyHtml = fuzzyResults.map((word, index) => {
        let highlightedWord = `<span>${word}</span>`;
        return `
            <li id="suggestion-${fuzzyOffset + index}" role="option" class="flex items-center justify-between px-4 py-2 text-on-surface rounded-lg cursor-pointer transition-colors duration-150" data-word="${word}">
                ${highlightedWord}
                ${MAGIC_WAND_SVG}
            </li>
        `;
    }).join('');

    suggestionList.innerHTML = `<ul class="max-h-[40vh] overflow-y-auto p-2">${prefixHtml}${fuzzyHtml}</ul>`;
    
    _show();
    activeIndex = -1;
    _updateActiveDescendant();
}

// --- Public API ---
export async function update(input) {
    currentPrefix = input.trim().toLowerCase();
    
    const { prefixResults, fuzzyPromise } = suggestionEngine.getSuggestions(currentPrefix);
    
    _renderSuggestions({ prefixResults });

    try {
        const fuzzyResults = await fuzzyPromise;
        if (searchInput.value.trim().toLowerCase() === currentPrefix && (fuzzyResults.length > 0 || prefixResults.length > 0)) {
            _renderSuggestions({ prefixResults, fuzzyResults });
        } else if (searchInput.value.trim().toLowerCase() !== currentPrefix) {
            // Input changed while waiting, do nothing
        } else {
             _renderSuggestions({ prefixResults: [], fuzzyResults: [] });
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Fuzzy search failed unexpectedly:", error);
        }
    }
}

export function hide() {
    if (!isVisible) return;
    suggestionList.classList.remove('opacity-100', 'scale-100');
    suggestionList.classList.add('opacity-0', 'scale-95');
    
    const onTransitionEnd = () => {
        if (!isVisible) suggestionList.classList.add('invisible');
    };
    suggestionList.addEventListener('transitionend', onTransitionEnd, { once: true });
    
    activeIndex = -1;
    isVisible = false;
    searchInput.removeAttribute('aria-activedescendant');
    searchInput.setAttribute('aria-expanded', 'false');
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