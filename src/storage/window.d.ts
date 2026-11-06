import type { MindmapApi } from './electronApi'

declare global {
  interface Window {
    /** Electron 上で動作しているときだけ preload によって定義される */
    mindmapApi?: MindmapApi
  }
}

export {}
