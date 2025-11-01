// src/modules/suggestionEngine.js

let trieData = null; // 将持有 Uint32Array 视图

// --- 解码工具 ---
const codeToChar = (code) => String.fromCharCode(code + 'a'.charCodeAt(0) - 1);

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
    const charCode = char.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
    const packedNode = trieData[currentNodeIndex];
    
    const childCount = packedNode >>> 28;
    if (childCount === 0) return []; // 没有子节点，无法继续
    
    const firstChildIndex = packedNode & 0x3FFFFF;

    // 二分查找在子节点中找到匹配的字符
    let found = false;
    let low = 0;
    let high = childCount - 1;
    let mid = 0;

    while(low <= high) {
        mid = Math.floor((low + high) / 2);
        const childIndex = firstChildIndex + mid;
        const childPackedNode = trieData[childIndex];
        const childCharCode = (childPackedNode >>> 22) & 0x1F;

        if (childCharCode === charCode) {
            currentNodeIndex = childIndex;
            found = true;
            break;
        } else if (childCharCode < charCode) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    
    if (!found) return []; // 没找到匹配的字符
  }

  // 2. 从该节点开始，使用深度优先搜索 (DFS) 收集所有单词
  const suggestions = [];
  const stack = [{ index: currentNodeIndex, word: lowerPrefix }];

  while (stack.length > 0 && suggestions.length < limit) {
    const { index, word } = stack.pop();
    const packedNode = trieData[index];

    const isEndOfWord = (packedNode >>> 27) & 1;
    if (isEndOfWord) {
      suggestions.push(word);
    }

    const childCount = packedNode >>> 28;
    const firstChildIndex = packedNode & 0x3FFFFF;

    // 将子节点逆序压入栈，以保证输出是字典序
    for (let i = childCount - 1; i >= 0; i--) {
      const childIndex = firstChildIndex + i;
      const childPackedNode = trieData[childIndex];
      const childCharCode = (childPackedNode >>> 22) & 0x1F;
      const newWord = word + codeToChar(childCharCode);
      stack.push({ index: childIndex, word: newWord });
    }
  }

  return suggestions;
}
