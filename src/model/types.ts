export type NodeId = string

/** ルート直下のノードがルートのどちら側に配置されるか */
export type Side = 'left' | 'right'

export interface MindMapNode {
  id: NodeId
  text: string
  /** ルートノード（メインのルートとフローティングノード）のみ null */
  parentId: NodeId | null
  /** 子ノードのID（表示順） */
  children: NodeId[]
  /** true のとき子孫を折りたたんで非表示にする */
  collapsed: boolean
  /** ルート直下のノードにのみ意味を持つ。省略時は right */
  side?: Side
  /**
   * ルートノード（parentId が null）のみ意味を持つ、ノード中心のマップ座標。省略時は 0。
   * 子孫ノードの位置は自動レイアウトで決まるため持たない。
   */
  x?: number
  y?: number
}

export interface MindMap {
  /** メインのルート（中心トピック）。マップのタイトルはこのノードのテキスト */
  rootId: NodeId
  /** フローティングノード（メインのツリーとは独立した別のツリーの根）。作成順 */
  floatingRootIds: NodeId[]
  nodes: Record<NodeId, MindMapNode>
}
