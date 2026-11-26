import { allRootIds } from './mindmap'
import type { MindMap, NodeId } from './types'

/**
 * マップ内のテキスト検索。大文字・小文字は区別しない。
 * 検索結果はノード単位で、表示順（ルートごとに、メイン → フローティングの作成順、各ツリーは深さ優先・子の表示順）に並ぶ。
 * テーブルノードはいずれかのセルに一致すれば 1 件として数える。
 */

/** 検索語として扱うか（空白だけの検索語では検索しない） */
export function isSearchable(query: string): boolean {
  return query.trim() !== ''
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function queryPattern(query: string): RegExp {
  return new RegExp(escapeRegExp(query), 'giu')
}

/** テキストのうち検索語に一致する部分と、それ以外の部分に分けた断片 */
export interface TextSegment {
  text: string
  hit: boolean
}

/**
 * テキストを検索語に一致する部分とそれ以外に分ける（ハイライト表示用）。
 * 一致が無い・検索語が空のときは、テキスト全体を 1 つの断片として返す
 */
export function splitByQuery(text: string, query: string): TextSegment[] {
  if (!isSearchable(query) || text === '') return [{ text, hit: false }]
  const segments: TextSegment[] = []
  let last = 0
  for (const match of text.matchAll(queryPattern(query))) {
    const start = match.index
    if (start > last) segments.push({ text: text.slice(last, start), hit: false })
    segments.push({ text: match[0], hit: true })
    last = start + match[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last), hit: false })
  return segments.length > 0 ? segments : [{ text, hit: false }]
}

export function containsQuery(text: string, query: string): boolean {
  return isSearchable(query) && queryPattern(query).test(text)
}

/** ノードのテキスト（テーブルノードは各セル）が検索語を含むか */
function nodeMatches(map: MindMap, id: NodeId, query: string): boolean {
  const node = map.nodes[id]
  if (node.table) return node.table.some((cells) => cells.some((cell) => containsQuery(cell, query)))
  return containsQuery(node.text, query)
}

/**
 * 検索語に一致するノードの ID を表示順に返す。折りたたみで隠れているノードも対象にする
 */
export function findMatches(map: MindMap, query: string): NodeId[] {
  if (!isSearchable(query)) return []
  const result: NodeId[] = []
  const visit = (id: NodeId) => {
    const node = map.nodes[id]
    if (!node) return
    if (nodeMatches(map, id, query)) result.push(id)
    node.children.forEach(visit)
  }
  allRootIds(map).forEach(visit)
  return result
}
