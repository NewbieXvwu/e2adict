// scripts/build-trie.js

import fs from 'fs';
import path from 'path';

console.log('Starting Production Trie build process...');

// --- Configuration ---
const DICTIONARY_SOURCE_DIR = 'dictionary';
const WORDS_LIST_PATH = 'words.txt';
const OUTPUT_DIR = 'public';
const OUTPUT_FILENAME = 'trie.bin';
const OUTPUT_PATH = path.join(OUTPUT_DIR, OUTPUT_FILENAME);

// --- Helper Functions ---
const charToCode = (char) => char.charCodeAt(0) - 'a'.charCodeAt(0) + 1;

function encodeVarInt(num) {
    const B = 128;
    const bytes = [];
    while (num >= B) {
        bytes.push((num & (B - 1)) | B);
        num >>= 7;
    }
    bytes.push(num);
    return bytes;
}

// --- Core Logic ---

// 1. Build in-memory Trie with bestRank
function buildInMemoryTrie(words) {
    const root = { children: {}, isEndOfWord: false, bestRank: Infinity, rank: -1 };
    
    words.forEach((word, rank) => {
        let node = root;
        node.bestRank = Math.min(node.bestRank, rank);
        
        // Ensure we only process clean, lowercase words from the list
        const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
        if (!cleanWord) return;

        for (const char of cleanWord) {
            if (!node.children[char]) {
                node.children[char] = { children: {}, isEndOfWord: false, bestRank: Infinity, rank: -1 };
            }
            node = node.children[char];
            node.bestRank = Math.min(node.bestRank, rank);
        }
        node.isEndOfWord = true;
        node.rank = rank;
    });
    return root;
}

// 2. Flatten Trie into arrays
function flattenTrie(root) {
    const flatNodes = [];
    const flatBestRanks = [];
    const nodeMap = new Map([[root, 0]]);
    const queue = [root];

    flatNodes.push({ charCode: 0, isEndOfWord: false, childCount: 0, firstChildIndex: 0 });
    flatBestRanks.push(root.bestRank);
    
    let head = 0;
    while (head < queue.length) {
        const node = queue[head++];
        const parentIndex = nodeMap.get(node);

        const sortedChildrenChars = Object.keys(node.children).sort((a, b) => 
            node.children[a].bestRank - node.children[b].bestRank
        );

        if (sortedChildrenChars.length > 0) {
            flatNodes[parentIndex].childCount = sortedChildrenChars.length;
            flatNodes[parentIndex].firstChildIndex = flatNodes.length;
        }

        for (const char of sortedChildrenChars) {
            const childNode = node.children[char];
            const childIndex = flatNodes.length;
            nodeMap.set(childNode, childIndex);
            queue.push(childNode);
            
            flatNodes.push({
                charCode: charToCode(char),
                isEndOfWord: childNode.isEndOfWord,
                childCount: 0,
                firstChildIndex: 0
            });
            flatBestRanks.push(childNode.bestRank);
        }
    }
    return { flatNodes, flatBestRanks };
}

// 3. Encode flat arrays to binary format
function encodeToBinary(flatNodes, flatBestRanks) {
    const structureBuffer = new Uint32Array(flatNodes.length);
    for (let i = 0; i < flatNodes.length; i++) {
        const node = flatNodes[i];
        let packed = 0;
        packed |= node.firstChildIndex;      // 0-19 (20 bits)
        packed |= (node.childCount << 20);   // 20-25 (6 bits)
        packed |= ((node.isEndOfWord ? 1 : 0) << 26); // 26 (1 bit)
        packed |= (node.charCode << 27);     // 27-31 (5 bits)
        structureBuffer[i] = packed;
    }

    const pointerMapBuffer = new Uint32Array(flatBestRanks.length);
    const compressedRanksBytes = [];
    
    for (let i = 0; i < flatBestRanks.length; i++) {
        const rank = flatBestRanks[i];
        // Use 65535 as a sentinel for Infinity, fits in Uint16
        const rankToEncode = rank === Infinity ? 65535 : rank;
        const encodedBytes = encodeVarInt(rankToEncode);
        
        pointerMapBuffer[i] = compressedRanksBytes.length;
        compressedRanksBytes.push(...encodedBytes);
    }
    const compressedRanksBuffer = new Uint8Array(compressedRanksBytes);

    return { structureBuffer, pointerMapBuffer, compressedRanksBuffer };
}

// --- Main Execution ---
try {
    if (!fs.existsSync(WORDS_LIST_PATH)) {
        throw new Error(`Word list not found at "${WORDS_LIST_PATH}". Please run the Python script first.`);
    }

    console.log(`Step 1: Reading and cleaning word list from ${WORDS_LIST_PATH}...`);
    const words = fs.readFileSync(WORDS_LIST_PATH, 'utf-8')
        .split(/\r?\n/)
        .map(w => w.trim())
        .filter(w => w.length > 0 && /^[a-z]+$/i.test(w));

    console.log(`Loaded ${words.length} valid words. First 5:`, words.slice(0, 5));

    console.log('Step 2: Building in-memory Trie...');
    const inMemoryTrie = buildInMemoryTrie(words);

    console.log('Step 3: Flattening Trie...');
    const { flatNodes, flatBestRanks } = flattenTrie(inMemoryTrie);
    
    console.log('Step 4: Encoding to binary buffers...');
    const { structureBuffer, pointerMapBuffer, compressedRanksBuffer } = encodeToBinary(flatNodes, flatBestRanks);
    
    console.log('Step 5: Merging buffers and writing to file...');
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR);
    }
    const header = new Uint32Array([
        structureBuffer.byteLength,
        pointerMapBuffer.byteLength,
        compressedRanksBuffer.byteLength
    ]);
    
    const finalBuffer = Buffer.concat([
        Buffer.from(header.buffer),
        Buffer.from(structureBuffer.buffer),
        Buffer.from(pointerMapBuffer.buffer),
        Buffer.from(compressedRanksBuffer.buffer),
    ]);
    
    fs.writeFileSync(OUTPUT_PATH, finalBuffer);

    console.log(`\n✅ Production Trie built successfully at ${OUTPUT_PATH} (${(finalBuffer.length / 1024).toFixed(2)} KB)`);
    console.log(`   - Nodes: ${flatNodes.length}`);
    console.log(`   - Structure: ${(structureBuffer.byteLength / 1024).toFixed(2)} KB`);
    console.log(`   - Pointers: ${(pointerMapBuffer.byteLength / 1024).toFixed(2)} KB`);
    console.log(`   - Ranks: ${(compressedRanksBuffer.byteLength / 1024).toFixed(2)} KB`);

} catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
}