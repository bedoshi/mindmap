import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    // レンダラー側のテストは DOM が必要なので jsdom を既定にする。
    // Node 専用のテスト（electron/）はファイル先頭の `// @vitest-environment node` で切り替える。
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    restoreMocks: true,
    include: ['src/**/*.test.{ts,tsx}', 'electron/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'electron/**/*.ts'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'electron/**/*.test.ts',
        'src/test/**',
        'src/**/*.d.ts',
        'src/main.tsx',
        'electron/main.ts',
        'electron/preload.ts',
        'electron/menu.ts',
      ],
    },
  },
})
