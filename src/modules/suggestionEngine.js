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


// --- Constants & Helper Functions ---
const MAX_BEST_RANK = 65535;
const FUZZY_PENALTY = 100000;
const MAX_DISTANCE = 2;

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
    if (!pointerMap || nodeIndex >= pointerMap.length) return MAX_BEST_RANK;
    const offset = pointerMap[nodeIndex];
    return decodeVarInt(compressedRanks, offset);
}

function getPackedNode(index) {
    if (index < 0 || index >= trieStructure.length) return 0;
    return trieStructure[index];
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
function searchTrie(inputWord, limit, { isFuzzy = false, signal }) {
    if (!trieStructure || !inputWord) return [];

    const results = new Map();
    const pq = new PriorityQueue();
    const visited = new Set(); // To avoid redundant computations
    const inputLength = inputWord.length;

    // State: [nodeIndex, inputIdx, word, distance]
    const initialState = { index: 0, inputIdx: 0, word: '', distance: 0 };
    pq.insert(initialState, getBestRank(0));

    let visitedCount = 0;
    const MAX_VISITS = isFuzzy ? 3000 : 1000;

    while (!pq.isEmpty() && results.size < limit && visitedCount < MAX_VISITS) {
        if (signal?.aborted) throw new DOMException('Search aborted', 'AbortError');

        const state = pq.extractMin();
        visitedCount++;
        
        const { index, inputIdx, word, distance } = state;

        const stateKey = `${index},${inputIdx},${distance}`;
        if (visited.has(stateKey)) continue;
        visited.add(stateKey);
        
        const packed = getPackedNode(index);
        const isEndOfWord = (packed >>> 26) & 1;

        if (isEndOfWord && (inputIdx === inputLength || (isFuzzy && Math.abs(word.length - inputLength) <= distance))) {
            if (!results.has(word)) {
                results.set(word, distance);
            }
        }
        
        if (distance >= MAX_DISTANCE && isFuzzy) continue;
        if (!isFuzzy && inputIdx > inputLength) continue;

        const childCount = (packed >>> 20) & 0x3F;
        const nextInputChar = inputWord[inputIdx];
        
        // --- Prefix Search Continuation ---
        if (!isFuzzy && inputIdx === inputLength) {
            if (childCount > 0) {
                const firstChildIndex = packed & 0xFFFFF;
                for (let i = 0; i < childCount; i++) {
                    const childIndex = firstChildIndex + i;
                    const childPacked = getPackedNode(childIndex);
                    const charCode = childPacked >>> 27;
                    const nextState = { index: childIndex, inputIdx: inputLength, word: word + codeToChar(charCode), distance: 0 };
                    pq.insert(nextState, getBestRank(childIndex));
                }
            }
        }

        // --- Fuzzy & Prefix shared logic ---
        if (childCount > 0) {
            const firstChildIndex = packed & 0xFFFFF;
            for (let i = 0; i < childCount; i++) {
                const childIndex = firstChildIndex + i;
                const childPacked = getPackedNode(childIndex);
                const childCharCode = childPacked >>> 27;
                const childChar = codeToChar(childCharCode);

                // 1. Match
                if (inputIdx < inputLength && childCharCode === charToCode(nextInputChar)) {
                    const nextState = { index: childIndex, inputIdx: inputIdx + 1, word: word + childChar, distance: distance };
                    pq.insert(nextState, getBestRank(childIndex) + distance * FUZZY_PENALTY);
                }
                
                if (isFuzzy) {
                    // 2. Substitution
                    if (inputIdx < inputLength && childCharCode !== charToCode(nextInputChar)) {
                        const nextState = { index: childIndex, inputIdx: inputIdx + 1, word: word + childChar, distance: distance + 1 };
                        pq.insert(nextState, getBestRank(childIndex) + (distance + 1) * FUZZY_PENALTY);
                    }
                    // 3. Insertion
                    const nextState = { index: childIndex, inputIdx: inputIdx, word: word + childChar, distance: distance + 1 };
                    pq.insert(nextState, getBestRank(childIndex) + (distance + 1) * FUZZY_PENALTY);
                }
            }
        }

        // 4. Deletion
        if (isFuzzy && inputIdx < inputLength) {
            const nextState = { index: index, inputIdx: inputIdx + 1, word: word, distance: distance + 1 };
            pq.insert(nextState, getBestRank(index) + (distance + 1) * FUZZY_PENALTY);
        }
    }
    
    // Sort fuzzy results by distance, then by best rank (implicitly handled by PQ)
    if (isFuzzy) {
        return Array.from(results.entries())
            .sort(([, distA], [, distB]) => distA - distB)
            .map(([word]) => word);
    }

    return Array.from(results.keys());
}


// --- Public API ---
let currentController;

export function getSuggestions(prefix, limit = 7) {
    const cleanPrefix = (prefix || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!cleanPrefix) return { prefixResults: [], fuzzyPromise: Promise.resolve([]) };

    if (currentController) {
        currentController.abort();
    }
    currentController = new AbortController();
    const signal = currentController.signal;

    const prefixResults = searchTrie(cleanPrefix, limit, { isFuzzy: false });
    
    if (prefixResults.length >= limit) {
        return { prefixResults, fuzzyPromise: Promise.resolve([]) };
    }
    
    const remainingLimit = limit;
    const fuzzyPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                if (signal.aborted) return resolve([]);
                const fuzzyResults = searchTrie(cleanPrefix, remainingLimit, { isFuzzy: true, signal });
                const uniqueFuzzy = fuzzyResults.filter(word => !prefixResults.includes(word));
                resolve(uniqueFuzzy);
            } catch (error) {
                if (error.name === 'AbortError') {
                    resolve([]);
                } else {
                    reject(error);
                }
            }
        }, 50); // Small delay to allow UI to render first
    });

    return { prefixResults, fuzzyPromise };
}

export function isWord(word) {
    const lowerWord = (word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!trieStructure || !lowerWord) return false;
    
    let currentNodeIndex = 0;
    for (const char of lowerWord) {
        const charCode = charToCode(char);
        const packed = getPackedNode(currentNodeIndex);
        const childCount = (packed >>> 20) & 0x3F;
        if (childCount === 0) return false;

        const firstChildIndex = packed & 0xFFFFF;
        let found = false;
        for (let i = 0; i < childCount; i++) {
            const childIndex = firstChildIndex + i;
            const childPacked = getPackedNode(childIndex);
            const childCharCode = childPacked >>> 27;
            if (childCharCode === charCode) {
                currentNodeIndex = childIndex;
                found = true;
                break;
            }
        }
        if (!found) return false;
    }

    const finalPackedNode = getPackedNode(currentNodeIndex);
    const isEndOfWord = (finalPackedNode >>> 26) & 1;
    
    return isEndOfWord === 1;
}