// vite.config.js

import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { VitePWA } from 'vite-plugin-pwa'; // 1. 引入 PWA 插件

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'dictionary',
          dest: '.'
        }
      ]
    }),
    
    // 2. 添加 PWA 插件的配置
    VitePWA({
      // registerType: 'autoUpdate' 表示 Service Worker 会自动更新，无需用户手动刷新
      registerType: 'autoUpdate',
      
      // devOptions 确保在开发环境 (pnpm dev) 中也能测试 PWA 功能
      devOptions: {
        enabled: true
      },
      
      // `workbox` 配置，决定了哪些文件会被缓存
      workbox: {
        // globPatterns 匹配所有需要被预缓存的文件
        // 我们要确保所有的 dictionary json 文件都被包含进去
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
      },

      // `manifest` 配置，用于生成 manifest.json 文件
      // 这个文件描述了你的应用信息，比如名称、图标、主题色等
      manifest: {
        name: 'Open E→C Dictionary',
        short_name: 'Open Dictionary',
        description: '一个开源、离线可用的英汉词典',
        start_url: '/',
        display: 'standalone',
        background_color: '#111315', // 和你的背景色一致
        theme_color: '#111315'      // 和你的背景色一致
      }
    })
  ],
});