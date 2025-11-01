// src/modules/suggestionEngine.js

let trieData = null; // 将持有 Uint32Array 视图

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
  }
}

export function getSuggestions(prefix, limit = 7) {
  if (!trieData || !prefix) return [];

  const lowerPrefix = prefix.toLowerCase();
  let currentNodeIndex = 0;

  for (const char of lowerPrefix) {
    const charCode = charToCode(char);
    const packedNode = trieData[currentNodeIndex];
    
    const childCount = packedNode >>> 26;
    if (childCount === 0) return []; // 没有子节点，无法继续匹配

    const firstChildIndex = packedNode & 0xFFFFF;
    let found = false;

    for (let i = 0; i < childCount; i++) {
      const childIndex = firstChildIndex + i;
      const childPackedNode = trieData[childIndex];
      const childCharCode = (childPackedNode >>> 20) & 0x1F;

      if (childCharCode === charCode) {
        currentNodeIndex = childIndex;
        found = true;
        break; // 找到匹配的字符，跳出内层循环
      }
    }
    
    if (!found) return []; // 如果在子节点中找不到当前字符，说明没有匹配项
  }

  const suggestions = [];
  
  function collectWords(nodeIndex, currentWord) {
    if (suggestions.length >= limit) return;

    const packed = trieData[nodeIndex];
    const isEndOfWord = (packed >>> 25) & 1;
    
    if (isEndOfWord) {
      suggestions.push(currentWord);
    }
    
    const childCount = packed >>> 26;
    if (childCount === 0) return;

    // 因为子节点在构建时已按频率排序，所以直接遍历就是高频优先
    const firstChildIndex = packed & 0xFFFFF;
    for (let i = 0; i < childCount; i++) {
      if (suggestions.length >= limit) return;
      const childIndex = firstChildIndex + i;
      const childPacked = trieData[childIndex];
      const charCode = (childPacked >>> 20) & 0x1F;
      collectWords(childIndex, currentWord + codeToChar(charCode));
    }
  }

  collectWords(currentNodeIndex, lowerPrefix);

  return suggestions;
}
