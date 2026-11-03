import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      // The app decides when to reload (never during a quiz), see src/update.ts.
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Pydra: Python Trainer',
        short_name: 'Pydra',
        description: 'Python-Grundlagen üben: Multiple-Choice-Fragen für Einsteiger.',
        lang: 'de',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        prefer_related_applications: false,
        background_color: '#0f1722',
        theme_color: '#0f1722',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything is precached (questions are bundled), so the app works fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
});
