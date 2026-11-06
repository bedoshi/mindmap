import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { MapLibrary } from '../hooks/useMapLibrary'
import { useMindMap } from '../hooks/useMindMap'
import { computeLayout } from '../model/layout'
import {
  countSubtree,
  isDescendant,
  newId,
  nodeToSelectAfterRemove,
  updateText,
  visibleChildren,
} from '../model/mindmap'
import type { MindMap, NodeId } from '../model/types'
import { XML_FILE_EXTENSION, mindMapToXml, titleOf, xmlToMindMap } from '../storage/xml'
import { MapListPanel } from './MapListPanel'
import { NodeView } from './NodeView'
import { Toolbar } from './Toolbar'

interface Props {
  /** 開いた時点のマップ。マップを切り替えるときは親が key を変えてこのコンポーネントを作り直す */
  initialMap: MindMap
  library: MapLibrary
}

interface View {
  x: number
  y: number
  zoom: number
}

interface EditState {
  id: NodeId
  draft: string
  /** 編集開始時にテキスト全体を選択するか（既存テキストの編集時は true） */
  selectAll: boolean
}

type DragState =
  | { kind: 'pan'; startX: number; startY: number; viewX: number; viewY: number }
  | { kind: 'node'; id: NodeId; startX: number; startY: number; moved: boolean }

interface NodeDragVisual {
  id: NodeId
  x: number
  y: number
  targetId: NodeId | null
}

const MIN_ZOOM = 0.2
const MAX_ZOOM = 3
const DRAG_THRESHOLD = 6
const DOUBLE_TAP_MS = 400

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function MindMapEditor({ initialMap, library }: Props) {
  const store = useMindMap(initialMap)
  const { map } = store
  const containerRef = useRef<HTMLDivElement>(null)
  const changedRef = useRef(false)

  // 変更があるたびにライブラリへ通知し、自動保存させる（初期状態のままなら通知しない）
  const { reportChange } = library
  useEffect(() => {
    if (map !== initialMap || changedRef.current) {
      changedRef.current = true
      reportChange(map)
    }
  }, [map, initialMap, reportChange])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const lastTapRef = useRef<{ id: NodeId; time: number } | null>(null)

  const [selectedId, setSelectedId] = useState<NodeId | null>(map.rootId)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 })
  const [nodeDrag, setNodeDrag] = useState<NodeDragVisual | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [mapListOpen, setMapListOpen] = useState(false)

  // 選択中のノードが（Undo や新規作成で）消えた場合はルートを選択扱いにする。
  // 編集中のノードが消えた場合は編集を終了したものとして扱う。
  const selected =
    selectedId === null ? null : map.nodes[selectedId] ? selectedId : map.rootId
  const editing = edit !== null && map.nodes[edit.id] ? edit : null

  // 編集中は入力中のテキストでレイアウトを計算し、幅が追従するようにする
  const layout = useMemo(
    () => computeLayout(editing ? updateText(map, editing.id, editing.draft) : map),
    [map, editing],
  )

  // 初期表示でルートを画面中央に置く
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    setView({ x: el.clientWidth / 2, y: el.clientHeight / 2, zoom: 1 })
  }, [])

  const showMessage = useCallback((text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage((m) => (m === text ? null : m)), 3000)
  }, [])

  // ---- 編集 ----

  const startEdit = useCallback(
    (id: NodeId, initialText?: string) => {
      const node = map.nodes[id]
      if (!node) return
      setSelectedId(id)
      setEdit({ id, draft: initialText ?? node.text, selectAll: initialText === undefined })
    },
    [map],
  )

  /** 空のまま確定・キャンセルされた末端ノードは削除する */
  const removeIfEmptyLeaf = useCallback(
    (id: NodeId): boolean => {
      const node = map.nodes[id]
      if (!node || node.parentId === null || node.children.length > 0 || node.text !== '') {
        return false
      }
      store.remove(id)
      setSelectedId((current) => (current === id ? node.parentId : current))
      return true
    },
    [map, store],
  )

  const commitEdit = useCallback(() => {
    if (!editing) return
    const text = editing.draft.trim()
    setEdit(null)
    const node = map.nodes[editing.id]
    if (!node) return
    if (text === '') {
      if (node.parentId === null) return // ルートは空にしない
      if (node.children.length === 0) {
        store.remove(editing.id)
        setSelectedId((current) => (current === editing.id ? node.parentId : current))
        return
      }
    }
    store.setText(editing.id, text)
  }, [editing, map, store])

  const cancelEdit = useCallback(() => {
    if (!editing) return
    setEdit(null)
    removeIfEmptyLeaf(editing.id)
  }, [editing, removeIfEmptyLeaf])

  // ---- ノード操作 ----

  const addChild = useCallback(
    (parentId: NodeId) => {
      const id = newId()
      store.addChild(parentId, id)
      setSelectedId(id)
      setEdit({ id, draft: '', selectAll: false })
    },
    [store],
  )

  const addSibling = useCallback(
    (nodeId: NodeId) => {
      const id = newId()
      store.addSibling(nodeId, id)
      setSelectedId(id)
      setEdit({ id, draft: '', selectAll: false })
    },
    [store],
  )

  const removeSelected = useCallback(() => {
    if (selected === null) return
    const node = map.nodes[selected]
    if (node.parentId === null) return
    const next = nodeToSelectAfterRemove(map, selected) ?? node.parentId
    store.remove(selected)
    setSelectedId(next)
  }, [map, selected, store])

  const commitAndAddChild = useCallback(() => {
    if (!editing) return
    const id = editing.id
    const text = editing.draft.trim()
    setEdit(null)
    store.setText(id, text)
    addChild(id)
  }, [editing, store, addChild])

  // ---- 表示（パン・ズーム） ----

  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setView((v) => {
      const zoom = clampZoom(v.zoom * factor)
      const ratio = zoom / v.zoom
      return { x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio, zoom }
    })
  }, [])

  const zoomAtCenter = useCallback(
    (factor: number) => {
      const el = containerRef.current
      if (!el) return
      zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2)
    },
    [zoomAt],
  )

  const fitToView = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { minX, minY, maxX, maxY } = layout.bounds
    const padding = 60
    const width = maxX - minX + padding * 2
    const height = maxY - minY + padding * 2
    const zoom = clampZoom(Math.min(el.clientWidth / width, el.clientHeight / height, 1))
    setView({
      x: el.clientWidth / 2 - ((minX + maxX) / 2) * zoom,
      y: el.clientHeight / 2 - ((minY + maxY) / 2) * zoom,
      zoom,
    })
  }, [layout])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.002), e.clientX - rect.left, e.clientY - rect.top)
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
      }
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [zoomAt])

  // ---- 保存・ファイル入出力 ----

  const saveNow = useCallback(async () => {
    const ok = await library.saveNow()
    showMessage(ok ? '保存しました' : '保存に失敗しました')
  }, [library, showMessage])

  const exportXml = useCallback(() => {
    const blob = new Blob([mindMapToXml(map)], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${titleOf(map)}${XML_FILE_EXTENSION}`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [map])

  /** XML ファイルを新しいマップとして取り込み、そのマップを開く */
  const importXml = useCallback(
    async (file: File) => {
      try {
        const loaded = xmlToMindMap(await file.text())
        await library.createMap(loaded)
      } catch (error) {
        showMessage(error instanceof Error ? error.message : '読み込みに失敗しました')
      }
    },
    [library, showMessage],
  )

  // ライブラリ側のエラー（保存失敗など）は一定時間表示したあと消す
  const { errorMessage, clearError } = library
  useEffect(() => {
    if (!errorMessage) return
    const timer = window.setTimeout(clearError, 5000)
    return () => window.clearTimeout(timer)
  }, [errorMessage, clearError])

  // ---- キーボード ----

  const navigate = useCallback(
    (key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): NodeId | null => {
      if (selected === null) return null
      const node = map.nodes[selected]
      const nodeLayout = layout.nodes[selected]
      const centerY = nodeLayout.y + nodeLayout.height / 2
      const nearest = (ids: NodeId[]): NodeId | null => {
        let best: NodeId | null = null
        let bestDistance = Infinity
        for (const id of ids) {
          const l = layout.nodes[id]
          const distance = Math.abs(l.y + l.height / 2 - centerY)
          if (distance < bestDistance) {
            best = id
            bestDistance = distance
          }
        }
        return best
      }

      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const toward = key === 'ArrowRight' ? 'right' : 'left'
        const children = visibleChildren(map, selected)
        if (nodeLayout.side === 'center') {
          return nearest(children.filter((c) => (map.nodes[c].side ?? 'right') === toward))
        }
        if (nodeLayout.side === toward) return nearest(children)
        return node.parentId
      }

      if (node.parentId === null) return null
      const parent = map.nodes[node.parentId]
      const siblings =
        parent.parentId === null
          ? parent.children.filter((c) => (map.nodes[c].side ?? 'right') === nodeLayout.side)
          : parent.children
      const index = siblings.indexOf(selected)
      return siblings[index + (key === 'ArrowDown' ? 1 : -1)] ?? null
    },
    [map, layout, selected],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editing || e.isComposing) return
      if (
        e.target instanceof Element &&
        e.target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }

      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveNow()
        return
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        store.redo()
        return
      }
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        zoomAtCenter(1.2)
        return
      }
      if (mod && e.key === '-') {
        e.preventDefault()
        zoomAtCenter(1 / 1.2)
        return
      }
      if (mod && e.key === '0') {
        e.preventDefault()
        fitToView()
        return
      }
      if (mod || e.altKey) return

      if (e.key === 'Escape') {
        setSelectedId(null)
        return
      }
      if (selected === null) return

      switch (e.key) {
        case 'Tab':
          e.preventDefault()
          addChild(selected)
          return
        case 'Enter':
          e.preventDefault()
          addSibling(selected)
          return
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          removeSelected()
          return
        case 'F2':
        case ' ':
          e.preventDefault()
          startEdit(selected)
          return
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault()
          const next = navigate(e.key)
          if (next) setSelectedId(next)
          return
        }
        default:
          if (e.key.length === 1) {
            // 文字キーで編集を開始し、その文字を先頭に入力する
            e.preventDefault()
            startEdit(selected, e.key)
          } else if (e.key === 'Process') {
            // IME 入力の開始。入力欄にフォーカスを移して以降の入力を受け付ける
            startEdit(selected, '')
          }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    editing,
    selected,
    store,
    addChild,
    addSibling,
    removeSelected,
    startEdit,
    navigate,
    zoomAtCenter,
    fitToView,
    saveNow,
  ])

  // ---- ポインタ操作（パン・ノードのドラッグ） ----

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('input, button, .toolbar')) return
    const nodeEl = target.closest<HTMLElement>('[data-node-id]')
    if (nodeEl) {
      const id = nodeEl.dataset.nodeId!
      if (editing?.id === id) return
      // ポインタキャプチャ中は dblclick がノードに届かないため、ダブルクリックは自前で判定する
      const last = lastTapRef.current
      const now = e.timeStamp
      if (last && last.id === id && now - last.time < DOUBLE_TAP_MS) {
        lastTapRef.current = null
        startEdit(id)
        return
      }
      lastTapRef.current = { id, time: now }
      setSelectedId(id)
      dragRef.current = { kind: 'node', id, startX: e.clientX, startY: e.clientY, moved: false }
    } else {
      lastTapRef.current = null
      setSelectedId(null)
      dragRef.current = {
        kind: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        viewX: view.x,
        viewY: view.y,
      }
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.kind === 'pan') {
      setView((v) => ({
        ...v,
        x: drag.viewX + (e.clientX - drag.startX),
        y: drag.viewY + (e.clientY - drag.startY),
      }))
      return
    }
    if (map.nodes[drag.id]?.parentId === null) return // ルートは移動できない
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return
      drag.moved = true
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const hit = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>('[data-node-id]')
    const targetId = hit?.dataset.nodeId ?? null
    const dragged = map.nodes[drag.id]
    const valid =
      targetId !== null &&
      targetId !== dragged.parentId &&
      map.nodes[targetId] !== undefined &&
      !isDescendant(map, drag.id, targetId)
    setNodeDrag({
      id: drag.id,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      targetId: valid ? targetId : null,
    })
  }

  /** pointerdown が1回しか発火しない環境向けの保険として、dblclick でも編集を開始する */
  const handleDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('input, button, .toolbar')) return
    const nodeEl =
      target.closest<HTMLElement>('[data-node-id]') ??
      document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-node-id]')
    const id = nodeEl?.dataset.nodeId
    if (id && editing?.id !== id) startEdit(id)
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (drag?.kind === 'node' && drag.moved && nodeDrag?.targetId) {
      store.move(drag.id, nodeDrag.targetId)
    }
    setNodeDrag(null)
  }

  // ---- 描画 ----

  const selectedNode = selected !== null ? map.nodes[selected] : null
  const draggedNode = nodeDrag ? map.nodes[nodeDrag.id] : null

  return (
    <div className="editor">
      <Toolbar
        hasSelection={selected !== null}
        canDelete={selectedNode !== null && selectedNode.parentId !== null}
        canUndo={store.canUndo}
        canRedo={store.canRedo}
        zoom={view.zoom}
        saveState={library.saveState}
        mapListOpen={mapListOpen}
        onToggleMapList={() => setMapListOpen((open) => !open)}
        onAddChild={() => selected && addChild(selected)}
        onAddSibling={() => selected && addSibling(selected)}
        onDelete={removeSelected}
        onUndo={store.undo}
        onRedo={store.redo}
        onZoomIn={() => zoomAtCenter(1.2)}
        onZoomOut={() => zoomAtCenter(1 / 1.2)}
        onFit={fitToView}
        onSave={() => void saveNow()}
        onExport={exportXml}
        onImport={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".xml,application/xml,text/xml"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void importXml(file)
          e.target.value = ''
        }}
      />
      <MapListPanel
        open={mapListOpen}
        maps={library.maps}
        currentId={library.current?.id ?? null}
        location={library.location}
        storageKind={library.storageKind}
        onClose={() => setMapListOpen(false)}
        onOpen={(id) => void library.openMap(id)}
        onCreate={() => void library.createMap()}
        onDelete={(id) => void library.deleteMap(id)}
      />
      <div
        ref={containerRef}
        className={nodeDrag ? 'canvas dragging-node' : 'canvas'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="viewport"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        >
          <svg className="edges" width="1" height="1">
            {layout.edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.path}
                stroke={edge.color}
                strokeWidth={edge.depth === 1 ? 3 : 2}
                fill="none"
              />
            ))}
          </svg>
          {Object.values(layout.nodes).map((nodeLayout) => {
            const node = map.nodes[nodeLayout.id]
            return (
              <NodeView
                key={node.id}
                node={node}
                layout={nodeLayout}
                selected={selected === node.id}
                draft={editing?.id === node.id ? editing.draft : null}
                selectAllOnFocus={editing?.id === node.id ? editing.selectAll : false}
                dragging={nodeDrag?.id === node.id}
                dropTarget={nodeDrag?.targetId === node.id}
                hiddenCount={countSubtree(map, node.id) - 1}
                onDraftChange={(text) =>
                  setEdit((current) => (current?.id === node.id ? { ...current, draft: text } : current))
                }
                onCommit={commitEdit}
                onCancel={cancelEdit}
                onTabFromEdit={commitAndAddChild}
                onToggleCollapse={() => store.toggleCollapse(node.id)}
              />
            )
          })}
        </div>
        {nodeDrag && draggedNode && (
          <div className="drag-ghost" style={{ left: nodeDrag.x, top: nodeDrag.y }}>
            {draggedNode.text || '（空）'}
          </div>
        )}
      </div>
      <div className="help">
        Tab: 子を追加 / Enter: 兄弟を追加 / Delete: 削除 / F2・ダブルクリック: 編集 / 矢印キー: 移動 /
        ドラッグ: 付け替え / ホイール: スクロール / Ctrl+ホイール: ズーム / Ctrl+S: 保存
      </div>
      {(message ?? errorMessage) && <div className="message">{message ?? errorMessage}</div>}
    </div>
  )
}
