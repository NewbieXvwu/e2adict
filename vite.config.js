// vite.config.js

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
          urlPattern: new RegExp('^/api/dict/'),
          handler: 'StaleWhileRevalidate',
          options: {
            // 统一缓存名称
            cacheName: 'definitions-cache',
            expiration: {
              maxEntries: 1000,
              maxAgeSeconds: 30 * 24 * 60 * 60, // 30 天
            },
            cacheableResponse: {
              statuses: [200],
            },
          },
        },

        {
          urlPattern: new RegExp('^https?://objectstorageapi\\.eu-central-1\\.clawcloudrun\\.com/puhyby1u-e2cdict/'),
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'definitions-cache',
            expiration: {
              maxEntries: 1000,
              maxAgeSeconds: 30 * 24 * 60 * 60, // 30 天
            },
            cacheableResponse: {
              statuses: [200],
            },
          },
        },

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
