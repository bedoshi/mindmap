import { useEffect, useRef, type KeyboardEvent } from 'react'
import { splitLines, type TableLayout } from '../model/layout'
import { HighlightedText } from './HighlightedText'

/** 編集中のセルの位置と入力中のテキスト */
export interface CellDraft {
  row: number
  column: number
  draft: string
}

interface Props {
  table: string[][]
  layout: TableLayout
  /** 編集中のセル。編集していなければ null */
  cellEdit: CellDraft | null
  /** 検索中の検索語（一致部分をハイライトする）。検索していなければ null */
  searchQuery: string | null
  onDraftChange: (text: string) => void
  /** 編集の確定。blur が遅れて届いた場合に別のセルを確定しないよう、対象のセル位置を渡す */
  onCommit: (row: number, column: number) => void
  onCancel: () => void
  /** 編集中に Tab / Shift+Tab を押したとき（確定して隣のセルの編集に移る）。Shift+Enter はセル内の改行 */
  onTab: (backward: boolean) => void
}

/** テーブルノードの中身（セルの格子と、編集中のセルの入力欄） */
export function TableContent({
  table,
  layout,
  cellEdit,
  searchQuery,
  onDraftChange,
  onCommit,
  onCancel,
  onTab,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const editingRow = cellEdit?.row
  const editingColumn = cellEdit?.column

  useEffect(() => {
    const input = inputRef.current
    if (editingRow === undefined || !input) return
    input.focus()
    input.select()
  }, [editingRow, editingColumn])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || !cellEdit) return
    if (e.key === 'Enter') {
      // Shift+Enter は改行（textarea の既定の動作）
      if (e.shiftKey) return
      e.preventDefault()
      onCommit(cellEdit.row, cellEdit.column)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      onTab(e.shiftKey)
    }
  }

  const rowCount = table.length
  const columnCount = layout.columnWidths.length

  return (
    <div
      className="node-table"
      style={{
        gridTemplateColumns: layout.columnWidths.map((w) => `${w}px`).join(' '),
        gridTemplateRows: layout.rowHeights.map((h) => `${h}px`).join(' '),
        lineHeight: `${layout.lineHeight}px`,
      }}
    >
      {table.flatMap((cells, row) =>
        cells.map((cell, column) => {
          const classes = ['table-cell']
          if (row === rowCount - 1) classes.push('last-row')
          if (column === columnCount - 1) classes.push('last-column')
          const editing = cellEdit?.row === row && cellEdit.column === column
          if (editing) classes.push('editing')
          return (
            <div
              key={`${row}-${column}`}
              className={classes.join(' ')}
              data-row={row}
              data-column={column}
            >
              {editing ? (
                <textarea
                  ref={inputRef}
                  className="cell-input"
                  aria-label={`セル ${row + 1} 行 ${column + 1} 列`}
                  rows={splitLines(cellEdit.draft).length}
                  value={cellEdit.draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={() => onCommit(row, column)}
                  spellCheck={false}
                />
              ) : (
                <span className="cell-text">
                  <HighlightedText text={cell} query={searchQuery} />
                </span>
              )}
            </div>
          )
        }),
      )}
    </div>
  )
}
