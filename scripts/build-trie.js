// scripts/build-trie.js
import fs from 'fs';
import path from 'path';

console.log('Starting Binary Trie build process...');

const DICTIONARY_SOURCE_DIR = 'dictionary';
const OUTPUT_PATH = 'public/trie.bin';

function charToCode(char) {
  return char.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
}

function buildInMemoryTrie(words) {
  const root = { children: {}, isEndOfWord: false };
  for (const word of words) {
    let currentNode = root;
    for (const char of word) {
      if (!currentNode.children[char]) {
        currentNode.children[char] = { children: {}, isEndOfWord: false };
      }
      currentNode = currentNode.children[char];
    }
    currentNode.isEndOfWord = true;
  }
  return root;
}

function flattenTrie(root) {
  const flatNodes = [];
  const queue = [{ node: root, char: '' }];
  const nodeMap = new Map([[root, 0]]);

  flatNodes.push({ charCode: 0, isEndOfWord: 0, firstChildIndex: 0, childCount: 0 });

  let head = 0;
  while (head < queue.length) {
    const { node } = queue[head++];
    const parentIndex = nodeMap.get(node);
    const sortedChildren = Object.keys(node.children).sort();

    flatNodes[parentIndex].childCount = sortedChildren.length;
    flatNodes[parentIndex].firstChildIndex = flatNodes.length;
    
    for (const childChar of sortedChildren) {
      const childNode = node.children[childChar];
      const childIndex = flatNodes.length;
      
      nodeMap.set(childNode, childIndex);
      flatNodes.push({
        charCode: charToCode(childChar),
        isEndOfWord: childNode.isEndOfWord ? 1 : 0,
        firstChildIndex: 0,
        childCount: 0,
      });
      queue.push({ node: childNode, char: childChar });
    }
  }
  return flatNodes;
}

function encodeToUint32Array(flatNodes) {
  const buffer = new Uint32Array(flatNodes.length);
  for (let i = 0; i < flatNodes.length; i++) {
    const node = flatNodes[i];
    
    let packedNode = 0;
    packedNode |= node.firstChildIndex;                  // 0-19 位
    packedNode |= (node.charCode << 20);                 // 20-24 位
    packedNode |= (node.isEndOfWord << 25);              // 25 位
    packedNode |= (node.childCount << 26);               // 26-31 位
    
    buffer[i] = packedNode >>> 0;
  }
  return buffer;
}

// --- 主函数 ---
try {
  if (!fs.existsSync(DICTIONARY_SOURCE_DIR)) {
    console.error(`Error: Source directory not found at "${DICTIONARY_SOURCE_DIR}"`);
    process.exit(1);
  }

  const files = fs.readdirSync(DICTIONARY_SOURCE_DIR);
  const words = files
    .filter(file => path.extname(file) === '.json')
    .map(file => path.parse(file).name.toLowerCase())
    .filter(word => /^[a-z]+$/.test(word))
    .sort();

  if (words.length === 0) {
    throw new Error('No valid words found in the source directory.');
  }

  console.log(`Found ${words.length} valid words.`);
  
  console.log('Step 1: Building in-memory Trie...');
  const inMemoryTrie = buildInMemoryTrie(words);

  console.log('Step 2: Flattening Trie...');
  const flatNodes = flattenTrie(inMemoryTrie);
  console.log(`Trie flattened into ${flatNodes.length} nodes.`);

  console.log('Step 3: Encoding to Uint32Array...');
  const uint32Buffer = encodeToUint32Array(flatNodes);

  const nodeBuffer = Buffer.from(uint32Buffer.buffer);
  fs.writeFileSync(OUTPUT_PATH, nodeBuffer);

  console.log(`✅ Binary Trie built successfully and saved to ${OUTPUT_PATH} (${(nodeBuffer.length / 1024).toFixed(2)} KB)`);

} catch (error) {
  console.error('Binary Trie build failed:', error);
  process.exit(1);
}
