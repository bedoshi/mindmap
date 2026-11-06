/**
 * Electron の preload がレンダラーに公開する API の型と IPC チャンネル名。
 * レンダラー（src/）と Electron 側（electron/）の両方から参照するため、DOM や Node に依存する型は使わない。
 */

export const IPC_CHANNELS = {
  listMaps: 'maps:list',
  readMap: 'maps:read',
  writeMap: 'maps:write',
  deleteMap: 'maps:delete',
  getDataDir: 'maps:dataDir',
} as const

export interface MapFileInfo {
  /** ファイル名から拡張子を除いたもの（= マップID） */
  id: string
  /** 最終更新日時（epoch ミリ秒） */
  updatedAt: number
}

export interface MindmapApi {
  listMaps(): Promise<MapFileInfo[]>
  /** 存在しない場合は null */
  readMap(id: string): Promise<string | null>
  writeMap(id: string, xml: string): Promise<void>
  deleteMap(id: string): Promise<void>
  /** マップファイルを保存しているディレクトリの絶対パス */
  getDataDir(): Promise<string>
}
