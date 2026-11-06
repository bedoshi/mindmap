import type { MindMap } from '../model/types'

export interface MapSummary {
  id: string
  title: string
  /** 最終更新日時（epoch ミリ秒） */
  updatedAt: number
}

/**
 * マップの保存先を抽象化するインターフェース。
 * Web 版は localStorage、Electron 版はユーザーデータディレクトリ内の XML ファイルに保存する。
 */
export interface MapStorage {
  readonly kind: 'localStorage' | 'file'
  /** 保存先の説明（UI 表示用）。Electron ではディレクトリの絶対パス */
  describeLocation(): Promise<string>
  list(): Promise<MapSummary[]>
  /** 存在しない場合は null */
  load(id: string): Promise<MindMap | null>
  save(id: string, map: MindMap): Promise<void>
  remove(id: string): Promise<void>
}
