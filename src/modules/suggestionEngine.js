// src/modules/suggestionEngine.js

// --- Data Structures ---
let trieStructure, pointerMap, compressedRanks;

class PriorityQueue {
    constructor() { this._heap = []; }
    size() { return this._heap.length; }
    isEmpty() { return this.size() === 0; }
    
    insert(item, priority) {
        this._heap.push({ item, priority });
        this._siftUp(this.size() - 1);
    }
    
    extractMin() {
        if (this.isEmpty()) return null;
        if (this.size() === 1) return this._heap.pop().item;
        
        const min = this._heap[0];
        this._heap[0] = this._heap.pop();
        this._siftDown(0);
        return min.item;
    }
    
    _siftUp(nodeIdx) {
        while (nodeIdx > 0) {
            const parentIdx = this._parent(nodeIdx);
            if (this._compare(nodeIdx, parentIdx)) {
                this._swap(nodeIdx, parentIdx);
                nodeIdx = parentIdx;
            } else {
                break;
            }
        }
    }

    _siftDown(nodeIdx) {
        while (true) {
            let smallest = nodeIdx;
            const leftIdx = this._left(nodeIdx);
            const rightIdx = this._right(nodeIdx);
            
            if (leftIdx < this.size() && this._compare(leftIdx, smallest)) {
                smallest = leftIdx;
            }
            if (rightIdx < this.size() && this._compare(rightIdx, smallest)) {
                smallest = rightIdx;
            }
            
            if (smallest === nodeIdx) break;
            
            this._swap(nodeIdx, smallest);
            nodeIdx = smallest;
        }
    }

    _parent(i) { return Math.floor((i - 1) / 2); }
    _left(i) { return i * 2 + 1; }
    _right(i) { return i * 2 + 2; }
    _compare(i, j) { return this._heap[i].priority < this._heap[j].priority; }
    _swap(i, j) { [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]]; }
}


// --- Helper Functions ---
const codeToChar = (code) => String.fromCharCode(code + 'a'.charCodeAt(0) - 1);
const charToCode = (char) => char.charCodeAt(0) - 'a'.charCodeAt(0) + 1;

function decodeVarInt(buffer, offset) {
    const B = 128;
    let res = 0;
    let shift = 0;
    let i = offset;
    while (i < buffer.length) {
        const byte = buffer[i++];
        res |= (byte & (B - 1)) << shift;
        if ((byte & B) === 0) break;
        shift += 7;
    }
    return res;
}

function getBestRank(nodeIndex) {
    if (!pointerMap || nodeIndex >= pointerMap.length) return 65535;
    const offset = pointerMap[nodeIndex];
    return decodeVarInt(compressedRanks, offset);
}

// --- Core Initialization ---
export async function init() {
    if (trieStructure) return;
    try {
        const response = await fetch('/trie.bin');
        if (!response.ok) {
            throw new Error(`Failed to fetch trie.bin: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();

        if (buffer.byteLength < 12) throw new Error('Invalid trie.bin: file is too small.');

        const header = new Uint32Array(buffer, 0, 3);
        const structureLen = header[0];
        const pointerMapLen = header[1];
        
        let offset = header.byteLength;
        trieStructure = new Uint32Array(buffer, offset, structureLen / 4);
        offset += structureLen;
        pointerMap = new Uint32Array(buffer, offset, pointerMapLen / 4);
        offset += pointerMapLen;
        compressedRanks = new Uint8Array(buffer, offset);
        
        console.log(`Binary Trie loaded and parsed successfully. Nodes: ${trieStructure.length}`);
    } catch (error) {
        console.error('Could not initialize suggestion engine:', error);
        throw error;
    }
}

// --- Search Algorithms ---

function getPrefixNode(prefix) {
    let currentNodeIndex = 0;
    for (const char of prefix) {
        const charCode = charToCode(char);
        const packed = trieStructure[currentNodeIndex];
        const childCount = (packed >>> 20) & 0x3F;
        if (childCount === 0) return -1; // Not found

        const firstChildIndex = packed & 0xFFFFF;
        let found = false;
        for (let i = 0; i < childCount; i++) {
            const childIndex = firstChildIndex + i;
            const childPacked = trieStructure[childIndex];
            const childCharCode = childPacked >>> 27;
            if (childCharCode === charCode) {
                currentNodeIndex = childIndex;
                found = true;
                break;
            }
        }
        if (!found) return -1;
    }
    return currentNodeIndex;
}

function getPrefixSuggestions(prefix, limit) {
    if (!trieStructure) return [];
    
    const suggestions = [];
    const pq = new PriorityQueue();
    const startNodeIndex = getPrefixNode(prefix);

    if (startNodeIndex === -1) return [];

    const initialState = { index: startNodeIndex, word: prefix };
    pq.insert(initialState, getBestRank(startNodeIndex));
    
    let visitedCount = 0;
    const MAX_VISITS = 2000; // Budget

    while (!pq.isEmpty() && suggestions.length < limit && visitedCount < MAX_VISITS) {
        const { index, word } = pq.extractMin();
        visitedCount++;

        const packed = trieStructure[index];
        const isEndOfWord = (packed >>> 26) & 1;
        
        if (isEndOfWord) {
            suggestions.push(word);
        }

        const childCount = (packed >>> 20) & 0x3F;
        if (childCount > 0) {
            const firstChildIndex = packed & 0xFFFFF;
            for (let i = 0; i < childCount; i++) {
                const childIndex = firstChildIndex + i;
                const childPacked = trieStructure[childIndex];
                const charCode = childPacked >>> 27;
                
                const nextState = { index: childIndex, word: word + codeToChar(charCode) };
                pq.insert(nextState, getBestRank(childIndex));
            }
        }
    }
    return suggestions;
}

// Placeholder for fuzzy search
function getFuzzySuggestions(prefix, limit, { signal }) {
    // This is where we'll implement the fuzzy search logic in the next step.
    // For now, it returns an empty array.
    if (signal?.aborted) return [];
    console.log("Fuzzy search would run for:", prefix);
    return [];
}


// --- Public API ---

export function getSuggestions(prefix, limit = 7) {
    const cleanPrefix = (prefix || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!cleanPrefix) return { prefixResults: [], fuzzyPromise: Promise.resolve([]) };

    // 1. Get prefix results immediately
    const prefixResults = getPrefixSuggestions(cleanPrefix, limit);
    
    // 2. If prefix results are enough, don't start fuzzy search
    if (prefixResults.length >= limit) {
        return { prefixResults, fuzzyPromise: Promise.resolve([]) };
    }
    
    // 3. Prepare for fuzzy search
    const remainingLimit = limit - prefixResults.length;
    const fuzzyPromise = new Promise((resolve) => {
        // Run in next event loop tick to not block UI
        setTimeout(() => {
            const fuzzyResults = getFuzzySuggestions(cleanPrefix, remainingLimit, {});
            resolve(fuzzyResults);
        }, 0);
    });

    return { prefixResults, fuzzyPromise };
}

export function isWord(word) {
    const lowerWord = (word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!trieStructure || !lowerWord) return false;
    
    const nodeIndex = getPrefixNode(lowerWord);
    if (nodeIndex === -1) return false;

    const finalPackedNode = trieStructure[nodeIndex];
    const isEndOfWord = (finalPackedNode >>> 26) & 1;
    
    return isEndOfWord === 1;
}