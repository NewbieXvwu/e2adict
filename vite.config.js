// vite.config.js

import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { VitePWA } from 'vite-plugin-pwa'; // 1. 引入 PWA 插件

export default defineConfig({
  publicDir: 'public', 
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
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      // `workbox` 配置，决定了哪些文件会被预缓存
      workbox: {
        // globPatterns 保持不变，它负责在安装时缓存应用外壳和所有词典数据
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
      },

      // [新增] `runtimeCaching` 配置，为动态请求制定缓存策略
      runtimeCaching: [
        {
          // 匹配所有对 dictionary 文件夹下 json 文件的请求
          urlPattern: /^https:\/\/.*\/dictionary\/.*\.json$/,
          
          // 使用 CacheFirst 策略：优先从缓存中读取。如果缓存中没有，再去网络请求，
          // 请求成功后放入缓存，供下次使用。
          handler: 'CacheFirst',
          
          options: {
            // 设置这个缓存的名称
            cacheName: 'dictionary-cache',
            
            // 配置插件
            plugins: [
              {
                // 这个插件是关键：它告诉 Workbox 只缓存那些成功的请求 (status code 200)
                // 任何 404 或其他错误请求都不会被缓存，也不会再抛出未捕获的异常
                cacheableResponse: {
                  statuses: [200]
                }
              },
              {
                // 设置缓存条目的最大数量和过期时间
                expiration: {
                  maxEntries: 50000, // 缓存最多 50000 个词条
                  maxAgeSeconds: 30 * 24 * 60 * 60 // 缓存 30 天
                }
              }
            ]
          }
        }
      ],

      // `manifest` 配置，用于生成 manifest.json 文件
      // 这个文件描述了你的应用信息，比如名称、图标、主题色等
      manifest: {
        name: 'Open E→C Dictionary',
        short_name: 'E→C Dict',
        description: '一个开源、离线可用的英汉词典',
        start_url: '/',
        display: 'standalone',
        background_color: '#111315', // 和你的背景色一致
        theme_color: '#111315',      // 和你的背景色一致
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // "maskable" 图标能更好地适应不同形状的图标蒙版
          }
        ]
      }
    })
  ],
});