import { createLocalStorageStorage } from './localStorageStorage'
import type { MapStorage } from './types'

export type { MapStorage, MapSummary } from './types'

/** 実行環境に応じた保存先を返す。現在は localStorage のみ */
export function createStorage(): MapStorage {
  return createLocalStorageStorage()
}
