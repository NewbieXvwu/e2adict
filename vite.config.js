import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  publicDir: 'public',
  plugins: [
    viteStaticCopy({
      targets: [{ src: 'dictionary', dest: '.' }]
    }),

    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },

      runtimeCaching: [
        {
          urlPattern: /^https?:\/.*\/dictionary\/.*\.json$/,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'dict-swr',
            plugins: [
              { cacheableResponse: { statuses: [200] } },
              { expiration: { maxEntries: 1000, maxAgeSeconds: 30 * 24 * 60 * 60 } }
            ]
          }
        }
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
