import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: 'Unlock75',
        short_name: 'Unlock75',
        theme_color: '#e07b39',
        background_color: '#0d0d0d',
        display: 'standalone',
        icons: [
          {
            src: '/pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  build: {
    // rollupOptions remains the supported key; Vite 8 aliases it to rolldown.
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
    minify: 'esbuild',
  },
})
