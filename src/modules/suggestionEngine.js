// src/modules/suggestionEngine.js

let trieData = null; // 将持有 Uint32Array 视图

// --- 解码工具 ---
const codeToChar = (code) => String.fromCharCode(code + 'a'.charCodeAt(0) - 1);
const charToCode = (char) => char.charCodeAt(0) - 'a'.charCodeAt(0) + 1;

// --- 公共 API ---

/**
 * 异步加载并初始化二进制 Trie。
 */
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
  }
}

/**
 * 根据前缀从二进制 Trie 中获取建议。
 * @param {string} prefix - 用户输入的前缀。
 * @param {number} limit - 返回建议的最大数量。
 * @returns {string[]} - 匹配的单词数组。
 */
export function getSuggestions(prefix, limit = 7) {
  if (!trieData || !prefix) return [];

  const lowerPrefix = prefix.toLowerCase();
  let currentNodeIndex = 0; // 从根节点开始

  // 1. 导航到前缀的末尾节点
  for (const char of lowerPrefix) {
    const charCode = charToCode(char);
    const packedNode = trieData[currentNodeIndex];
    
    const childCount = packedNode >>> 28;
    if (childCount === 0) return []; // 没有子节点，无法继续
    
    const firstChildIndex = packedNode & 0x3FFFFF;

    // 使用绝对索引进行搜索，更稳健
    let low = firstChildIndex;
    let high = firstChildIndex + childCount - 1;
    let found = false;

    while (low <= high) {
      const midIndex = Math.floor((low + high) / 2);
      const midPackedNode = trieData[midIndex];
      const midCharCode = (midPackedNode >>> 22) & 0x1F;

      if (midCharCode === charCode) {
        currentNodeIndex = midIndex;
        found = true;
        break;
      } else if (midCharCode < charCode) {
        low = midIndex + 1;
      } else {
        high = midIndex - 1;
      }
    }
    
    if (!found) return []; // 没找到匹配的字符
  }

  // 2. 从该节点开始，使用递归式深度优先搜索 (DFS) 收集所有单词
  const suggestions = [];
  
  /**
   * --- 单词收集逻辑 (递归DFS) ---
   * @param {number} nodeIndex - 当前节点的索引
   * @param {string} currentWord - 从根到此节点形成的单词
   */
  function collectWords(nodeIndex, currentWord) {
    if (suggestions.length >= limit) return;

    const packed = trieData[nodeIndex];
    const isEndOfWord = (packed >>> 27) & 1;
    
    if (isEndOfWord) {
      suggestions.push(currentWord);
    }
    
    const childCount = packed >>> 28;
    if (childCount === 0) return;

    const firstChildIndex = packed & 0x3FFFFF;
    for (let i = 0; i < childCount; i++) {
      if (suggestions.length >= limit) return; // 每次循环前都检查
      const childIndex = firstChildIndex + i;
      const childPacked = trieData[childIndex];
      const charCode = (childPacked >>> 22) & 0x1F;
      collectWords(childIndex, currentWord + codeToChar(charCode));
    }
  }

  collectWords(currentNodeIndex, lowerPrefix);

  return suggestions;
}
