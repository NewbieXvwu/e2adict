// src/modules/suggestionEngine.js

let trieData = null;

const codeToChar = (code) => String.fromCharCode(code + 'a'.charCodeAt(0) - 1);
const charToCode = (char) => char.charCodeAt(0) - 'a'.charCodeAt(0) + 1;

export async function init() {
  if (trieData) return;
  try {
    const response = await fetch('/trie.bin');
    if (!response.ok) {
      throw new Error(`Failed to fetch trie.bin: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    trieData = new Uint32Array(arrayBuffer);
    console.log(`Binary Trie loaded successfully with ${trieData.length} nodes.`);
  } catch (error) {
    console.error('Could not initialize suggestion engine:', error);
    // 抛出错误以便上层捕获并给出用户提示
    throw error;
  }
}

export function getSuggestions(prefix, limit = 7) {
  const lowerPrefix = prefix.toLowerCase().replace(/[^a-z]/g, '');
  if (!trieData || !lowerPrefix) return [];

  let currentNodeIndex = 0;

  // 1. 找到前缀对应的节点
  for (const char of lowerPrefix) {
    const charCode = charToCode(char);
    const packedNode = trieData[currentNodeIndex];
    const childCount = packedNode >>> 26;
    if (childCount === 0) return [];
    const firstChildIndex = packedNode & 0xFFFFF;
    let found = false;
    for (let i = 0; i < childCount; i++) {
      const childIndex = firstChildIndex + i;
      const childPackedNode = trieData[childIndex];
      const childCharCode = (childPackedNode >>> 20) & 0x1F;
      if (childCharCode === charCode) {
        currentNodeIndex = childIndex;
        found = true;
        break;
      }
    }
    if (!found) return [];
  }

  // 2. 从该节点开始，使用 BFS 收集建议
  const suggestions = [];
  const queue = [{ nodeIndex: currentNodeIndex, word: lowerPrefix }];

  while (queue.length > 0) {
    const { nodeIndex, word } = queue.shift(); // 从队列头部取出

    // 检查当前节点是否代表一个完整的单词
    const packed = trieData[nodeIndex];
    const isEndOfWord = (packed >>> 25) & 1;
    if (isEndOfWord) {
      suggestions.push(word);
      if (suggestions.length >= limit) {
        return suggestions; // 找到足够多的建议，立即返回
      }
    }

    // 将所有子节点加入队列尾部
    const childCount = packed >>> 26;
    if (childCount === 0) continue;

    const firstChildIndex = packed & 0xFFFFF;
    for (let i = 0; i < childCount; i++) {
      const childIndex = firstChildIndex + i;
      const childPacked = trieData[childIndex];
      const charCode = (childPacked >>> 20) & 0x1F;
      const nextWord = word + codeToChar(charCode);
      queue.push({ nodeIndex: childIndex, word: nextWord });
    }
  }

  return suggestions;
}

export function isWord(word) {
  const lowerWord = (word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!trieData || !lowerWord) return false;

  let currentNodeIndex = 0;

  for (const char of lowerWord) {
    const charCode = charToCode(char);
    const packedNode = trieData[currentNodeIndex];
    
    const childCount = packedNode >>> 26;
    if (childCount === 0) return false;

    const firstChildIndex = packedNode & 0xFFFFF;
    let found = false;

    for (let i = 0; i < childCount; i++) {
      const childIndex = firstChildIndex + i;
      const childPackedNode = trieData[childIndex];
      const childCharCode = (childPackedNode >>> 20) & 0x1F;

      if (childCharCode === charCode) {
        currentNodeIndex = childIndex;
        found = true;
        break;
      }
    }
    
    if (!found) return false;
  }

  const finalPackedNode = trieData[currentNodeIndex];
  const isEndOfWord = (finalPackedNode >>> 25) & 1;
  
  return isEndOfWord === 1;
}
