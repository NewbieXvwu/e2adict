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
        {
          // 匹配来自 api.dictionaryapi.dev 的所有请求（包括 API 和 音频）
          urlPattern: /^https?:\/\/api\.dictionaryapi\.dev\/.*/,
          // 优先从缓存读取，如果缓存中没有，则请求网络并存入缓存
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