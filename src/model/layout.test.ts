import { describe, expect, it } from 'vitest'
import { BRANCH_COLORS, computeLayout, measureNode, ROOT_COLOR } from './layout'
import { addChild, createMindMap, toggleCollapse } from './mindmap'

/**
 * ルート直下に a（右）と b（左）、a の下に a1, a2 を持つマップ。
 */
function buildMap() {
  let map = createMindMap('root')
  const rootId = map.rootId
  map = addChild(map, rootId, 'a', 'A')
  map = addChild(map, rootId, 'b', 'B')
  map = addChild(map, 'a', 'a1', 'A1')
  map = addChild(map, 'a', 'a2', 'A2')
  return { map, rootId }
}

describe('measureNode', () => {
  it('空文字でも最小幅を確保する', () => {
    expect(measureNode('', false).width).toBe(60)
  })

  it('テキストが長いほど幅が広くなる', () => {
    expect(measureNode('長いテキストのノード', false).width).toBeGreaterThan(
      measureNode('短い', false).width,
    )
  })

  it('ルートは通常ノードより高く、太字のフォントを使う', () => {
    const root = measureNode('x', true)
    const normal = measureNode('x', false)

    expect(root.height).toBeGreaterThan(normal.height)
    expect(root.font).toContain('bold')
  })
})

describe('computeLayout', () => {
  it('ルートを原点が中心になる位置に置く', () => {
    const { map, rootId } = buildMap()

    const { nodes } = computeLayout(map)

    const root = nodes[rootId]
    expect(root.x).toBe(-root.width / 2)
    expect(root.y).toBe(-root.height / 2)
    expect(root.side).toBe('center')
    expect(root.depth).toBe(0)
    expect(root.color).toBe(ROOT_COLOR)
  })

  it('side が right のノードはルートの右、left のノードはルートの左に置く', () => {
    const { map, rootId } = buildMap()

    const { nodes } = computeLayout(map)

    const root = nodes[rootId]
    expect(nodes['a'].x).toBeGreaterThan(root.x + root.width)
    expect(nodes['b'].x + nodes['b'].width).toBeLessThan(root.x)
    expect(nodes['a1'].x).toBeGreaterThan(nodes['a'].x + nodes['a'].width)
  })

  it('兄弟ノードは縦に並び、重ならない', () => {
    const { map } = buildMap()

    const { nodes } = computeLayout(map)

    expect(nodes['a1'].y + nodes['a1'].height).toBeLessThanOrEqual(nodes['a2'].y)
    expect(nodes['a1'].x).toBe(nodes['a2'].x)
  })

  it('枝の色はルート直下の順に割り当て、子孫は親と同じ色になる', () => {
    const { map } = buildMap()

    const { nodes } = computeLayout(map)

    expect(nodes['a'].color).toBe(BRANCH_COLORS[0])
    expect(nodes['b'].color).toBe(BRANCH_COLORS[1])
    expect(nodes['a1'].color).toBe(nodes['a'].color)
    expect(nodes['a1'].depth).toBe(2)
  })

  it('接続線はルート以外のノードごとに 1 本で、子と同じ色になる', () => {
    const { map } = buildMap()

    const { edges } = computeLayout(map)

    expect(edges).toHaveLength(4)
    const edgeToA1 = edges.find((e) => e.to === 'a1')
    expect(edgeToA1).toMatchObject({ from: 'a', color: BRANCH_COLORS[0], depth: 2 })
    expect(edgeToA1?.path).toMatch(/^M .* C /)
  })

  it('折りたたまれたノードの子孫はレイアウトと接続線に含めない', () => {
    const { map } = buildMap()
    const collapsed = toggleCollapse(map, 'a')

    const { nodes, edges } = computeLayout(collapsed)

    expect(nodes).not.toHaveProperty('a1')
    expect(nodes).not.toHaveProperty('a2')
    expect(edges.map((e) => e.to).sort()).toEqual(['a', 'b'])
  })

  it('bounds はすべてのノードを含む範囲になる', () => {
    const { map } = buildMap()

    const { nodes, bounds } = computeLayout(map)

    for (const node of Object.values(nodes)) {
      expect(node.x).toBeGreaterThanOrEqual(bounds.minX)
      expect(node.y).toBeGreaterThanOrEqual(bounds.minY)
      expect(node.x + node.width).toBeLessThanOrEqual(bounds.maxX)
      expect(node.y + node.height).toBeLessThanOrEqual(bounds.maxY)
    }
  })
})
