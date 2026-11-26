import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type ContextMenuItem =
  | { kind: 'item'; label: string; disabled?: boolean; onSelect: () => void }
  | { kind: 'separator' }

interface Props {
  /** 表示位置（ウィンドウ座標） */
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

const VIEWPORT_MARGIN = 8

/**
 * 右クリックメニュー（表示専用。項目と処理は呼び出し側が決める）。
 * メニューの外を押す・Esc・ウィンドウのサイズ変更で閉じる。項目を選んだときも閉じる。
 */
export function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  // 画面の端からはみ出す場合は内側にずらす
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const { width, height } = menu.getBoundingClientRect()
    setPosition({
      left: Math.max(VIEWPORT_MARGIN, Math.min(x, window.innerWidth - width - VIEWPORT_MARGIN)),
      top: Math.max(VIEWPORT_MARGIN, Math.min(y, window.innerHeight - height - VIEWPORT_MARGIN)),
    })
  }, [x, y])

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [])

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !menuRef.current?.contains(e.target)) onClose()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="context-menu"
      role="menu"
      style={position}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item.kind === 'separator' ? (
          <div key={i} className="context-menu-separator" role="separator" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className="context-menu-item"
            disabled={item.disabled}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  )
}
