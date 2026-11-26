import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { splitLines, type NodeLayout } from '../model/layout'
import type { MindMapNode } from '../model/types'
import { HighlightedText } from './HighlightedText'
import { TableContent, type CellDraft } from './TableContent'

interface Props {
  node: MindMapNode
  layout: NodeLayout
  selected: boolean
  /** 編集中のときは入力中のテキスト、そうでなければ null */
  draft: string | null
  /** 編集開始時にテキスト全体を選択するか */
  selectAllOnFocus: boolean
  dragging: boolean
  dropTarget: boolean
  hiddenCount: number
  /** 検索中の検索語（一致部分をハイライトする）。検索していなければ null */
  searchQuery: string | null
  /** 表示中の検索結果のノードか */
  searchCurrent: boolean
  onDraftChange: (text: string) => void
  onCommit: () => void
  onCancel: () => void
  /** 編集中に Tab を押したとき（確定して子ノードを追加する） */
  onTabFromEdit: () => void
  onToggleCollapse: () => void
  /** テーブルノードで編集中のセル。編集していなければ null */
  cellEdit: CellDraft | null
  onCellDraftChange: (text: string) => void
  onCellCommit: (row: number, column: number) => void
  onCellCancel: () => void
  onCellTab: (backward: boolean) => void
}

export function NodeView({
  node,
  layout,
  selected,
  draft,
  selectAllOnFocus,
  dragging,
  dropTarget,
  hiddenCount,
  searchQuery,
  searchCurrent,
  onDraftChange,
  onCommit,
  onCancel,
  onTabFromEdit,
  onToggleCollapse,
  cellEdit,
  onCellDraftChange,
  onCellCommit,
  onCellCancel,
  onCellTab,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const editing = draft !== null

  useEffect(() => {
    const input = inputRef.current
    if (!editing || !input) return
    input.focus()
    if (selectAllOnFocus) input.select()
    else input.setSelectionRange(input.value.length, input.value.length)
  }, [editing, selectAllOnFocus])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      // Shift+Enter は改行（textarea の既定の動作）
      if (e.shiftKey) return
      e.preventDefault()
      onCommit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      onTabFromEdit()
    }
  }

  const classes = ['node', `depth-${Math.min(layout.depth, 2)}`, `side-${layout.side}`]
  if (selected) classes.push('selected')
  if (editing || cellEdit) classes.push('editing')
  if (dragging) classes.push('dragging')
  if (dropTarget) classes.push('drop-target')
  if (node.collapsed) classes.push('collapsed')
  if (node.table) classes.push('table-node')
  if (searchCurrent) classes.push('search-current')

  const style = {
    left: layout.x,
    top: layout.y,
    width: layout.width,
    height: layout.height,
    font: layout.font,
    '--branch-color': layout.color,
  } as CSSProperties

  return (
    <div className={classes.join(' ')} style={style} data-node-id={node.id}>
      {node.table && layout.table ? (
        <TableContent
          table={node.table}
          layout={layout.table}
          cellEdit={cellEdit}
          searchQuery={searchQuery}
          onDraftChange={onCellDraftChange}
          onCommit={onCellCommit}
          onCancel={onCellCancel}
          onTab={onCellTab}
        />
      ) : editing ? (
        <textarea
          ref={inputRef}
          className="node-input"
          rows={splitLines(draft).length}
          style={{ lineHeight: `${layout.lineHeight}px` }}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onCommit}
          spellCheck={false}
        />
      ) : (
        <span
          className={node.text ? 'node-text' : 'node-text placeholder'}
          style={{ lineHeight: `${layout.lineHeight}px` }}
        >
          {node.text ? <HighlightedText text={node.text} query={searchQuery} /> : '（空）'}
        </span>
      )}
      {node.children.length > 0 && layout.side !== 'center' && (
        <button
          type="button"
          className="collapse-btn"
          title={node.collapsed ? '展開する' : '折りたたむ'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse()
          }}
        >
          {node.collapsed ? hiddenCount : '−'}
        </button>
      )}
    </div>
  )
}
