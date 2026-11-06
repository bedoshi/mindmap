import type { MindMap, MindMapNode, NodeId, Side } from './types'

/**
 * マインドマップのデータ構造に対する純粋関数群。
 * すべて元の MindMap を変更せず、新しい MindMap を返す（変更がない場合は同じ参照を返す）。
 */

export function newId(): NodeId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function createMindMap(rootText = '中心トピック'): MindMap {
  const rootId = newId()
  return {
    rootId,
    floatingRootIds: [],
    nodes: {
      [rootId]: { id: rootId, text: rootText, parentId: null, children: [], collapsed: false },
    },
  }
}

export function getNode(map: MindMap, id: NodeId): MindMapNode | undefined {
  return map.nodes[id]
}

/** 折りたたみを考慮した、表示される子ノードの一覧 */
export function visibleChildren(map: MindMap, id: NodeId): NodeId[] {
  const node = map.nodes[id]
  if (!node || node.collapsed) return []
  return node.children
}

/** id を根とする部分木（id 自身を含む）のノードIDを深さ優先で列挙する */
export function collectSubtree(map: MindMap, id: NodeId): NodeId[] {
  const result: NodeId[] = []
  const stack = [id]
  while (stack.length > 0) {
    const current = stack.pop()!
    const node = map.nodes[current]
    if (!node) continue
    result.push(current)
    for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i])
  }
  return result
}

/** id が ancestorId の部分木に含まれるか（id === ancestorId の場合も true） */
export function isDescendant(map: MindMap, ancestorId: NodeId, id: NodeId): boolean {
  let current: NodeId | null = id
  while (current !== null) {
    if (current === ancestorId) return true
    current = map.nodes[current]?.parentId ?? null
  }
  return false
}

export function countSubtree(map: MindMap, id: NodeId): number {
  return collectSubtree(map, id).length
}

/** メインのルートとフローティングノードをあわせた、すべてのツリーの根（メインが先頭） */
export function allRootIds(map: MindMap): NodeId[] {
  return [map.rootId, ...map.floatingRootIds]
}

/** ルート（メイン・フローティング）直下にノードを追加するとき、左右のバランスが取れる側を選ぶ */
function pickSide(map: MindMap, rootId: NodeId): Side {
  const root = map.nodes[rootId]
  let right = 0
  let left = 0
  for (const childId of root.children) {
    const size = countSubtree(map, childId)
    if ((map.nodes[childId].side ?? 'right') === 'left') left += size
    else right += size
  }
  return right <= left ? 'right' : 'left'
}

function withSide(node: MindMapNode, side: Side | undefined): MindMapNode {
  if (side === undefined) {
    if (node.side === undefined) return node
    const rest = { ...node }
    delete rest.side
    return rest
  }
  return { ...node, side }
}

export function addChild(map: MindMap, parentId: NodeId, id: NodeId, text = ''): MindMap {
  const parent = map.nodes[parentId]
  if (!parent || map.nodes[id]) return map
  const side = parent.parentId === null ? pickSide(map, parentId) : undefined
  const node = withSide({ id, text, parentId, children: [], collapsed: false }, side)
  return {
    ...map,
    nodes: {
      ...map.nodes,
      [id]: node,
      [parentId]: { ...parent, children: [...parent.children, id], collapsed: false },
    },
  }
}

/** nodeId の直後に兄弟ノードを追加する。nodeId がルートの場合は子として追加する */
export function addSibling(map: MindMap, nodeId: NodeId, id: NodeId, text = ''): MindMap {
  const node = map.nodes[nodeId]
  if (!node || map.nodes[id]) return map
  if (node.parentId === null) return addChild(map, nodeId, id, text)
  const parent = map.nodes[node.parentId]
  const index = parent.children.indexOf(nodeId)
  const children = [...parent.children]
  children.splice(index + 1, 0, id)
  const newNode = withSide({ id, text, parentId: parent.id, children: [], collapsed: false }, node.side)
  return {
    ...map,
    nodes: { ...map.nodes, [id]: newNode, [parent.id]: { ...parent, children } },
  }
}

export function updateText(map: MindMap, id: NodeId, text: string): MindMap {
  const node = map.nodes[id]
  if (!node || node.text === text) return map
  return { ...map, nodes: { ...map.nodes, [id]: { ...node, text } } }
}

/**
 * フローティングノードを (x, y) を中心とする位置に追加する。
 * 同じ id のノードが既にある場合は何もしない
 */
export function addFloatingRoot(map: MindMap, id: NodeId, x: number, y: number, text = ''): MindMap {
  if (map.nodes[id]) return map
  const node: MindMapNode = { id, text, parentId: null, children: [], collapsed: false, x, y }
  return {
    ...map,
    floatingRootIds: [...map.floatingRootIds, id],
    nodes: { ...map.nodes, [id]: node },
  }
}

/** ルート（メイン・フローティング）の中心座標を変更する。ルート以外や位置が同じ場合は何もしない */
export function moveRoot(map: MindMap, id: NodeId, x: number, y: number): MindMap {
  const node = map.nodes[id]
  if (!node || node.parentId !== null) return map
  if ((node.x ?? 0) === x && (node.y ?? 0) === y) return map
  return { ...map, nodes: { ...map.nodes, [id]: { ...node, x, y } } }
}

/** id とその子孫を削除する。メインのルートは削除できない（フローティングノードは削除できる） */
export function removeNode(map: MindMap, id: NodeId): MindMap {
  const node = map.nodes[id]
  if (!node || id === map.rootId) return map
  const nodes = { ...map.nodes }
  for (const subId of collectSubtree(map, id)) delete nodes[subId]
  if (node.parentId === null) {
    return { ...map, floatingRootIds: map.floatingRootIds.filter((f) => f !== id), nodes }
  }
  const parent = map.nodes[node.parentId]
  nodes[parent.id] = { ...parent, children: parent.children.filter((c) => c !== id) }
  return { ...map, nodes }
}

/**
 * id を削除した後に選択するノードを返す。
 * 直前（上）の兄弟 → 直後（下）の兄弟 → 親 の順に探す。ルートや存在しない id は null
 */
export function nodeToSelectAfterRemove(map: MindMap, id: NodeId): NodeId | null {
  const node = map.nodes[id]
  if (!node || node.parentId === null) return null
  const siblings = map.nodes[node.parentId].children
  const index = siblings.indexOf(id)
  return siblings[index - 1] ?? siblings[index + 1] ?? node.parentId
}

export function toggleCollapse(map: MindMap, id: NodeId): MindMap {
  const node = map.nodes[id]
  if (!node || node.children.length === 0) return map
  return { ...map, nodes: { ...map.nodes, [id]: { ...node, collapsed: !node.collapsed } } }
}

/**
 * id を newParentId の子に付け替える。index 省略時は末尾に追加する。
 * ルートの移動や、自分自身・自分の子孫への移動は無視する。
 */
export function moveNode(map: MindMap, id: NodeId, newParentId: NodeId, index?: number): MindMap {
  const node = map.nodes[id]
  const newParent = map.nodes[newParentId]
  if (!node || !newParent || node.parentId === null) return map
  if (isDescendant(map, id, newParentId)) return map

  const nodes = { ...map.nodes }
  const oldParent = nodes[node.parentId]
  nodes[oldParent.id] = { ...oldParent, children: oldParent.children.filter((c) => c !== id) }

  const target = nodes[newParentId]
  const children = [...target.children]
  const insertAt = index === undefined ? children.length : Math.max(0, Math.min(index, children.length))
  children.splice(insertAt, 0, id)
  nodes[newParentId] = { ...target, children, collapsed: false }

  const side = newParent.parentId === null ? pickSide({ ...map, nodes }, newParentId) : undefined
  nodes[id] = withSide({ ...node, parentId: newParentId }, side)
  return { ...map, nodes }
}
