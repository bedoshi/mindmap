import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { TableLayout } from '../model/layout'

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
  onDraftChange: (text: string) => void
  /** 編集の確定。blur が遅れて届いた場合に別のセルを確定しないよう、対象のセル位置を渡す */
  onCommit: (row: number, column: number) => void
  onCancel: () => void
  /** 編集中に Tab / Shift+Tab を押したとき（確定して隣のセルの編集に移る） */
  onTab: (backward: boolean) => void
}

/** テーブルノードの中身（セルの格子と、編集中のセルの入力欄） */
export function TableContent({
  table,
  layout,
  cellEdit,
  onDraftChange,
  onCommit,
  onCancel,
  onTab,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const editingRow = cellEdit?.row
  const editingColumn = cellEdit?.column

  useEffect(() => {
    const input = inputRef.current
    if (editingRow === undefined || !input) return
    input.focus()
    input.select()
  }, [editingRow, editingColumn])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || !cellEdit) return
    if (e.key === 'Enter') {
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
        gridAutoRows: `${layout.rowHeight}px`,
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
                <input
                  ref={inputRef}
                  className="cell-input"
                  aria-label={`セル ${row + 1} 行 ${column + 1} 列`}
                  value={cellEdit.draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={() => onCommit(row, column)}
                  spellCheck={false}
                />
              ) : (
                <span className="cell-text">{cell}</span>
              )}
            </div>
          )
        }),
      )}
    </div>
  )
}
