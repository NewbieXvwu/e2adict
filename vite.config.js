import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  publicDir: 'public',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },

      runtimeCaching: [
        // 缓存从 KV 获取的单词释义 (您自己的 API)
        {
          // 匹配所有以 /api/dict/ 开头的同源请求
          urlPattern: new RegExp('^/api/dict/'),
          // 使用 "Stale-While-Revalidate" 策略
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'kv-definitions-cache',
            expiration: {
              maxEntries: 1000, // 最多缓存 1000 个单词
              maxAgeSeconds: 30 * 24 * 60 * 60, // 缓存 30 天
            },
            // 只缓存成功的响应
            cacheableResponse: {
              statuses: [200],
            },
          },
        },

        // 永久缓存来自 dictionaryapi.dev 的音标和音频
        {
          urlPattern: /^https?:\/\/api\.dictionaryapi\.dev\/.*/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'dictionary-api-cache',
            cacheableResponse: {
              statuses: [200],
            },
          },
        },
      ],

      manifest: {
        name: 'Open E→C Dictionary',
        short_name: 'E→C Dict',
        description: '一个开源、离线可用的英汉词典',
        start_url: '/',
        display: 'standalone',
        background_color: '#111315',
        theme_color: '#111315',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
});
