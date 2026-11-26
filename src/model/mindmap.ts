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
 * id を newParentId の子に付け替える（同じ親の中での並べ替えも含む）。
 * index は id を取り除いたあとの兄弟の並びでの挿入位置で、省略時は末尾に追加する。
 * side は newParentId がルートのときの配置側。省略時は、同じルートの中の移動なら今の側のまま、
 * 別の親からの移動ならノード数の少ない側にする。
 * ルートの移動や、自分自身・自分の子孫への移動、位置も側も変わらない移動は無視する（同じ参照を返す）。
 */
export function moveNode(
  map: MindMap,
  id: NodeId,
  newParentId: NodeId,
  index?: number,
  side?: Side,
): MindMap {
  const node = map.nodes[id]
  const newParent = map.nodes[newParentId]
  if (!node || !newParent || node.parentId === null) return map
  if (isDescendant(map, id, newParentId)) return map
  const toRoot = newParent.parentId === null
  const sameParent = node.parentId === newParentId

  if (sameParent) {
    const currentIndex = newParent.children.indexOf(id)
    const lastIndex = newParent.children.length - 1
    const insertAt = index === undefined ? lastIndex : Math.max(0, Math.min(index, lastIndex))
    const sameSide = !toRoot || side === undefined || (node.side ?? 'right') === side
    if (insertAt === currentIndex && sameSide) return map
  }

  const nodes = { ...map.nodes }
  const oldParent = nodes[node.parentId]
  nodes[oldParent.id] = { ...oldParent, children: oldParent.children.filter((c) => c !== id) }

  const target = nodes[newParentId]
  const children = [...target.children]
  const insertAt = index === undefined ? children.length : Math.max(0, Math.min(index, children.length))
  children.splice(insertAt, 0, id)
  nodes[newParentId] = { ...target, children, collapsed: false }

  const resolvedSide = !toRoot
    ? undefined
    : (side ?? (sameParent ? (node.side ?? 'right') : pickSide({ ...map, nodes }, newParentId)))
  nodes[id] = withSide({ ...node, parentId: newParentId }, resolvedSide)
  return { ...map, nodes }
}

/** ドロップ先のノードに対してどこへ置くか（前の兄弟 / 後ろの兄弟 / 子） */
export type DropPosition = 'before' | 'after' | 'child'

/**
 * id を targetId の前・後ろ（兄弟として）または子に移動する。
 * 兄弟として置く場合、ドロップ先がルートの直下なら、ドロップ先と同じ側に置く（左右の移動）。
 * 子として置く場合の side は、ドロップ先がルートのときの配置側（省略時は moveNode と同じ）。
 * ドロップ先がルートのときは常に子として置く。移動できない・変化が無い場合は同じ参照を返す
 */
export function moveNodeTo(
  map: MindMap,
  id: NodeId,
  targetId: NodeId,
  position: DropPosition,
  side?: Side,
): MindMap {
  const target = map.nodes[targetId]
  if (!target || !map.nodes[id] || id === targetId) return map
  if (position === 'child' || target.parentId === null) {
    return moveNode(map, id, targetId, undefined, side)
  }
  const parent = map.nodes[target.parentId]
  const siblings = parent.children.filter((c) => c !== id)
  const index = siblings.indexOf(targetId) + (position === 'after' ? 1 : 0)
  const targetSide = parent.parentId === null ? (target.side ?? 'right') : undefined
  return moveNode(map, id, parent.id, index, targetSide)
}

// ---- テーブルノード ----

/** 新しく追加するテーブルの既定の大きさ */
export const DEFAULT_TABLE_ROWS = 2
export const DEFAULT_TABLE_COLUMNS = 2

export function createTable(rows = DEFAULT_TABLE_ROWS, columns = DEFAULT_TABLE_COLUMNS): string[][] {
  return Array.from({ length: Math.max(1, rows) }, () =>
    Array.from({ length: Math.max(1, columns) }, () => ''),
  )
}

export function isTableNode(node: MindMapNode | undefined): boolean {
  return node?.table !== undefined
}

/** parentId の末尾に、空のテーブルを持つ子ノード（テーブルノード）を追加する */
export function addTableChild(
  map: MindMap,
  parentId: NodeId,
  id: NodeId,
  table: string[][] = createTable(),
): MindMap {
  const added = addChild(map, parentId, id, '')
  if (added === map) return map
  return { ...added, nodes: { ...added.nodes, [id]: { ...added.nodes[id], table } } }
}

/** (x, y) を中心とする位置に、空のテーブルを持つフローティングノードを追加する */
export function addFloatingTable(
  map: MindMap,
  id: NodeId,
  x: number,
  y: number,
  table: string[][] = createTable(),
): MindMap {
  const added = addFloatingRoot(map, id, x, y, '')
  if (added === map) return map
  return { ...added, nodes: { ...added.nodes, [id]: { ...added.nodes[id], table } } }
}

function withTable(map: MindMap, id: NodeId, table: string[][]): MindMap {
  return { ...map, nodes: { ...map.nodes, [id]: { ...map.nodes[id], table } } }
}

export function updateTableCell(
  map: MindMap,
  id: NodeId,
  row: number,
  column: number,
  text: string,
): MindMap {
  const table = map.nodes[id]?.table
  if (!table || table[row]?.[column] === undefined || table[row][column] === text) return map
  return withTable(
    map,
    id,
    table.map((cells, r) => (r === row ? cells.map((c, col) => (col === column ? text : c)) : cells)),
  )
}

/** index の位置（0 〜 行数）に空の行を挿入する */
export function insertTableRow(map: MindMap, id: NodeId, index: number): MindMap {
  const table = map.nodes[id]?.table
  if (!table || index < 0 || index > table.length) return map
  const rows = [...table]
  rows.splice(index, 0, table[0].map(() => ''))
  return withTable(map, id, rows)
}

/** index の行を削除する。最後の 1 行は削除できない */
export function removeTableRow(map: MindMap, id: NodeId, index: number): MindMap {
  const table = map.nodes[id]?.table
  if (!table || table.length <= 1 || index < 0 || index >= table.length) return map
  return withTable(
    map,
    id,
    table.filter((_, r) => r !== index),
  )
}

/** index の位置（0 〜 列数）に空の列を挿入する */
export function insertTableColumn(map: MindMap, id: NodeId, index: number): MindMap {
  const table = map.nodes[id]?.table
  if (!table || index < 0 || index > table[0].length) return map
  return withTable(
    map,
    id,
    table.map((cells) => {
      const next = [...cells]
      next.splice(index, 0, '')
      return next
    }),
  )
}

/** index の列を削除する。最後の 1 列は削除できない */
export function removeTableColumn(map: MindMap, id: NodeId, index: number): MindMap {
  const table = map.nodes[id]?.table
  if (!table || table[0].length <= 1 || index < 0 || index >= table[0].length) return map
  return withTable(
    map,
    id,
    table.map((cells) => cells.filter((_, c) => c !== index)),
  )
}

/**
 * id の祖先のうち折りたたまれているものをすべて展開し、id が表示されるようにする。
 * 展開する祖先が無ければ同じ参照を返す
 */
export function expandAncestors(map: MindMap, id: NodeId): MindMap {
  let nodes: Record<NodeId, MindMapNode> | null = null
  let current = map.nodes[id]?.parentId ?? null
  while (current !== null) {
    const ancestor = map.nodes[current]
    if (!ancestor) break
    if (ancestor.collapsed) {
      nodes ??= { ...map.nodes }
      nodes[current] = { ...ancestor, collapsed: false }
    }
    current = ancestor.parentId
  }
  return nodes ? { ...map, nodes } : map
}
