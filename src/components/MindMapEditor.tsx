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
import { imageFileName, renderMapPng } from '../export/mapImage'
import { downloadBlob, saveImage } from '../export/saveImage'
import type { MapLibrary } from '../hooks/useMapLibrary'
import { useMindMap } from '../hooks/useMindMap'
import { computeLayout } from '../model/layout'
import {
  countSubtree,
  expandAncestors,
  moveNodeTo,
  moveRoot,
  newId,
  nodeToSelectAfterRemove,
  updateTableCell,
  updateText,
  visibleChildren,
  type DropPosition,
} from '../model/mindmap'
import { findMatches, isSearchable } from '../model/search'
import type { MindMap, NodeId, Side } from '../model/types'
import { XML_FILE_EXTENSION, mindMapToXml, titleOf, xmlToMindMap } from '../storage/xml'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { MapListPanel } from './MapListPanel'
import { NodeView, type DropIndicator } from './NodeView'
import { SearchBar } from './SearchBar'
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

/** テーブルノードのセルの編集状態 */
interface CellEditState {
  id: NodeId
  row: number
  column: number
  draft: string
}

/**
 * 右クリックメニューの対象。x / y はメニューの表示位置（ウィンドウ座標）。
 * ノード上なら kind: 'node'（cell はテーブルノードのセル上で開いたときの位置）、
 * 余白なら kind: 'canvas'（mapX / mapY は右クリックした位置のマップ座標）
 */
type ContextMenuState =
  | { kind: 'node'; x: number; y: number; id: NodeId; cell: { row: number; column: number } | null }
  | { kind: 'canvas'; x: number; y: number; mapX: number; mapY: number }

/** マップ内検索の状態。検索していないときは null */
interface SearchState {
  query: string
  /** 表示中の検索結果の位置（0 始まり） */
  index: number
  /** Ctrl+F を押すたびに増やし、検索欄にフォーカスし直す合図にする */
  focusKey: number
}

type DragState =
  | { kind: 'pan'; startX: number; startY: number; viewX: number; viewY: number }
  | { kind: 'node'; id: NodeId; startX: number; startY: number; moved: boolean }
  | {
      kind: 'root'
      id: NodeId
      startX: number
      startY: number
      /** ドラッグ開始時のルート中心座標 */
      originX: number
      originY: number
      moved: boolean
    }

/** ルート（メイン・フローティング）を移動している間の仮の中心座標 */
interface RootMoveVisual {
  id: NodeId
  x: number
  y: number
}

/** ドラッグ中のノードのドロップ先 */
interface DropTarget {
  id: NodeId
  /** ドロップ先の前・後ろに兄弟として置くか、子にするか */
  position: DropPosition
  /** ドロップ先がルートのとき、子をどちら側に置くか（ルートの左半分なら左） */
  side?: Side
}

interface NodeDragVisual {
  id: NodeId
  x: number
  y: number
  /** 移動できる（位置か側が変わる）ドロップ先。無ければ null */
  target: DropTarget | null
}

/** ノードの上端・下端からこの割合の範囲にドロップすると、子ではなく前・後ろの兄弟として置く */
const SIBLING_DROP_RATIO = 0.3

const MIN_ZOOM = 0.2
const MAX_ZOOM = 3
const DRAG_THRESHOLD = 6
const DOUBLE_TAP_MS = 400

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/** ドロップ先の表示（NodeView に渡す）。ルートへのドロップは子を置く側で表す */
function dropIndicatorOf(target: DropTarget | null, id: NodeId): DropIndicator | null {
  if (!target || target.id !== id) return null
  if (target.side) return target.side
  return target.position
}

/** 要素がテーブルノードのセル（またはその中）なら、そのセルの位置を返す */
function cellAt(element: HTMLElement): { row: number; column: number } | null {
  const cell = element.closest<HTMLElement>('[data-row]')
  if (!cell) return null
  return { row: Number(cell.dataset.row), column: Number(cell.dataset.column) }
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
  const initialMapRef = useRef(initialMap)
  const dragRef = useRef<DragState | null>(null)
  /** フローティングノード作成直後の mousedown でフォーカスが外れて入力欄が閉じないようにする */
  const keepFocusRef = useRef(false)
  const lastTapRef = useRef<{ id: NodeId | null; time: number; x: number; y: number } | null>(null)

  const [selectedId, setSelectedId] = useState<NodeId | null>(map.rootId)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 })
  const [nodeDrag, setNodeDrag] = useState<NodeDragVisual | null>(null)
  const [rootMove, setRootMove] = useState<RootMoveVisual | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [mapListOpen, setMapListOpen] = useState(false)
  const [cellEdit, setCellEdit] = useState<CellEditState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [search, setSearch] = useState<SearchState | null>(null)

  // 選択中のノードが（Undo や新規作成で）消えた場合はルートを選択扱いにする。
  // 編集中のノードが消えた場合は編集を終了したものとして扱う。
  const selected =
    selectedId === null ? null : map.nodes[selectedId] ? selectedId : map.rootId
  const editing = edit !== null && map.nodes[edit.id] ? edit : null
  // 編集中のセルが（Undo や行・列の削除で）無くなった場合は編集を終了したものとして扱う
  const editingCell =
    cellEdit !== null && map.nodes[cellEdit.id]?.table?.[cellEdit.row]?.[cellEdit.column] !== undefined
      ? cellEdit
      : null
  const menu =
    contextMenu !== null && (contextMenu.kind === 'canvas' || map.nodes[contextMenu.id])
      ? contextMenu
      : null

  // 編集中は入力中のテキストでレイアウトを計算し、幅が追従するようにする
  // ルートの移動中は仮の座標で計算し、ドロップ時に初めて履歴へ積む
  const layout = useMemo(() => {
    let displayMap = editing ? updateText(map, editing.id, editing.draft) : map
    if (editingCell) {
      const { id, row, column, draft } = editingCell
      displayMap = updateTableCell(displayMap, id, row, column, draft)
    }
    if (rootMove) displayMap = moveRoot(displayMap, rootMove.id, rootMove.x, rootMove.y)
    return computeLayout(displayMap)
  }, [map, editing, editingCell, rootMove])

  // ---- 検索 ----

  const searchQuery = search !== null && isSearchable(search.query) ? search.query : null
  const searchMatches = useMemo(
    () => (searchQuery === null ? [] : findMatches(map, searchQuery)),
    [map, searchQuery],
  )
  // 編集や Undo で件数が減った場合に範囲外を指さないよう丸める
  const searchIndex =
    search === null || searchMatches.length === 0
      ? 0
      : Math.min(search.index, searchMatches.length - 1)
  const currentMatch = searchMatches[searchIndex] ?? null

  /**
   * 検索結果のノードを選択し、折りたたみで隠れていれば祖先を展開して、画面の中央に表示する。
   * 展開後の位置は、展開したマップのレイアウトをその場で計算して求める
   */
  const revealMatch = useCallback(
    (id: NodeId) => {
      setSelectedId(id)
      store.expandAncestors(id)
      const target = computeLayout(expandAncestors(map, id)).nodes[id]
      const el = containerRef.current
      if (!target || !el) return
      setView((v) => ({
        ...v,
        x: el.clientWidth / 2 - (target.x + target.width / 2) * v.zoom,
        y: el.clientHeight / 2 - (target.y + target.height / 2) * v.zoom,
      }))
    },
    [map, store],
  )

  const openSearch = useCallback(() => {
    setContextMenu(null)
    setMapListOpen(false)
    setSearch((s) => ({ query: s?.query ?? '', index: s?.index ?? 0, focusKey: (s?.focusKey ?? 0) + 1 }))
  }, [])

  const closeSearch = useCallback(() => setSearch(null), [])

  /** 検索語を変えたら先頭の検索結果にジャンプする */
  const changeSearchQuery = (query: string) => {
    setSearch((s) => (s ? { ...s, query, index: 0 } : s))
    const first = isSearchable(query) ? findMatches(map, query)[0] : undefined
    if (first) revealMatch(first)
  }

  /** 次（step = 1）/ 前（step = -1）の検索結果へ。端に来たら反対の端に戻る */
  const moveSearch = (step: 1 | -1) => {
    if (!search || searchMatches.length === 0) return
    const index = (searchIndex + step + searchMatches.length) % searchMatches.length
    setSearch({ ...search, index })
    revealMatch(searchMatches[index])
  }

  // 初期表示でメインのルートを画面中央に置く
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const first = initialMapRef.current
    const root = first.nodes[first.rootId]
    setView({
      x: el.clientWidth / 2 - (root?.x ?? 0),
      y: el.clientHeight / 2 - (root?.y ?? 0),
      zoom: 1,
    })
  }, [])

  const showMessage = useCallback((text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage((m) => (m === text ? null : m)), 3000)
  }, [])

  // ---- 編集 ----

  /** テーブルノードのセルの編集を始める */
  const startCellEdit = useCallback(
    (id: NodeId, row: number, column: number) => {
      const text = map.nodes[id]?.table?.[row]?.[column]
      if (text === undefined) return
      setSelectedId(id)
      setEdit(null)
      setCellEdit({ id, row, column, draft: text })
    },
    [map],
  )

  /**
   * ノードの編集を始める。テーブルノードの場合は先頭のセルを編集する
   * （文字キーからの入力開始はテーブルノードでは行わない）
   */
  const startEdit = useCallback(
    (id: NodeId, initialText?: string) => {
      const node = map.nodes[id]
      if (!node) return
      if (node.table) {
        if (initialText === undefined) startCellEdit(id, 0, 0)
        return
      }
      setSelectedId(id)
      setEdit({ id, draft: initialText ?? node.text, selectAll: initialText === undefined })
    },
    [map, startCellEdit],
  )

  /** 確定する。blur が遅れて届いたとき別のセルを確定しないよう、対象のセル位置を照合する */
  const commitCellEdit = useCallback(
    (row: number, column: number) => {
      if (!editingCell || editingCell.row !== row || editingCell.column !== column) return
      setCellEdit(null)
      store.setTableCell(editingCell.id, row, column, editingCell.draft.trim())
    },
    [editingCell, store],
  )

  const cancelCellEdit = useCallback(() => setCellEdit(null), [])

  /** 確定して隣のセル（行の端では次 / 前の行）の編集に移る。表の端では確定だけする */
  const commitCellAndMove = useCallback(
    (backward: boolean) => {
      if (!editingCell) return
      const { id, row, column, draft } = editingCell
      store.setTableCell(id, row, column, draft.trim())
      const table = map.nodes[id]?.table
      if (!table) return
      const columns = table[0].length
      const index = row * columns + column + (backward ? -1 : 1)
      if (index < 0 || index >= table.length * columns) {
        setCellEdit(null)
        return
      }
      const nextRow = Math.floor(index / columns)
      const nextColumn = index % columns
      setCellEdit({ id, row: nextRow, column: nextColumn, draft: table[nextRow][nextColumn] })
    },
    [editingCell, map, store],
  )

  /** 空のまま確定・キャンセルされた末端ノードは削除する */
  const removeIfEmptyLeaf = useCallback(
    (id: NodeId): boolean => {
      const node = map.nodes[id]
      if (!node || id === map.rootId || node.children.length > 0 || node.text !== '') {
        return false
      }
      store.remove(id)
      // フローティングノードを消した場合は親が無いので、メインのルートを選択する
      setSelectedId((current) => (current === id ? (node.parentId ?? map.rootId) : current))
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
      if (editing.id === map.rootId) return // メインのルートは空にしない
      if (node.children.length === 0) {
        store.remove(editing.id)
        setSelectedId((current) =>
          current === editing.id ? (node.parentId ?? map.rootId) : current,
        )
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

  /** parentId の子にテーブルノードを追加し、先頭のセルを編集状態にする */
  const addTableChild = useCallback(
    (parentId: NodeId) => {
      const id = newId()
      store.addTableChild(parentId, id)
      setSelectedId(id)
      setEdit(null)
      setCellEdit({ id, row: 0, column: 0, draft: '' })
    },
    [store],
  )

  /** (x, y) を中心とするフローティングノードを作り、すぐ編集状態にする */
  const addFloating = useCallback(
    (x: number, y: number) => {
      const id = newId()
      store.addFloating(id, Math.round(x), Math.round(y))
      setSelectedId(id)
      setEdit({ id, draft: '', selectAll: false })
    },
    [store],
  )

  /** (x, y) を中心とするテーブルのフローティングノードを作り、先頭のセルを編集状態にする */
  const addFloatingTable = useCallback(
    (x: number, y: number) => {
      const id = newId()
      store.addFloatingTable(id, Math.round(x), Math.round(y))
      setSelectedId(id)
      setEdit(null)
      setCellEdit({ id, row: 0, column: 0, draft: '' })
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
    if (selected === map.rootId) return
    const next = nodeToSelectAfterRemove(map, selected) ?? node.parentId ?? map.rootId
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
    downloadBlob(blob, `${titleOf(map)}${XML_FILE_EXTENSION}`)
  }, [map])

  /**
   * 開いているマップ全体を PNG 画像として書き出す（編集中のドラフトや移動中の仮座標は含めない）。
   * Electron 版は保存ダイアログで保存先を選び、Web 版はブラウザのダウンロードとして保存する。
   */
  const exportImage = useCallback(async () => {
    try {
      const result = await saveImage(await renderMapPng(map), imageFileName())
      if (result.status === 'saved' && result.path) showMessage(`画像を保存しました: ${result.path}`)
    } catch {
      showMessage('画像の書き出しに失敗しました')
    }
  }, [map, showMessage])

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
      if (e.isComposing) return
      // Ctrl+F は編集中や入力欄の中でも検索を開く（ブラウザ標準の検索の代わり）
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        openSearch()
        return
      }
      if (editing || editingCell || menu) return
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
        // 検索中は検索を終える（選択はそのまま）。検索していなければ選択を解除する
        if (search) setSearch(null)
        else setSelectedId(null)
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
    editingCell,
    menu,
    search,
    openSearch,
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
    if (target.closest('input, textarea, button, .toolbar')) return
    const nodeEl = target.closest<HTMLElement>('[data-node-id]')
    if (nodeEl) {
      const id = nodeEl.dataset.nodeId!
      if (editing?.id === id) return
      // ポインタキャプチャ中は dblclick がノードに届かないため、ダブルクリックは自前で判定する
      const last = lastTapRef.current
      const now = e.timeStamp
      if (last && last.id === id && now - last.time < DOUBLE_TAP_MS) {
        lastTapRef.current = null
        const cell = cellAt(target)
        if (cell) startCellEdit(id, cell.row, cell.column)
        else startEdit(id)
        return
      }
      lastTapRef.current = { id, time: now, x: e.clientX, y: e.clientY }
      setSelectedId(id)
      const node = map.nodes[id]
      dragRef.current =
        node?.parentId === null
          ? {
              kind: 'root',
              id,
              startX: e.clientX,
              startY: e.clientY,
              originX: node.x ?? 0,
              originY: node.y ?? 0,
              moved: false,
            }
          : { kind: 'node', id, startX: e.clientX, startY: e.clientY, moved: false }
    } else {
      // 余白のダブルクリックで、その位置にフローティングノードを作る
      const last = lastTapRef.current
      const now = e.timeStamp
      if (
        last &&
        last.id === null &&
        now - last.time < DOUBLE_TAP_MS &&
        Math.hypot(e.clientX - last.x, e.clientY - last.y) < DRAG_THRESHOLD * 2
      ) {
        lastTapRef.current = null
        keepFocusRef.current = true
        const rect = e.currentTarget.getBoundingClientRect()
        addFloating(
          (e.clientX - rect.left - view.x) / view.zoom,
          (e.clientY - rect.top - view.y) / view.zoom,
        )
        return
      }
      lastTapRef.current = { id: null, time: now, x: e.clientX, y: e.clientY }
      setSelectedId(null)
      // 余白のクリックで検索を終える
      setSearch(null)
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
    if (drag.kind === 'root') {
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return
        drag.moved = true
      }
      setRootMove({
        id: drag.id,
        x: drag.originX + (e.clientX - drag.startX) / view.zoom,
        y: drag.originY + (e.clientY - drag.startY) / view.zoom,
      })
      return
    }
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return
      drag.moved = true
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const hit = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>('[data-node-id]')
    const targetId = hit?.dataset.nodeId
    let target: DropTarget | null = null
    if (hit && targetId && map.nodes[targetId]) {
      const box = hit.getBoundingClientRect()
      if (map.nodes[targetId].parentId === null) {
        // ルートへのドロップは子にする。ルートの左半分なら左側、右半分なら右側に置く
        const side: Side = e.clientX < box.left + box.width / 2 ? 'left' : 'right'
        target = { id: targetId, position: 'child', side }
      } else {
        const ratio = (e.clientY - box.top) / box.height
        const position: DropPosition =
          ratio < SIBLING_DROP_RATIO ? 'before' : ratio > 1 - SIBLING_DROP_RATIO ? 'after' : 'child'
        target = { id: targetId, position }
      }
      // 自分自身・子孫へのドロップや、位置も側も変わらないドロップは無効にする
      if (moveNodeTo(map, drag.id, target.id, target.position, target.side) === map) target = null
    }
    setNodeDrag({
      id: drag.id,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      target,
    })
  }

  /** pointerdown が1回しか発火しない環境向けの保険として、dblclick でも編集を開始する */
  const handleDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, button, .toolbar')) return
    const nodeEl =
      target.closest<HTMLElement>('[data-node-id]') ??
      document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-node-id]')
    const id = nodeEl?.dataset.nodeId
    if (!id || editing?.id === id) return
    const cell = cellAt(target)
    if (cell) startCellEdit(id, cell.row, cell.column)
    else startEdit(id)
  }

  /**
   * 右クリックでメニューを開く。ノード上ならノードのメニュー、余白ならその位置に作るメニュー。
   * 入力欄の上ではブラウザ標準のメニューを使う
   */
  const handleContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, button, .toolbar')) return
    e.preventDefault()
    const id = target.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
    if (id && map.nodes[id]) {
      setSelectedId(id)
      setContextMenu({ kind: 'node', x: e.clientX, y: e.clientY, id, cell: cellAt(target) })
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setContextMenu({
      kind: 'canvas',
      x: e.clientX,
      y: e.clientY,
      mapX: (e.clientX - rect.left - view.x) / view.zoom,
      mapY: (e.clientY - rect.top - view.y) / view.zoom,
    })
  }

  /** pointerdown の直後に来る mousedown の既定動作（フォーカス移動）を、作成直後の 1 回だけ止める */
  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!keepFocusRef.current) return
    keepFocusRef.current = false
    e.preventDefault()
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    keepFocusRef.current = false
    const drag = dragRef.current
    dragRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (drag?.kind === 'node' && drag.moved && nodeDrag?.target) {
      const { id, position, side } = nodeDrag.target
      store.moveTo(drag.id, id, position, side)
    }
    if (drag?.kind === 'root' && drag.moved && rootMove) {
      store.moveRoot(drag.id, Math.round(rootMove.x), Math.round(rootMove.y))
    }
    setNodeDrag(null)
    setRootMove(null)
  }

  // ---- 右クリックメニュー ----

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const contextMenuItems = (target: ContextMenuState): ContextMenuItem[] => {
    if (target.kind === 'canvas') {
      const { mapX, mapY } = target
      return [
        { kind: 'item', label: 'フローティングノードを追加', onSelect: () => addFloating(mapX, mapY) },
        { kind: 'item', label: 'テーブルを追加', onSelect: () => addFloatingTable(mapX, mapY) },
      ]
    }
    const { id } = target
    const node = map.nodes[id]
    const items: ContextMenuItem[] = [
      { kind: 'item', label: '子ノードを追加', onSelect: () => addChild(id) },
      { kind: 'item', label: '子にテーブルを追加', onSelect: () => addTableChild(id) },
    ]
    if (node.table) {
      const { row, column } = target.cell ?? { row: 0, column: 0 }
      const rows = node.table.length
      const columns = node.table[0].length
      items.push(
        { kind: 'separator' },
        { kind: 'item', label: 'セルを編集', onSelect: () => startCellEdit(id, row, column) },
        { kind: 'separator' },
        { kind: 'item', label: '上に行を追加', onSelect: () => store.insertTableRow(id, row) },
        { kind: 'item', label: '下に行を追加', onSelect: () => store.insertTableRow(id, row + 1) },
        {
          kind: 'item',
          label: '行を削除',
          disabled: rows <= 1,
          onSelect: () => store.removeTableRow(id, row),
        },
        { kind: 'separator' },
        { kind: 'item', label: '左に列を追加', onSelect: () => store.insertTableColumn(id, column) },
        {
          kind: 'item',
          label: '右に列を追加',
          onSelect: () => store.insertTableColumn(id, column + 1),
        },
        {
          kind: 'item',
          label: '列を削除',
          disabled: columns <= 1,
          onSelect: () => store.removeTableColumn(id, column),
        },
      )
    }
    items.push(
      { kind: 'separator' },
      {
        kind: 'item',
        label: node.table ? 'テーブルを削除' : 'ノードを削除',
        disabled: id === map.rootId,
        onSelect: () => {
          const next = nodeToSelectAfterRemove(map, id) ?? node.parentId ?? map.rootId
          store.remove(id)
          setSelectedId(next)
        },
      },
    )
    return items
  }

  // ---- 描画 ----

  const selectedNode = selected !== null ? map.nodes[selected] : null
  const draggedNode = nodeDrag ? map.nodes[nodeDrag.id] : null

  return (
    <div className="editor">
      <Toolbar
        hasSelection={selected !== null}
        canDelete={selectedNode !== null && selected !== map.rootId}
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
        onExportImage={() => void exportImage()}
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
      {search && (
        <SearchBar
          query={search.query}
          matchCount={searchMatches.length}
          currentIndex={searchIndex}
          focusKey={search.focusKey}
          onQueryChange={changeSearchQuery}
          onNext={() => moveSearch(1)}
          onPrevious={() => moveSearch(-1)}
          onClose={closeSearch}
        />
      )}
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
        className={nodeDrag || rootMove ? 'canvas dragging-node' : 'canvas'}
        onMouseDown={handleMouseDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
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
                dropIndicator={dropIndicatorOf(nodeDrag?.target ?? null, node.id)}
                hiddenCount={countSubtree(map, node.id) - 1}
                searchQuery={searchQuery}
                searchCurrent={currentMatch === node.id}
                onDraftChange={(text) =>
                  setEdit((current) => (current?.id === node.id ? { ...current, draft: text } : current))
                }
                onCommit={commitEdit}
                onCancel={cancelEdit}
                onTabFromEdit={commitAndAddChild}
                onToggleCollapse={() => store.toggleCollapse(node.id)}
                cellEdit={editingCell?.id === node.id ? editingCell : null}
                onCellDraftChange={(text) =>
                  setCellEdit((current) =>
                    current?.id === node.id ? { ...current, draft: text } : current,
                  )
                }
                onCellCommit={commitCellEdit}
                onCellCancel={cancelCellEdit}
                onCellTab={commitCellAndMove}
              />
            )
          })}
        </div>
        {nodeDrag && draggedNode && (
          <div className="drag-ghost" style={{ left: nodeDrag.x, top: nodeDrag.y }}>
            {draggedNode.table ? '（テーブル）' : draggedNode.text || '（空）'}
          </div>
        )}
      </div>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={contextMenuItems(menu)} onClose={closeContextMenu} />
      )}
      <div className="help">
        Tab: 子を追加 / Enter: 兄弟を追加 / Delete: 削除 / F2・ダブルクリック: 編集 / 矢印キー: 移動 /
        ドラッグ: 付け替え（中央へ）・並び替え（上端 / 下端へ）・ルートの移動 / 余白をダブルクリック: フローティングノード / ホイール: スクロール / Ctrl+ホイール: ズーム / Ctrl+S: 保存 / Ctrl+F: 検索 / 右クリック: メニュー（テーブルの追加・行と列の編集）
      </div>
      {(message ?? errorMessage) && <div className="message">{message ?? errorMessage}</div>}
    </div>
  )
}
