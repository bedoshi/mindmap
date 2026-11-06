import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import path from 'node:path'
import type { Plugin } from 'vite'

/** 本番ビルドの index.html に Content-Security-Policy を埋め込む（開発時は HMR のため付けない） */
function cspPlugin(): Plugin {
  return {
    name: 'mindmap:csp',
    apply: 'build',
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content:
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:",
            },
            injectTo: 'head-prepend',
          },
        ],
      }
    },
  }
}

// Web 版（vite.config.ts）と同じ index.html / src を共有し、Electron 向けには out/ 配下へ出力する
export default defineConfig({
  main: {
    build: {
      lib: { entry: { index: 'electron/main.ts' } },
    },
  },
  preload: {
    build: {
      lib: { entry: { index: 'electron/preload.ts' } },
    },
  },
  renderer: {
    // 既定の src/renderer ではなくプロジェクト直下の index.html を使う
    root: '.',
    build: {
      rolldownOptions: { input: path.resolve(import.meta.dirname, 'index.html') },
    },
    plugins: [react(), cspPlugin()],
  },
})
