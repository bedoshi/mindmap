import { computeLayout } from '../model/layout'
import { allRootIds, newId } from '../model/mindmap'
import type { MindMap, MindMapNode, NodeId } from '../model/types'

/**
 * マインドマップと XML の相互変換。
 *
 * <?xml version="1.0" encoding="UTF-8"?>
 * <mindmap version="1">
 *   <node id="…" text="中心トピック" x="0" y="0">
 *     <node id="…" text="子" x="150" y="-20" side="right" collapsed="true">
 *       <node id="…" text="孫" x="300" y="-20"/>
 *     </node>
 *   </node>
 *   <node id="…" text="フローティングノード" x="400" y="300"/>
 * </mindmap>
 *
 * mindmap 直下の最初の node がメインのルート、2 つ目以降がフローティングノード（別ツリーの根）。
 * x / y はノード中心のマップ座標。ルート（直下の node）のものだけが位置として読み込まれ、
 * それ以外は自動レイアウトの結果を参考情報として書き出している（折りたたみで非表示のノードには付かない）。
 */

export const XML_FORMAT_VERSION = 1
export const XML_FILE_EXTENSION = '.xml'

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\n', '&#10;')
    .replaceAll('\r', '&#13;')
    .replaceAll('\t', '&#9;')
}

function formatCoordinate(value: number): string {
  return String(Math.round(value * 10) / 10)
}

export function mindMapToXml(map: MindMap): string {
  const layout = computeLayout(map)
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<mindmap version="${XML_FORMAT_VERSION}">`,
  ]
  const write = (id: NodeId, depth: number) => {
    const node = map.nodes[id]
    if (!node) return
    const indent = '  '.repeat(depth)
    const attrs = [`id="${escapeAttribute(node.id)}"`, `text="${escapeAttribute(node.text)}"`]
    const nodeLayout = layout.nodes[id]
    if (nodeLayout) {
      attrs.push(
        `x="${formatCoordinate(nodeLayout.x + nodeLayout.width / 2)}"`,
        `y="${formatCoordinate(nodeLayout.y + nodeLayout.height / 2)}"`,
      )
    }
    if (node.side) attrs.push(`side="${node.side}"`)
    if (node.collapsed) attrs.push('collapsed="true"')
    const children = node.children.filter((c) => map.nodes[c])
    if (children.length === 0) {
      lines.push(`${indent}<node ${attrs.join(' ')}/>`)
      return
    }
    lines.push(`${indent}<node ${attrs.join(' ')}>`)
    for (const childId of children) write(childId, depth + 1)
    lines.push(`${indent}</node>`)
  }
  for (const rootId of allRootIds(map)) write(rootId, 1)
  lines.push('</mindmap>', '')
  return lines.join('\n')
}

function parseCoordinate(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function childNodeElements(element: Element): Element[] {
  return Array.from(element.children).filter((child) => child.tagName === 'node')
}

export function xmlToMindMap(xml: string): MindMap {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('XML の解析に失敗しました')
  const documentElement = doc.documentElement
  if (documentElement.tagName !== 'mindmap') {
    throw new Error('マインドマップの XML ではありません（ルート要素が mindmap ではありません）')
  }
  const [rootElement, ...floatingElements] = childNodeElements(documentElement)
  if (!rootElement) throw new Error('ルートノードが見つかりません')

  const nodes: Record<NodeId, MindMapNode> = {}
  const visit = (element: Element, parentId: NodeId | null, isRootChild: boolean): NodeId => {
    let id = element.getAttribute('id') ?? ''
    // ID が無い・重複している場合は振り直す（手編集されたファイルへの耐性）
    if (!id || nodes[id]) id = newId()
    const node: MindMapNode = {
      id,
      text: element.getAttribute('text') ?? '',
      parentId,
      children: [],
      collapsed: element.getAttribute('collapsed') === 'true',
    }
    const side = element.getAttribute('side')
    if (isRootChild && (side === 'left' || side === 'right')) node.side = side
    if (parentId === null) {
      // ルートの位置のみ読み込む。子孫の x / y は自動レイアウトで決まるので無視する
      const x = parseCoordinate(element.getAttribute('x'))
      const y = parseCoordinate(element.getAttribute('y'))
      if (x) node.x = x // 0（省略時と同じ）は持たない
      if (y) node.y = y
    }
    nodes[id] = node
    for (const child of childNodeElements(element)) {
      node.children.push(visit(child, id, parentId === null))
    }
    return id
  }
  const rootId = visit(rootElement, null, false)
  const floatingRootIds = floatingElements.map((element) => visit(element, null, false))
  return { rootId, floatingRootIds, nodes }
}

/** 一覧表示などに使うマップのタイトル（ルートノードのテキスト） */
export function titleOf(map: MindMap): string {
  return map.nodes[map.rootId]?.text.trim() || '無題のマップ'
}
