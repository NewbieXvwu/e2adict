import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// --- 配置项 (从环境变量读取) ---
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
// --- 结束配置 ---

// 检查环境变量是否存在
if (!ACCOUNT_ID || !NAMESPACE_ID || !API_TOKEN) {
  console.error('错误：缺失必要的环境变量。请确保 CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID, 和 CLOUDFLARE_API_TOKEN 已设置。');
  process.exit(1); // 退出脚本
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(__dirname, '../dictionary');
const API_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/bulk`;

async function uploadToKV() {
  console.log(`正在从 ${sourceDir} 读取本地词典文件...`);
  if (!fs.existsSync(sourceDir)) {
      console.error(`错误：词典目录不存在于 ${sourceDir}`);
      process.exit(1);
  }

  const files = await fs.readdir(sourceDir);
  const kvPairs = [];

  for (const file of files) {
    if (path.extname(file).toLowerCase() === '.json') {
      // 解决 Windows 保留字问题，例如 'aux.json'
      const word = path.basename(file, '.json');
      try {
        const content = await fs.readJson(path.join(sourceDir, file));
        kvPairs.push({
          key: word.toLowerCase(),
          value: JSON.stringify(content),
        });
      } catch(e) {
        console.warn(`读取或解析文件 ${file} 失败，已跳过。错误:`, e.message);
      }
    }
  }

  if (kvPairs.length === 0) {
    console.warn("警告：没有找到任何 .json 文件来上传。");
    return;
  }

  console.log(`总共找到 ${kvPairs.length} 个词条，准备上传...`);
  
  const chunkSize = 10000; 
  for (let i = 0; i < kvPairs.length; i += chunkSize) {
    const chunk = kvPairs.slice(i, i + chunkSize);
    console.log(`正在上传第 ${i + 1} 到 ${i + chunk.length} 个词条...`);
    
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        console.error('上传失败:', JSON.stringify(result.errors || { message: '未知错误' }, null, 2));
        process.exit(1); // 上传失败时中断
      }
      console.log('本批次上传成功！');

    } catch (error) {
      console.error('发生网络错误:', error);
      process.exit(1);
    }
  }

  console.log('所有词典数据已成功上传到 Cloudflare KV！');
}

uploadToKV();
