# scripts/generate-ranked-words.py
import sys
from pathlib import Path
from wordfreq import word_frequency

# 脚本所在的目录
SCRIPT_DIR = Path(__file__).parent
# 项目根目录 (scripts/../)
PROJECT_ROOT = SCRIPT_DIR.parent

# 定义相对于项目根目录的路径
DICTIONARY_SOURCE_DIR = PROJECT_ROOT / 'dictionary'
OUTPUT_PATH = PROJECT_ROOT / 'words.txt'
LANG = 'en'

def main():
  """
  读取 dictionary/ 目录下的所有单词，
  并根据 wordfreq 的频率对它们进行排序，
  最后将排序后的列表写入项目根目录的 words.txt。
  """
  if not DICTIONARY_SOURCE_DIR.is_dir():
    print(f"错误: 词典源目录 '{DICTIONARY_SOURCE_DIR}' 不存在。", file=sys.stderr)
    sys.exit(1)

  # 1. 从文件名中获取词典中的所有单词
  dict_words = {path.stem.lower() for path in DICTIONARY_SOURCE_DIR.glob('*.json')}
  
  if not dict_words:
    print(f"错误: 在 '{DICTIONARY_SOURCE_DIR}' 中没有找到任何 .json 文件。", file=sys.stderr)
    sys.exit(1)

  print(f"从 '{DICTIONARY_SOURCE_DIR}' 目录中找到了 {len(dict_words)} 个单词。")

  # 2. 根据词频对单词列表进行排序
  print("正在根据词频排序...")
  try:
    sorted_words = sorted(
      list(dict_words),
      key=lambda word: (-word_frequency(word, LANG), word)
    )
  except Exception as e:
    print(f"错误: 在排序过程中发生异常: {e}", file=sys.stderr)
    sys.exit(1)


  # 3. 将排序后的单词列表写入文件
  try:
    OUTPUT_PATH.write_text('\n'.join(sorted_words), encoding='utf-8')
    print(f"✅ 成功！已将排序后的 {len(sorted_words)} 个单词写入到 '{OUTPUT_PATH}'。")
  except IOError as e:
    print(f"错误: 写入文件 '{OUTPUT_PATH}' 失败: {e}", file=sys.stderr)
    sys.exit(1)

if __name__ == '__main__':
  main()