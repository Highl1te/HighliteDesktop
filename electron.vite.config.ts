import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: process.env.NODE_ENV === 'production' ? 'terser' : false
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: process.env.NODE_ENV === 'production' ? 'terser' : false
    }
  },
  renderer: {
    build: {
      minify: process.env.NODE_ENV === 'production' ? 'terser' : false,
      rollupOptions: {
        input: {
          client: resolve(__dirname, 'src/renderer/client/client.html'),
          update: resolve(__dirname, 'src/renderer/updater/update.html')
        },
        output: {
          manualChunks: {
            'babylon': ['@babylonjs/core'],
            'database': ['idb']
          }
        }
      },
      chunkSizeWarningLimit: 1000,
      reportCompressedSize: false
    },
    optimizeDeps: {
      include: ['@babylonjs/core', 'idb']
    }
  }
})
