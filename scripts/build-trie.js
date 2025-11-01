// scripts/build-trie.js
import fs from 'fs';
import path from 'path';

console.log('Starting Binary Trie build process...');

const DICTIONARY_SOURCE_DIR = 'dictionary';
const OUTPUT_PATH = 'public/trie.bin';

// --- 字符编码 ---
function charToCode(char) {
  return char.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
}

// --- 步骤 1: 构建一个临时的、内存中的传统 Trie 树 ---
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

// --- 步骤 2: 将内存 Trie 扁平化为节点数组 ---
function flattenTrie(root) {
  const flatNodes = [];
  // 使用广度优先搜索 (BFS) 来确保父节点总是在子节点之前处理
  const queue = [{ node: root, char: '' }];
  const nodeMap = new Map([[root, 0]]); // 映射内存节点到它们在扁平数组中的索引

  // 根节点占位符，索引为0
  flatNodes.push({ charCode: 0, isEndOfWord: 0, firstChildIndex: 0, childCount: 0, children: [] });

  let head = 0;
  while (head < queue.length) {
    const { node, char } = queue[head++];
    const parentIndex = nodeMap.get(node);
    const sortedChildren = Object.keys(node.children).sort();

    flatNodes[parentIndex].childCount = sortedChildren.length;
    flatNodes[parentIndex].firstChildIndex = flatNodes.length;
    
    // 按字母顺序将子节点加入队列和扁平数组
    for (const childChar of sortedChildren) {
      const childNode = node.children[childChar];
      const childIndex = flatNodes.length;
      
      nodeMap.set(childNode, childIndex);
      flatNodes.push({
        charCode: charToCode(childChar),
        isEndOfWord: childNode.isEndOfWord ? 1 : 0,
        firstChildIndex: 0, // 稍后填充
        childCount: 0,      // 稍后填充
      });
      queue.push({ node: childNode, char: childChar });
    }
  }
  return flatNodes;
}

// --- 步骤 3: 将扁平化的节点数组编码为 Uint32Array ---
function encodeToUint32Array(flatNodes) {
  const buffer = new Uint32Array(flatNodes.length);
  for (let i = 0; i < flatNodes.length; i++) {
    const node = flatNodes[i];
    // 使用位运算将节点信息打包进一个 32 位整数
    let packedNode = 0;
    packedNode |= node.firstChildIndex;                  // 0-21 位
    packedNode |= (node.charCode << 22);                 // 22-26 位
    packedNode |= (node.isEndOfWord << 27);              // 27 位
    packedNode |= (node.childCount << 28);               // 28-31 位
    buffer[i] = packedNode;
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
    .filter(word => /^[a-z]+$/.test(word)) // 只包含纯小写字母的单词
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

  // 将 Uint32Array 转换为 Node.js Buffer 以便写入文件
  const nodeBuffer = Buffer.from(uint32Buffer.buffer);
  fs.writeFileSync(OUTPUT_PATH, nodeBuffer);

  console.log(`✅ Binary Trie built successfully and saved to ${OUTPUT_PATH} (${(nodeBuffer.length / 1024).toFixed(2)} KB)`);

} catch (error) {
  console.error('Binary Trie build failed:', error);
  process.exit(1);
}
