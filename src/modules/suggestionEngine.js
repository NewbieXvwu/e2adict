// src/modules/suggestionEngine.js

// --- Data Structures ---
let trieStructure, pointerMap, compressedRanks, bestRanks;
const prefixNodeCache = new Map();

class PriorityQueue {
    constructor() { this._heap = []; }
    size() { return this._heap.length; }
    isEmpty() { return this.size() === 0; }
    insert(item, priority) { this._heap.push({ item, priority }); this._siftUp(this.size() - 1); }
    extractMin() { if (this.isEmpty()) return null; if (this.size() === 1) return this._heap.pop(); const min = this._heap[0]; this._heap[0] = this._heap.pop(); this._siftDown(0); return min; }
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
const MAX_VISITED_NODES = 2000;
const MAX_PREFIX_CACHE_SIZE = 10000;
const MIN_SUGGESTION_LENGTH = 2;
const DEFAULT_SUGGESTION_LIMIT = 7;

const codeToChar = (code) => String.fromCharCode(code + 'a'.charCodeAt(0) - 1);
const charToCode = (char) => char.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
const getPackedNode = (index) => trieStructure[index] || 0;

function getBestRank(nodeIndex) {
    if (!bestRanks || nodeIndex >= bestRanks.length) return MAX_BEST_RANK;
    return bestRanks[nodeIndex];
}

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
        
        // Pre-decode all ranks for O(1) access
        const totalNodes = pointerMap.length;
        bestRanks = new Uint16Array(totalNodes);
        const B = 128;
        for (let i = 0; i < totalNodes; i++) {
            let res = 0, shift = 0, idx = pointerMap[i];
            while (idx < compressedRanks.length) {
                const byte = compressedRanks[idx++];
                res |= (byte & (B - 1)) << shift;
                if ((byte & B) === 0) break;
                shift += 7;
            }
            bestRanks[i] = res > MAX_BEST_RANK ? MAX_BEST_RANK : res;
        }
        
        // Free memory from raw buffers once decoded
        compressedRanks = null;
        pointerMap = null;
        
        prefixNodeCache.clear();
        prefixNodeCache.set('', 0);

        console.log(`Trie loaded. Nodes: ${trieStructure.length}`);
    } catch (error) {
        console.error('Could not initialize suggestion engine:', error);
        throw error;
    }
}

// --- Search Algorithms ---
function getPrefixNode(prefix) {
    if (prefixNodeCache.has(prefix)) {
        return prefixNodeCache.get(prefix);
    }

    let nodeIndex = 0;
    let currentPrefix = '';

    for (const char of prefix) {
        currentPrefix += char;

        if (prefixNodeCache.has(currentPrefix)) {
            const cached = prefixNodeCache.get(currentPrefix);
            if (cached === -1) {
                prefixNodeCache.set(prefix, -1);
                return -1;
            }
            nodeIndex = cached;
            continue;
        }

        const charCode = charToCode(char);
        const packed = getPackedNode(nodeIndex);
        const childCount = (packed >>> 20) & 0x3F;
        if (childCount === 0) {
            prefixNodeCache.set(currentPrefix, -1);
            prefixNodeCache.set(prefix, -1);
            return -1;
        }

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

        if (!found) {
            prefixNodeCache.set(currentPrefix, -1);
            prefixNodeCache.set(prefix, -1);
            return -1;
        }

        if (prefixNodeCache.size < MAX_PREFIX_CACHE_SIZE) {
            prefixNodeCache.set(currentPrefix, nodeIndex);
        }
    }

    if (prefixNodeCache.size < MAX_PREFIX_CACHE_SIZE) {
        prefixNodeCache.set(prefix, nodeIndex);
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

    let worstPriority = MAX_BEST_RANK;
    const insertSuggestion = (entry) => {
        let left = 0;
        let right = suggestions.length;
        while (left < right) {
            const mid = (left + right) >>> 1;
            if (entry.priority < suggestions[mid].priority) {
                right = mid;
            } else {
                left = mid + 1;
            }
        }
        suggestions.splice(left, 0, entry);
        if (suggestions.length > limit) {
            suggestions.pop();
        }
        worstPriority = suggestions.length === limit ? suggestions[suggestions.length - 1].priority : MAX_BEST_RANK;
    };

    let visitedCount = 0;
    while (!pq.isEmpty() && visitedCount < MAX_VISITED_NODES) {
        const node = pq.extractMin();
        if (!node) break;
        const { index, word } = node.item;
        const priority = node.priority;

        if (suggestions.length === limit && priority > worstPriority) {
            break;
        }

        visitedCount++;
        const packed = getPackedNode(index);
        if ((packed >>> 26) & 1) {
            insertSuggestion({ word, priority });
        }

        const childCount = (packed >>> 20) & 0x3F;
        if (childCount > 0) {
            const firstChildIndex = packed & 0xFFFFF;
            for (let i = 0; i < childCount; i++) {
                const childIndex = firstChildIndex + i;
                const childPriority = getBestRank(childIndex);
                if (suggestions.length === limit && childPriority > worstPriority) {
                    continue;
                }
                const charCode = getPackedNode(childIndex) >>> 27;
                pq.insert({ index: childIndex, word: word + codeToChar(charCode) }, childPriority);
            }
        }
    }

    return suggestions.map((entry) => entry.word);
}

let fuzzyResults;
let fuzzyWorstDistance = MAX_DISTANCE;
let fuzzyLimit = DEFAULT_SUGGESTION_LIMIT;
function _findFuzzyMatches(nodeIndex, remainingChars, currentWord, distance, signal, memo) {
    if (signal?.aborted) throw new DOMException('Search aborted', 'AbortError');
    if (distance > MAX_DISTANCE) return;
    if (fuzzyResults.size >= fuzzyLimit && distance > fuzzyWorstDistance) return;

    const memoKey = `${nodeIndex}:${remainingChars.length}:${distance}`;
    if (memo.has(memoKey)) return;
    memo.set(memoKey, true);
    
    if (remainingChars.length === 0) {
        if ((getPackedNode(nodeIndex) >>> 26) & 1) {
            const existing = fuzzyResults.get(currentWord);
            if (!existing || existing.distance > distance || (existing.distance === distance && existing.rank > getBestRank(nodeIndex))) {
                fuzzyResults.set(currentWord, { rank: getBestRank(nodeIndex), distance });
                if (fuzzyResults.size >= fuzzyLimit) {
                    fuzzyWorstDistance = Math.max(...Array.from(fuzzyResults.values(), value => value.distance));
                }
            }
        }
    }

    const packed = getPackedNode(nodeIndex);
    const childCount = (packed >>> 20) & 0x3F;
    const firstChildIndex = packed & 0xFFFFF;

    if (remainingChars.length > 0) {
        _findFuzzyMatches(nodeIndex, remainingChars.substring(1), currentWord, distance + 1, signal, memo); // Deletion
    }

    if (childCount === 0) return;

    const firstChar = remainingChars[0];
    const restChars = remainingChars.substring(1);

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
    fuzzyLimit = Math.max(0, limit);
    fuzzyWorstDistance = MAX_DISTANCE;
    if (fuzzyLimit === 0) return [];
    _findFuzzyMatches(0, prefix, '', 0, signal, new Map());
    
    return Array.from(fuzzyResults.entries())
        .sort(([, a], [, b]) => a.distance !== b.distance ? a.distance - b.distance : a.rank - b.rank)
        .map(([word]) => word)
        .slice(0, limit);
}

// --- Public API ---
let currentController;
export function getSuggestions(prefix, limit = DEFAULT_SUGGESTION_LIMIT) {
    const cleanPrefix = (prefix || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!cleanPrefix || cleanPrefix.length < MIN_SUGGESTION_LENGTH) return { prefixResults: [], fuzzyPromise: Promise.resolve([]) };

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
