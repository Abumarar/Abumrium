import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // Output to out/main/index.js (matches package.json "main" field)
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/main.ts'),
        },
        output: {
          entryFileNames: 'index.js',
        },
      },
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
        },
        output: {
          entryFileNames: 'index.js',
        },
      },
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    // CRITICAL: base must be './' so Vite generates relative asset paths.
    // Without this, Vite generates absolute paths like /assets/index.js which
    // fail when loaded via file:// protocol in Electron's loadFile().
    base: './',
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@renderer': resolve('src/renderer'),
      }
    },
    plugins: [react()]
  }
})
