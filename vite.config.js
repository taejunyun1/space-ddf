import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const imageExtensions = new Set(['.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.webp'])

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name].[hash].js',
        chunkFileNames: 'js/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const extension = path.extname(assetInfo.names?.[0] || assetInfo.name || '').toLowerCase()

          if (extension === '.css') return 'css/[name].[hash][extname]'
          if (imageExtensions.has(extension)) return 'img/[name].[hash][extname]'

          return 'assets/[name].[hash][extname]'
        },
      },
    },
  },
})
