import { allRootIds, visibleChildren } from './mindmap'
import type { MindMap, NodeId, Side } from './types'

/**
 * マインドマップの自動レイアウト。
 * 各ツリー（メインのルートとフローティングノード）ごとに、ルートを中心に置き、
 * ルート直下のノードを左右に振り分け、各部分木を縦に積み上げて配置する（MindMeister 風のバランスレイアウト）。
 * ルートの中心位置は `MindMapNode.x / y`（省略時は原点 (0,0)）で、ルート以外のノードは手動配置しない。
 */

export const NODE_FONT =
  '14px system-ui, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", sans-serif'
export const ROOT_FONT =
  'bold 17px system-ui, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", sans-serif'

const H_PAD = 14
const NODE_HEIGHT = 34
const ROOT_HEIGHT = 46
const MIN_WIDTH = 60
/** 親子間の水平距離 */
const H_GAP = 56
/** 兄弟間の垂直距離 */
const V_GAP = 14

export const BRANCH_COLORS = [
  '#e05d5d',
  '#f08c2e',
  '#c9a200',
  '#3fa34d',
  '#2a9d8f',
  '#3b82f6',
  '#7c5cdb',
  '#d946a8',
]
export const ROOT_COLOR = '#2d3748'

export type LayoutSide = Side | 'center'

export interface NodeLayout {
  id: NodeId
  x: number
  y: number
  width: number
  height: number
  side: LayoutSide
  color: string
  depth: number
  font: string
}

export interface EdgeLayout {
  id: string
  from: NodeId
  to: NodeId
  path: string
  color: string
  depth: number
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Layout {
  nodes: Record<NodeId, NodeLayout>
  edges: EdgeLayout[]
  bounds: Bounds
}

let measureContext: CanvasRenderingContext2D | null | undefined

function measureTextWidth(text: string, font: string): number {
  if (measureContext === undefined) {
    measureContext =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  }
  if (!measureContext) return text.length * 9
  measureContext.font = font
  return measureContext.measureText(text).width
}

interface NodeSize {
  width: number
  height: number
  font: string
}

export function measureNode(text: string, isRoot: boolean): NodeSize {
  const font = isRoot ? ROOT_FONT : NODE_FONT
  // 丸め誤差で末尾が欠けないよう少し余裕を持たせる
  const textWidth = Math.ceil(measureTextWidth(text, font)) + 2
  return {
    width: Math.max(MIN_WIDTH, textWidth + H_PAD * 2),
    height: isRoot ? ROOT_HEIGHT : NODE_HEIGHT,
    font,
  }
}

function edgePath(parent: NodeLayout, child: NodeLayout, side: Side): string {
  const sx = side === 'right' ? parent.x + parent.width : parent.x
  const sy = parent.y + parent.height / 2
  const ex = side === 'right' ? child.x : child.x + child.width
  const ey = child.y + child.height / 2
  const mx = (sx + ex) / 2
  return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`
}

export function computeLayout(map: MindMap): Layout {
  const sizes: Record<NodeId, NodeSize> = {}
  const subtreeHeights: Record<NodeId, number> = {}

  const prepare = (id: NodeId, isRoot: boolean): number => {
    const node = map.nodes[id]
    const size = measureNode(node.text, isRoot)
    sizes[id] = size
    let total = 0
    visibleChildren(map, id).forEach((childId, i) => {
      total += prepare(childId, false)
      if (i > 0) total += V_GAP
    })
    subtreeHeights[id] = Math.max(size.height, total)
    return subtreeHeights[id]
  }
  const rootIds = allRootIds(map).filter((id) => map.nodes[id])
  for (const rootId of rootIds) prepare(rootId, true)

  const nodes: Record<NodeId, NodeLayout> = {}

  const stackHeight = (ids: NodeId[]): number =>
    ids.reduce((sum, id, i) => sum + subtreeHeights[id] + (i > 0 ? V_GAP : 0), 0)

  /**
   * @param innerX 親側に接する辺の x 座標（right 側なら左辺、left 側なら右辺）
   * @param centerY ノード中心の y 座標
   */
  const place = (
    id: NodeId,
    side: Side,
    innerX: number,
    centerY: number,
    color: string,
    depth: number,
  ) => {
    const size = sizes[id]
    const x = side === 'right' ? innerX : innerX - size.width
    nodes[id] = {
      id,
      x,
      y: centerY - size.height / 2,
      width: size.width,
      height: size.height,
      side,
      color,
      depth,
      font: size.font,
    }
    const children = visibleChildren(map, id)
    let y = centerY - stackHeight(children) / 2
    const childInnerX = side === 'right' ? x + size.width + H_GAP : x - H_GAP
    for (const childId of children) {
      place(childId, side, childInnerX, y + subtreeHeights[childId] / 2, color, depth + 1)
      y += subtreeHeights[childId] + V_GAP
    }
  }

  for (const rootId of rootIds) {
    const root = map.nodes[rootId]
    const rootSize = sizes[rootId]
    const centerX = root.x ?? 0
    const centerY = root.y ?? 0
    nodes[rootId] = {
      id: rootId,
      x: centerX - rootSize.width / 2,
      y: centerY - rootSize.height / 2,
      width: rootSize.width,
      height: rootSize.height,
      side: 'center',
      color: ROOT_COLOR,
      depth: 0,
      font: rootSize.font,
    }

    const rootChildren = visibleChildren(map, rootId)
    const groups: Record<Side, NodeId[]> = { right: [], left: [] }
    for (const childId of rootChildren) groups[map.nodes[childId].side ?? 'right'].push(childId)

    for (const side of ['right', 'left'] as const) {
      const ids = groups[side]
      let y = centerY - stackHeight(ids) / 2
      const innerX =
        side === 'right' ? centerX + rootSize.width / 2 + H_GAP : centerX - rootSize.width / 2 - H_GAP
      for (const childId of ids) {
        const color = BRANCH_COLORS[rootChildren.indexOf(childId) % BRANCH_COLORS.length]
        place(childId, side, innerX, y + subtreeHeights[childId] / 2, color, 1)
        y += subtreeHeights[childId] + V_GAP
      }
    }
  }

  const edges: EdgeLayout[] = []
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const layout of Object.values(nodes)) {
    bounds.minX = Math.min(bounds.minX, layout.x)
    bounds.minY = Math.min(bounds.minY, layout.y)
    bounds.maxX = Math.max(bounds.maxX, layout.x + layout.width)
    bounds.maxY = Math.max(bounds.maxY, layout.y + layout.height)
    const parentId = map.nodes[layout.id].parentId
    if (parentId === null || layout.side === 'center') continue
    const parent = nodes[parentId]
    edges.push({
      id: `${parentId}->${layout.id}`,
      from: parentId,
      to: layout.id,
      path: edgePath(parent, layout, layout.side),
      color: layout.color,
      depth: layout.depth,
    })
  }

  return { nodes, edges, bounds }
}
