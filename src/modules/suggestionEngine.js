// src/modules/suggestionEngine.js

// --- Data Structures ---
let trieStructure, pointerMap, compressedRanks;

class PriorityQueue {
    constructor() { this._heap = []; }
    size() { return this._heap.length; }
    isEmpty() { return this.size() === 0; }
    insert(item, priority) { this._heap.push({ item, priority }); this._siftUp(this.size() - 1); }
    extractMin() { if (this.isEmpty()) return null; if (this.size() === 1) return this._heap.pop().item; const min = this._heap[0]; this._heap[0] = this._heap.pop(); this._siftDown(0); return min.item; }
    _siftUp(nodeIdx) { while (nodeIdx > 0) { const parentIdx = this._parent(nodeIdx); if (this._compare(nodeIdx, parentIdx)) { this._swap(nodeIdx, parentIdx); nodeIdx = parentIdx; } else { break; } } }
    _siftDown(nodeIdx) { while (true) { let smallest = nodeIdx; const leftIdx = this._left(nodeIdx); const rightIdx = this._right(nodeIdx); if (leftIdx < this.size() && this._compare(leftIdx, smallest)) { smallest = leftIdx; } if (rightIdx < this.size() && this._compare(rightIdx, smallest)) { smallest = rightIdx; } if (smallest === nodeIdx) break; this._swap(nodeIdx, smallest); nodeIdx = smallest; } }
    _parent(i) { return Math.floor((i - 1) / 2); }
    _left(i) { return i * 2 + 1; }
    _right(i) { return i * 2 + 2; }
    _compare(i, j) { return this._heap[i].priority < this._heap[j].priority; }
    _swap(i, j) { [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]]; }
}

// --- Constants & Helper Functions ---
const MAX_BEST_RANK = 65535;
const MAX_DISTANCE = 2;
const codeToChar = (code) => String.fromCharCode(code + 'a'.charCodeAt(0) - 1);
const charToCode = (char) => char.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
const getPackedNode = (index) => trieStructure[index] || 0;

function decodeVarInt(buffer, offset) {
    const B = 128; let res = 0; let shift = 0; let i = offset;
    while (i < buffer.length) { const byte = buffer[i++]; res |= (byte & (B - 1)) << shift; if ((byte & B) === 0) break; shift += 7; }
    return res;
}
function getBestRank(nodeIndex) { if (!pointerMap || nodeIndex >= pointerMap.length) return MAX_BEST_RANK; const offset = pointerMap[nodeIndex]; return decodeVarInt(compressedRanks, offset); }

// --- Core Initialization ---
export async function init() {
    if (trieStructure) return;
    try {
        const response = await fetch('/trie.bin');
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        const buffer = await response.arrayBuffer();
        const header = new Uint32Array(buffer, 0, 3);
        const [structureLen, pointerMapLen] = header;
        let offset = header.byteLength;
        trieStructure = new Uint32Array(buffer, offset, structureLen / 4);
        offset += structureLen;
        pointerMap = new Uint32Array(buffer, offset, pointerMapLen / 4);
        offset += pointerMapLen;
        compressedRanks = new Uint8Array(buffer, offset);
        console.log(`Trie loaded. Nodes: ${trieStructure.length}`);
    } catch (error) {
        console.error('Could not initialize suggestion engine:', error);
        throw error;
    }
}

// --- Search Algorithms ---
function getPrefixNode(prefix) {
    let nodeIndex = 0;
    for (const char of prefix) {
        const charCode = charToCode(char);
        const packed = getPackedNode(nodeIndex);
        const childCount = (packed >>> 20) & 0x3F;
        if (childCount === 0) return -1;
        const firstChildIndex = packed & 0xFFFFF;
        let found = false;
        for (let i = 0; i < childCount; i++) {
            const childIndex = firstChildIndex + i;
            if ((getPackedNode(childIndex) >>> 27) === charCode) {
                nodeIndex = childIndex;
                found = true;
                break;
            }
        }
        if (!found) return -1;
    }
    return nodeIndex;
}

function getPrefixSuggestions(prefix, limit) {
    if (!trieStructure) return [];
    const startNodeIndex = getPrefixNode(prefix);
    if (startNodeIndex === -1) return [];
    
    const suggestions = [];
    const pq = new PriorityQueue();
    pq.insert({ index: startNodeIndex, word: prefix }, getBestRank(startNodeIndex));
    
    let visitedCount = 0;
    while (!pq.isEmpty() && suggestions.length < limit && visitedCount < 2000) {
        const { index, word } = pq.extractMin();
        visitedCount++;
        const packed = getPackedNode(index);
        if ((packed >>> 26) & 1) suggestions.push(word);
        
        const childCount = (packed >>> 20) & 0x3F;
        if (childCount > 0) {
            const firstChildIndex = packed & 0xFFFFF;
            for (let i = 0; i < childCount; i++) {
                const childIndex = firstChildIndex + i;
                const charCode = getPackedNode(childIndex) >>> 27;
                pq.insert({ index: childIndex, word: word + codeToChar(charCode) }, getBestRank(childIndex));
            }
        }
    }
    return suggestions;
}

let fuzzyResults;
function _findFuzzyMatches(nodeIndex, remainingChars, currentWord, distance, signal, memo) {
    if (signal?.aborted) throw new DOMException('Search aborted', 'AbortError');
    const memoKey = `${nodeIndex}:${remainingChars.length}:${distance}`;
    if (memo.has(memoKey)) return;
    memo.set(memoKey, true);

    if (distance > MAX_DISTANCE) return;
    
    if (remainingChars.length === 0) {
        if ((getPackedNode(nodeIndex) >>> 26) & 1) {
            if (!fuzzyResults.has(currentWord) || fuzzyResults.get(currentWord).distance > distance) {
                fuzzyResults.set(currentWord, { rank: getBestRank(nodeIndex), distance });
            }
        }
    }

    const packed = getPackedNode(nodeIndex);
    const childCount = (packed >>> 20) & 0x3F;
    const firstChildIndex = packed & 0xFFFFF;

    const firstChar = remainingChars[0];
    const restChars = remainingChars.substring(1);

    if (remainingChars.length > 0) {
        _findFuzzyMatches(nodeIndex, restChars, currentWord, distance + 1, signal, memo); // Deletion
    }

    for (let i = 0; i < childCount; i++) {
        const childIndex = firstChildIndex + i;
        const childChar = codeToChar(getPackedNode(childIndex) >>> 27);

        if (remainingChars.length > 0) {
            if (childChar === firstChar) {
                _findFuzzyMatches(childIndex, restChars, currentWord + childChar, distance, signal, memo); // Match
            } else {
                _findFuzzyMatches(childIndex, restChars, currentWord + childChar, distance + 1, signal, memo); // Substitution
            }
        }
        _findFuzzyMatches(childIndex, remainingChars, currentWord + childChar, distance + 1, signal, memo); // Insertion
    }
}

function getFuzzySuggestions(prefix, limit, { signal }) {
    fuzzyResults = new Map();
    _findFuzzyMatches(0, prefix, '', 0, signal, new Map());
    
    return Array.from(fuzzyResults.entries())
        .sort(([, a], [, b]) => a.distance !== b.distance ? a.distance - b.distance : a.rank - b.rank)
        .map(([word]) => word)
        .slice(0, limit);
}

// --- Public API ---
let currentController;
export function getSuggestions(prefix, limit = 7) {
    const cleanPrefix = (prefix || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!cleanPrefix || cleanPrefix.length < 2) return { prefixResults: [], fuzzyPromise: Promise.resolve([]) };

    if (currentController) currentController.abort();
    currentController = new AbortController();
    const signal = currentController.signal;

    const prefixResults = getPrefixSuggestions(cleanPrefix, limit);
    
    if (prefixResults.length >= limit) return { prefixResults, fuzzyPromise: Promise.resolve([]) };
    
    const remainingLimit = limit - prefixResults.length;
    const fuzzyPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const results = getFuzzySuggestions(cleanPrefix, remainingLimit, { signal });
                resolve(results.filter(word => !prefixResults.includes(word)));
            } catch (error) {
                if (error.name === 'AbortError') resolve([]); 
                else reject(error);
            }
        }, 0);
    });

    return { prefixResults, fuzzyPromise };
}

export function isWord(word) {
    const lowerWord = (word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!trieStructure || !lowerWord) return false;
    const nodeIndex = getPrefixNode(lowerWord);
    if (nodeIndex === -1) return false;
    return ((getPackedNode(nodeIndex) >>> 26) & 1) === 1;
}
