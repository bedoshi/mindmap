import {
  ROOT_COLOR,
  TABLE_BORDER,
  TABLE_CELL_PAD,
  computeLayout,
  type Bounds,
  type Layout,
  type NodeLayout,
} from '../model/layout'
import { countSubtree } from '../model/mindmap'
import type { MindMap } from '../model/types'

/**
 * マインドマップ全体を PNG 画像にする。
 * 画面の DOM を撮影するのではなく、`computeLayout` が返す座標を Canvas 2D に直接描く。
 * そのため画面のズーム・パン・スクロール位置や、画面外にあるノードの影響を受けない。
 * 配色は実行環境のダークモードに関わらず、常にライトテーマ（白背景）で描く。
 */

/** マップ全体の外側に取る余白（マップ座標での px） */
export const IMAGE_PADDING = 40
/** 既定の出力倍率。2 倍にして高解像度の画面や拡大表示でもぼやけないようにする */
export const DEFAULT_IMAGE_SCALE = 2
/** Canvas の 1 辺の上限（ブラウザごとの上限の最小公倍数に近い値） */
export const MAX_CANVAS_SIDE = 16384
/** Canvas の総ピクセル数の上限（超えるとブラウザが描画に失敗することがある） */
export const MAX_CANVAS_PIXELS = 100_000_000

const BACKGROUND_COLOR = '#ffffff'
const SURFACE_COLOR = '#ffffff'
const TEXT_COLOR = '#1f2430'
const LIGHT_TEXT_COLOR = '#ffffff'
const PLACEHOLDER_TEXT = '（空）'
const PLACEHOLDER_ALPHA = 0.6
/** テーブルの区切り線の不透明度（CSS の color-mix 45% に合わせる） */
const TABLE_GRID_ALPHA = 0.45
const TABLE_RADIUS = 6

export const IMAGE_FILE_EXTENSION = '.png'

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 書き出し時のファイル名。`mindmap-export-YYYYMMDDHHmmss.png`（ローカル時刻・24 時間表記） */
export function imageFileName(now: Date = new Date()): string {
  const date = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`
  const time = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
  return `mindmap-export-${date}${time}${IMAGE_FILE_EXTENSION}`
}

export interface ImageSize {
  /** 出力する画像の幅（px） */
  width: number
  /** 出力する画像の高さ（px） */
  height: number
  /** マップ座標 1 に対する画像のピクセル数。上限に収めるため、希望の倍率より小さくなることがある */
  scale: number
}

/**
 * マップ全体（余白込み）が収まる画像サイズを求める。
 * 希望の倍率で Canvas の上限を超える場合は、収まる最大の倍率まで下げる。
 */
export function computeImageSize(
  bounds: Bounds,
  desiredScale = DEFAULT_IMAGE_SCALE,
  padding = IMAGE_PADDING,
): ImageSize {
  const logicalWidth = bounds.maxX - bounds.minX + padding * 2
  const logicalHeight = bounds.maxY - bounds.minY + padding * 2
  const scale = Math.min(
    desiredScale,
    MAX_CANVAS_SIDE / logicalWidth,
    MAX_CANVAS_SIDE / logicalHeight,
    Math.sqrt(MAX_CANVAS_PIXELS / (logicalWidth * logicalHeight)),
  )
  return {
    // 切り上げて、端のノードが丸め誤差で欠けないようにする
    width: Math.max(1, Math.ceil(logicalWidth * scale)),
    height: Math.max(1, Math.ceil(logicalHeight * scale)),
    scale,
  }
}

/** テーブルノードを描く。画面と同じく深さに関わらず白地 + 枝の色の枠線で、セルの文字は左寄せ */
function drawTableNode(ctx: CanvasRenderingContext2D, table: string[][], node: NodeLayout): void {
  const { x, y, width, height } = node
  const tableLayout = node.table!

  ctx.beginPath()
  ctx.roundRect(x, y, width, height, TABLE_RADIUS)
  ctx.fillStyle = SURFACE_COLOR
  ctx.fill()

  const innerX = x + TABLE_BORDER
  const innerY = y + TABLE_BORDER
  const innerWidth = width - TABLE_BORDER * 2
  const innerHeight = height - TABLE_BORDER * 2

  // 区切り線（各列の右端・各行の下端の 1px。最後の列・行には引かない）
  ctx.globalAlpha = TABLE_GRID_ALPHA
  ctx.fillStyle = node.color
  let columnX = innerX
  tableLayout.columnWidths.slice(0, -1).forEach((w) => {
    columnX += w
    ctx.fillRect(columnX - 1, innerY, 1, innerHeight)
  })
  for (let row = 1; row < table.length; row++) {
    ctx.fillRect(innerX, innerY + row * tableLayout.rowHeight - 1, innerWidth, 1)
  }
  ctx.globalAlpha = 1

  ctx.font = node.font
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = TEXT_COLOR
  table.forEach((cells, row) => {
    let cellX = innerX
    cells.forEach((cell, column) => {
      const cellWidth = tableLayout.columnWidths[column]
      if (cell !== '') {
        ctx.save()
        ctx.beginPath()
        ctx.rect(cellX, innerY + row * tableLayout.rowHeight, cellWidth - 1, tableLayout.rowHeight)
        ctx.clip()
        ctx.fillText(
          cell,
          cellX + TABLE_CELL_PAD,
          innerY + row * tableLayout.rowHeight + (tableLayout.rowHeight - 1) / 2,
        )
        ctx.restore()
      }
      cellX += cellWidth
    })
  })

  ctx.beginPath()
  ctx.roundRect(x + 1, y + 1, width - 2, height - 2, TABLE_RADIUS - 1)
  ctx.strokeStyle = node.color
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawNode(ctx: CanvasRenderingContext2D, map: MindMap, node: NodeLayout): void {
  const { x, y, width, height, depth } = node
  const mapNode = map.nodes[node.id]
  if (mapNode.table && node.table) {
    drawTableNode(ctx, mapNode.table, node)
    drawCollapsedBadge(ctx, map, node)
    return
  }
  const isRoot = depth === 0
  const radius = isRoot ? 24 : 8

  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  if (depth >= 2) {
    // CSS の border（2px・内側）と同じ見た目にするため、線の太さの半分だけ内側に描く
    ctx.fillStyle = SURFACE_COLOR
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(x + 1, y + 1, width - 2, height - 2, radius - 1)
    ctx.strokeStyle = node.color
    ctx.lineWidth = 2
    ctx.stroke()
  } else {
    ctx.fillStyle = isRoot ? ROOT_COLOR : node.color
    ctx.fill()
  }

  const hasText = mapNode.text !== ''
  ctx.font = node.font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = depth >= 2 ? TEXT_COLOR : LIGHT_TEXT_COLOR
  ctx.globalAlpha = hasText ? 1 : PLACEHOLDER_ALPHA
  ctx.fillText(hasText ? mapNode.text : PLACEHOLDER_TEXT, x + width / 2, y + height / 2)
  ctx.globalAlpha = 1

  drawCollapsedBadge(ctx, map, node)
}

/** 折りたたまれているノードには、画面と同じく隠れているノード数のバッジを付ける */
function drawCollapsedBadge(ctx: CanvasRenderingContext2D, map: MindMap, node: NodeLayout): void {
  const { x, y, width, height } = node
  const mapNode = map.nodes[node.id]
  if (mapNode.collapsed && mapNode.children.length > 0 && node.side !== 'center') {
    const cx = node.side === 'right' ? x + width + 2 : x - 2
    const cy = y + height / 2
    ctx.beginPath()
    ctx.arc(cx, cy, 9, 0, Math.PI * 2)
    ctx.fillStyle = SURFACE_COLOR
    ctx.fill()
    ctx.strokeStyle = node.color
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = TEXT_COLOR
    ctx.fillText(String(countSubtree(map, node.id) - 1), cx, cy)
  }
}

/** レイアウト済みのマップを、サイズ `size` の Canvas コンテキストに描く */
export function drawMapImage(
  ctx: CanvasRenderingContext2D,
  map: MindMap,
  layout: Layout,
  size: ImageSize,
  padding = IMAGE_PADDING,
): void {
  const { scale } = size
  const { minX, minY } = layout.bounds

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = BACKGROUND_COLOR
  ctx.fillRect(0, 0, size.width, size.height)

  // マップ座標 → 画像座標。bounds の左上が (padding, padding) に来るように平行移動する
  ctx.setTransform(scale, 0, 0, scale, (padding - minX) * scale, (padding - minY) * scale)

  ctx.lineCap = 'round'
  for (const edge of layout.edges) {
    ctx.strokeStyle = edge.color
    ctx.lineWidth = edge.depth === 1 ? 3 : 2
    ctx.stroke(new Path2D(edge.path))
  }
  for (const node of Object.values(layout.nodes)) drawNode(ctx, map, node)
}

/** マップ全体を PNG の Blob にする。Canvas が使えない・書き出しに失敗したときは例外を投げる */
export function renderMapPng(map: MindMap): Promise<Blob> {
  const layout = computeLayout(map)
  const size = computeImageSize(layout.bounds)

  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas を利用できません'))
  drawMapImage(ctx, map, layout, size)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNG への変換に失敗しました'))
    }, 'image/png')
  })
}
