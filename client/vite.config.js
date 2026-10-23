import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Чтение Евангелий',
        short_name: 'Евангелия',
        description: 'Совместное чтение Евангелий до Рождества',
        lang: 'ru',
        start_url: '/',
        display: 'standalone',
        background_color: '#f6f7f9',
        theme_color: '#2f5d8a',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Текст Библии доступен офлайн: кэшируем ответы эндпоинтов чтения.
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) => request.cache !== 'no-store' && /^\/api\/reading\/[^/]+\/[^/]+$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'bible-text',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname === '/api/plans',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'plans' },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
