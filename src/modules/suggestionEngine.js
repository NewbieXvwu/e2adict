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
    if (childCount === 0) return [];
    
    const firstChildIndex = packedNode & 0xFFFFF; // 掩码 0xFFFFF 是 20 个 1

    let low = firstChildIndex;
    let high = firstChildIndex + childCount - 1;
    let found = false;

    while (low <= high) {
      const midIndex = Math.floor((low + high) / 2);
      const midPackedNode = trieData[midIndex];
      const midCharCode = (midPackedNode >>> 20) & 0x1F; // 掩码 0x1F 是 5 个 1

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
    
    if (!found) return [];
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
