import { useEffect, useRef, type KeyboardEvent } from 'react'

interface Props {
  query: string
  /** 一致したノードの数 */
  matchCount: number
  /** 表示中の検索結果の位置（0 始まり）。一致が無ければ無視される */
  currentIndex: number
  /** 開くたび（Ctrl+F を押すたび）に変わる値。変わったら入力欄にフォーカスして全選択する */
  focusKey: number
  onQueryChange: (query: string) => void
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
}

/**
 * マップ内検索のポップアップ（表示専用。検索の状態と処理は MindMapEditor が持つ）。
 * Enter で次へ、Shift+Enter で前へ、Esc で閉じる
 */
export function SearchBar({
  query,
  matchCount,
  currentIndex,
  focusKey,
  onQueryChange,
  onNext,
  onPrevious,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [focusKey])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) onPrevious()
      else onNext()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const status =
    query.trim() === '' ? '' : matchCount === 0 ? '0 件' : `${currentIndex + 1} / ${matchCount}`

  return (
    <div className="search-bar" role="search">
      <input
        ref={inputRef}
        className="search-input"
        type="text"
        aria-label="マップ内を検索"
        placeholder="マップ内を検索"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
      <span className="search-status" aria-live="polite">
        {status}
      </span>
      <button
        type="button"
        title="前の検索結果 (Shift+Enter)"
        aria-label="前の検索結果"
        disabled={matchCount === 0}
        onClick={onPrevious}
      >
        ↑
      </button>
      <button
        type="button"
        title="次の検索結果 (Enter)"
        aria-label="次の検索結果"
        disabled={matchCount === 0}
        onClick={onNext}
      >
        ↓
      </button>
      <button type="button" title="検索を閉じる (Esc)" aria-label="検索を閉じる" onClick={onClose}>
        ×
      </button>
    </div>
  )
}
