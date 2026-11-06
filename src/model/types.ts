export type NodeId = string

/** ルート直下のノードがルートのどちら側に配置されるか */
export type Side = 'left' | 'right'

export interface MindMapNode {
  id: NodeId
  text: string
  /** ルートノードのみ null */
  parentId: NodeId | null
  /** 子ノードのID（表示順） */
  children: NodeId[]
  /** true のとき子孫を折りたたんで非表示にする */
  collapsed: boolean
  /** ルート直下のノードにのみ意味を持つ。省略時は right */
  side?: Side
}

export interface MindMap {
  rootId: NodeId
  nodes: Record<NodeId, MindMapNode>
}
