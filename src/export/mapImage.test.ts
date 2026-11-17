import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeLayout } from '../model/layout'
import { addChild, addFloatingRoot, createMindMap, toggleCollapse } from '../model/mindmap'
import {
  IMAGE_PADDING,
  MAX_CANVAS_PIXELS,
  MAX_CANVAS_SIDE,
  computeImageSize,
  drawMapImage,
  renderMapPng,
} from './mapImage'

const bounds = (minX: number, minY: number, maxX: number, maxY: number) => ({ minX, minY, maxX, maxY })

describe('computeImageSize', () => {
  it('マップの幅・高さに左右上下の余白を足し、倍率を掛けたサイズになる', () => {
    const size = computeImageSize(bounds(-100, -50, 300, 150), 2)

    expect(size.scale).toBe(2)
    expect(size.width).toBe((400 + IMAGE_PADDING * 2) * 2)
    expect(size.height).toBe((200 + IMAGE_PADDING * 2) * 2)
  })

  it('座標が原点から離れていても、サイズは bounds の幅と高さだけで決まる', () => {
    const near = computeImageSize(bounds(0, 0, 400, 200))
    const far = computeImageSize(bounds(5000, -3000, 5400, -2800))

    expect(far).toEqual(near)
  })

  it('小数の寸法は切り上げて、端が欠けないようにする', () => {
    const size = computeImageSize(bounds(0, 0, 100.2, 50.2), 1)

    expect(size.width).toBe(Math.ceil(100.2 + IMAGE_PADDING * 2))
    expect(size.height).toBe(Math.ceil(50.2 + IMAGE_PADDING * 2))
  })

  it('1 辺が上限を超える巨大なマップは、上限に収まるまで倍率を下げる', () => {
    const size = computeImageSize(bounds(0, 0, 40000, 100))

    expect(size.scale).toBeLessThan(1)
    expect(size.width).toBeLessThanOrEqual(MAX_CANVAS_SIDE)
    expect(size.height).toBeGreaterThan(0)
  })

  it('総ピクセル数が上限を超える場合も倍率を下げる', () => {
    const size = computeImageSize(bounds(0, 0, 12000, 12000))

    expect(size.width * size.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS * 1.01)
    expect(size.scale).toBeLessThan(2)
  })
})

/** 呼び出しを記録するだけの Canvas コンテキスト */
function createFakeContext() {
  const calls: { name: string; args: unknown[] }[] = []
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, prop: string) => {
      if (prop in target) return target[prop]
      return (...args: unknown[]) => {
        calls.push({ name: prop, args })
      }
    },
    set: (target, prop: string, value) => {
      target[prop] = value
      return true
    },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

describe('drawMapImage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('bounds の左上が余白の位置に来るよう平行移動し、全ノードの文字を描く', () => {
    vi.stubGlobal('Path2D', class {})
    let map = createMindMap('中心')
    map = addChild(map, map.rootId, 'a', '子A')
    map = addFloatingRoot(map, 'f', 500, 400, '浮遊')
    const layout = computeLayout(map)
    const size = computeImageSize(layout.bounds)
    const { ctx, calls } = createFakeContext()

    drawMapImage(ctx, map, layout, size)

    const transform = calls.filter((c) => c.name === 'setTransform').at(-1)
    expect(transform?.args).toEqual([
      size.scale,
      0,
      0,
      size.scale,
      (IMAGE_PADDING - layout.bounds.minX) * size.scale,
      (IMAGE_PADDING - layout.bounds.minY) * size.scale,
    ])
    const texts = calls.filter((c) => c.name === 'fillText').map((c) => c.args[0])
    expect(texts).toEqual(expect.arrayContaining(['中心', '子A', '浮遊']))
    expect(calls.filter((c) => c.name === 'stroke').length).toBeGreaterThanOrEqual(layout.edges.length)
  })

  it('折りたたまれたノードには、隠れているノード数のバッジを描く', () => {
    vi.stubGlobal('Path2D', class {})
    let map = createMindMap('中心')
    map = addChild(map, map.rootId, 'a', '親')
    map = addChild(map, 'a', 'b', '孫1')
    map = addChild(map, 'a', 'c', '孫2')
    map = toggleCollapse(map, 'a')
    const layout = computeLayout(map)
    const { ctx, calls } = createFakeContext()

    drawMapImage(ctx, map, layout, computeImageSize(layout.bounds))

    const texts = calls.filter((c) => c.name === 'fillText').map((c) => c.args[0])
    expect(texts).toContain('2')
    expect(texts).not.toContain('孫1')
  })

  it('テキストが空のノードは「（空）」と描く', () => {
    vi.stubGlobal('Path2D', class {})
    const map = createMindMap('')
    const layout = computeLayout(map)
    const { ctx, calls } = createFakeContext()

    drawMapImage(ctx, map, layout, computeImageSize(layout.bounds))

    expect(calls.filter((c) => c.name === 'fillText').map((c) => c.args[0])).toContain('（空）')
  })
})

describe('renderMapPng', () => {
  it('Canvas が使えない環境では例外になる（jsdom では getContext が null）', async () => {
    await expect(renderMapPng(createMindMap('中心'))).rejects.toThrow()
  })
})
