// scripts/build-trie.js
import fs from 'fs';
import path from 'path';

console.log('Starting Binary Trie build process with frequency ranking...');

const DICTIONARY_SOURCE_DIR = 'dictionary';
const WORDS_LIST_PATH = 'words.txt'; // 由 Python 脚本生成
const OUTPUT_PATH = 'public/trie.bin';

function charToCode(char) {
  return char.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
}

/**
 * 构建内存中的 Trie 树。
 * 每个节点会额外记录一个 bestRank 属性，
 * 代表所有经过此节点的单词中，频率最高的那个单词的排名。
 * @param {string[]} words - 按频率降序排列的单词列表。
 * @param {Map<string, number>} rankMap - 单词到其频率排名的映射。
 * @returns {object} - Trie 树的根节点。
 */
function buildInMemoryTrie(words, rankMap) {
  const root = { children: {}, isEndOfWord: false, bestRank: Infinity };

  for (const word of words) {
    let currentNode = root;
    const wordRank = rankMap.get(word);

    // 将当前单词的排名信息传播到路径上的所有节点
    currentNode.bestRank = Math.min(currentNode.bestRank, wordRank);

    for (const char of word) {
      if (!currentNode.children[char]) {
        currentNode.children[char] = { children: {}, isEndOfWord: false, bestRank: Infinity };
      }
      currentNode = currentNode.children[char];
      currentNode.bestRank = Math.min(currentNode.bestRank, wordRank);
    }
    currentNode.isEndOfWord = true;
  }
  return root;
}

/**
 * 将内存中的 Trie 树“压平”成一个节点数组。
 * 关键：在这一步，同级子节点会根据 bestRank 进行排序。
 * @param {object} root - Trie 树的根节点。
 * @returns {Array<object>} - 扁平化的节点数组。
 */
function flattenTrie(root) {
  const flatNodes = [];
  const queue = [{ node: root, char: '' }];
  // 使用 Map 来跟踪每个内存节点在扁平数组中的索引
  const nodeMap = new Map([[root, 0]]);

  // 先把根节点放进去
  flatNodes.push({ charCode: 0, isEndOfWord: 0, firstChildIndex: 0, childCount: 0 });

  let head = 0;
  while (head < queue.length) {
    const { node } = queue[head++];
    const parentIndex = nodeMap.get(node);
    
    // 根据子节点的 bestRank 对其进行排序，bestRank 越小（词频越高）越靠前
    const sortedChildrenChars = Object.keys(node.children).sort((charA, charB) => {
      const nodeA = node.children[charA];
      const nodeB = node.children[charB];
      return nodeA.bestRank - nodeB.bestRank;
    });

    flatNodes[parentIndex].childCount = sortedChildrenChars.length;
    flatNodes[parentIndex].firstChildIndex = flatNodes.length;
    
    for (const childChar of sortedChildrenChars) {
      const childNode = node.children[childChar];
      const childIndex = flatNodes.length;
      
      nodeMap.set(childNode, childIndex);
      flatNodes.push({
        charCode: charToCode(childChar),
        isEndOfWord: childNode.isEndOfWord ? 1 : 0,
        firstChildIndex: 0, // 暂时为0，将在后续循环中填充
        childCount: 0,
      });
      queue.push({ node: childNode, char: childChar });
    }
  }
  return flatNodes;
}

/**
 * 将扁平化的节点数组编码成 Uint32Array。
 * @param {Array<object>} flatNodes - 扁平化的节点数组。
 * @returns {Uint32Array} - 编码后的二进制数据。
 */
function encodeToUint32Array(flatNodes) {
  const buffer = new Uint32Array(flatNodes.length);
  for (let i = 0; i < flatNodes.length; i++) {
    const node = flatNodes[i];
    
    let packedNode = 0;
    // 结构 (从低位到高位):
    // 0-19位 (20 bits): firstChildIndex  (最多支持 2^20 ≈ 100万 个节点)
    // 20-24位 (5 bits): charCode         (最多支持 2^5 = 32 个字符，a-z 是 26 个)
    // 25位 (1 bit): isEndOfWord
    // 26-31位 (6 bits): childCount       (最多支持 2^6 = 64 个子节点)
    packedNode |= node.firstChildIndex;
    packedNode |= (node.charCode << 20);
    packedNode |= (node.isEndOfWord << 25);
    packedNode |= (node.childCount << 26);
    
    buffer[i] = packedNode >>> 0; // 确保是无符号整数
  }
  return buffer;
}

// --- 主执行函数 ---
try {
  // 1. 读取按词频排序的单词列表
  if (!fs.existsSync(WORDS_LIST_PATH)) {
    throw new Error(`Word list not found at "${WORDS_LIST_PATH}". Please run the Python script first.`);
  }
  const words = fs.readFileSync(WORDS_LIST_PATH, 'utf-8').trim().split('\n');
  const rankMap = new Map(words.map((word, index) => [word, index]));
  console.log(`Loaded ${words.length} words with frequency ranks.`);

  // 2. 构建内存 Trie 树，并附加 bestRank 信息
  console.log('Step 1: Building in-memory Trie with rank propagation...');
  const inMemoryTrie = buildInMemoryTrie(words, rankMap);

  // 3. 将 Trie 树压平，此时会根据 bestRank 排序
  console.log('Step 2: Flattening Trie with frequency-based sorting...');
  const flatNodes = flattenTrie(inMemoryTrie);
  console.log(`Trie flattened into ${flatNodes.length} nodes.`);

  // 4. 编码成二进制格式
  console.log('Step 3: Encoding to Uint32Array...');
  const uint32Buffer = encodeToUint32Array(flatNodes);

  // 5. 写入文件
  const nodeBuffer = Buffer.from(uint32Buffer.buffer);
  fs.writeFileSync(OUTPUT_PATH, nodeBuffer);

  console.log(`✅ Binary Trie built successfully and saved to ${OUTPUT_PATH} (${(nodeBuffer.length / 1024).toFixed(2)} KB)`);

} catch (error) {
  console.error('Binary Trie build failed:', error);
  process.exit(1);
}
