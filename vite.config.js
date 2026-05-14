import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
