import { createElectronStorage } from './electronStorage'
import { createLocalStorageStorage } from './localStorageStorage'
import type { MapStorage } from './types'

export type { MapStorage, MapSummary } from './types'

/** 実行環境に応じた保存先を返す。Electron 上では preload が window.mindmapApi を定義している */
export function createStorage(): MapStorage {
  if (window.mindmapApi) return createElectronStorage(window.mindmapApi)
  return createLocalStorageStorage()
}
