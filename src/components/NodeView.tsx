import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import type { NodeLayout } from '../model/layout'
import type { MindMapNode } from '../model/types'

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
  onDraftChange: (text: string) => void
  onCommit: () => void
  onCancel: () => void
  /** 編集中に Tab を押したとき（確定して子ノードを追加する） */
  onTabFromEdit: () => void
  onToggleCollapse: () => void
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
  onDraftChange,
  onCommit,
  onCancel,
  onTabFromEdit,
  onToggleCollapse,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const editing = draft !== null

  useEffect(() => {
    const input = inputRef.current
    if (!editing || !input) return
    input.focus()
    if (selectAllOnFocus) input.select()
    else input.setSelectionRange(input.value.length, input.value.length)
  }, [editing, selectAllOnFocus])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
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
  if (editing) classes.push('editing')
  if (dragging) classes.push('dragging')
  if (dropTarget) classes.push('drop-target')
  if (node.collapsed) classes.push('collapsed')

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
      {editing ? (
        <input
          ref={inputRef}
          className="node-input"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onCommit}
          spellCheck={false}
        />
      ) : (
        <span className={node.text ? 'node-text' : 'node-text placeholder'}>
          {node.text || '（空）'}
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
