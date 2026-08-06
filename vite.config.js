import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['ios >= 13', 'safari >= 13'],
      modernPolyfills: true,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      useCredentials: true,
      includeAssets: ['logo.png'],
      manifest: {
        name: 'Girth Tracker',
        short_name: 'GirthTracker',
        description: 'Offline-first Rubber Tree Girth Tracker',
        id: '/',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        start_url: '/',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: 'screenshot.png',
            sizes: '1080x1920',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'GirthTracker - Rubber Tree Girth Measurement'
          }
        ]
      },
      devOptions: {
        enabled: false
      },
      workbox: {
        globIgnores: ['**/*-legacy-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.*-legacy-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'legacy-bundle-cache',
              expiration: { maxEntries: 4 }
            }
          },
          {
            urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'osm-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 7 * 24 * 60 * 60
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'esri-satellite-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 7 * 24 * 60 * 60
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
})
