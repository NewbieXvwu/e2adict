// vite.config.js

import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  publicDir: 'public',
  build: {
    target: 'es2020',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'suggestion-engine': ['./src/modules/suggestionEngine.js'],
          'ui-utils': [
            './src/modules/ui.js',
            './src/modules/form-mappings.js',
            './src/modules/audio.js',
            './src/modules/utils.js'
          ],
        },
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,bin}'],
      },

      runtimeCaching: [
        // 规则 1: 缓存来自 Cloudflare KV 的单词释义 (同源 API)
        {
          urlPattern: new RegExp('^/api/dict/'),
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'definitions-cache',
            expiration: {
              maxEntries: 1000,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 7 天
            },
            cacheableResponse: {
              statuses: [200],
            },
          },
        },

        // 规则 2: 缓存来自对象存储的单词释义 (跨域 API)
        {
          urlPattern: new RegExp('^https?://objectstorageapi\\.eu-central-1\\.clawcloudrun\\.com/puhyby1u-e2cdict/'),
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'definitions-cache',
            expiration: {
              maxEntries: 1000,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 7 天
            },
            cacheableResponse: {
              statuses: [200],
            },
          },
        },

        // 规则 3: 永久缓存来自 dictionaryapi.dev 的音标和音频
        {
          urlPattern: /^https?:\/\/api\.dictionaryapi\.dev\/.*/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'dictionary-api-cache',
            expiration: {
              maxEntries: 500,
              maxAgeSeconds: 90 * 24 * 60 * 60, // 90 天
            },
            cacheableResponse: {
              statuses: [200],
            },
          },
        },

        // 规则 4: 缓存 Trie 数据文件
        {
          urlPattern: /\/trie\.bin$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'trie-data-cache',
            expiration: {
              maxEntries: 1,
            },
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
