import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

/**
 * Node 22 以降はグローバルに独自の localStorage を持ち（--localstorage-file 無しでは使えない）、
 * Vitest が jsdom の localStorage で上書きしないため、メモリ上の Storage に差し替える。
 */
function createMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, String(value))
    },
    removeItem: (key) => {
      data.delete(key)
    },
    clear: () => data.clear(),
  }
}

// `// @vitest-environment node` を指定した Node 専用テスト（electron/）では DOM 関連の準備を行わない
const hasDom = typeof document !== 'undefined'

if (hasDom && typeof globalThis.localStorage?.setItem !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
    writable: true,
  })
}

/**
 * jsdom に実装されていないブラウザ API を補う。
 * - Pointer Capture: MindMapEditor がキャンバスのドラッグ処理で使う
 * - Canvas 2D context: layout.ts がテキスト幅の計測に使う（null を返すとフォールバック計算になる）
 */
beforeEach(() => {
  if (!hasDom) return
  if (typeof Element.prototype.setPointerCapture !== 'function') {
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  // jsdom の getContext は「未実装」のエラーをコンソールに出すため、静かに null を返すよう差し替える
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null)
})

afterEach(() => {
  if (!hasDom) return
  cleanup()
  localStorage.clear()
})
