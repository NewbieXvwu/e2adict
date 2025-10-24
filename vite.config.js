// vite.config.js

import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    // ... 这里可能还有你其他的 vite 插件
    
    // 添加 static copy 插件的配置
    viteStaticCopy({
      targets: [
        {
          src: 'dictionary', // 源文件或文件夹，相对于项目根目录
          dest: '.'           // 目标目录，相对于输出目录 (dist) 的根目录
        }
      ]
    })
  ],
});