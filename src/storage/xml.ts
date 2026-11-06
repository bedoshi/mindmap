import { newId } from '../model/mindmap'
import type { MindMap, MindMapNode, NodeId } from '../model/types'

/**
 * マインドマップと XML の相互変換。
 *
 * <?xml version="1.0" encoding="UTF-8"?>
 * <mindmap version="1">
 *   <node id="…" text="中心トピック">
 *     <node id="…" text="子" side="right" collapsed="true">
 *       <node id="…" text="孫"/>
 *     </node>
 *   </node>
 * </mindmap>
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

export function mindMapToXml(map: MindMap): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<mindmap version="${XML_FORMAT_VERSION}">`,
  ]
  const write = (id: NodeId, depth: number) => {
    const node = map.nodes[id]
    if (!node) return
    const indent = '  '.repeat(depth)
    const attrs = [`id="${escapeAttribute(node.id)}"`, `text="${escapeAttribute(node.text)}"`]
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
  write(map.rootId, 1)
  lines.push('</mindmap>', '')
  return lines.join('\n')
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
  const rootElement = childNodeElements(documentElement)[0]
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
    nodes[id] = node
    for (const child of childNodeElements(element)) {
      node.children.push(visit(child, id, parentId === null))
    }
    return id
  }
  const rootId = visit(rootElement, null, false)
  return { rootId, nodes }
}

/** 一覧表示などに使うマップのタイトル（ルートノードのテキスト） */
export function titleOf(map: MindMap): string {
  return map.nodes[map.rootId]?.text.trim() || '無題のマップ'
}
