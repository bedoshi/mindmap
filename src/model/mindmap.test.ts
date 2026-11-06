import { describe, expect, it } from 'vitest'
import {
  addChild,
  addFloatingRoot,
  allRootIds,
  addSibling,
  collectSubtree,
  countSubtree,
  createMindMap,
  isDescendant,
  moveNode,
  moveRoot,
  nodeToSelectAfterRemove,
  removeNode,
  toggleCollapse,
  updateText,
  visibleChildren,
} from './mindmap'

/**
 * テスト用のマップ。ルート直下に a（右）と b（左）、a の下に a1, a2 を持つ。
 *
 *        a1
 *   b - root - a
 *        a2
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

describe('createMindMap', () => {
  it('ルートノードだけを持つマップを作る', () => {
    const map = createMindMap('中心')

    const root = map.nodes[map.rootId]
    expect(Object.keys(map.nodes)).toHaveLength(1)
    expect(root).toMatchObject({ text: '中心', parentId: null, children: [], collapsed: false })
  })
})

describe('addChild', () => {
  it('親の children の末尾に追加し、新しいノードの parentId に親を設定する', () => {
    const { map } = buildMap()

    const next = addChild(map, 'a', 'a3', 'A3')

    expect(next.nodes['a'].children).toEqual(['a1', 'a2', 'a3'])
    expect(next.nodes['a3']).toMatchObject({ text: 'A3', parentId: 'a', children: [] })
  })

  it('折りたたまれた親に追加すると、親が展開される', () => {
    const { map } = buildMap()
    const collapsed = toggleCollapse(map, 'a')

    const next = addChild(collapsed, 'a', 'a3')

    expect(next.nodes['a'].collapsed).toBe(false)
  })

  it('存在しない親を指定すると、同じマップをそのまま返す', () => {
    const { map } = buildMap()

    expect(addChild(map, 'nope', 'x')).toBe(map)
  })

  it('ルート直下に追加すると、ノード数が少ない側に side が付く', () => {
    const { map, rootId } = buildMap()

    // 右側は a, a1, a2 の 3 つ、左側は b の 1 つなので左に追加される
    const next = addChild(map, rootId, 'c', 'C')

    expect(next.nodes['a'].side).toBe('right')
    expect(next.nodes['b'].side).toBe('left')
    expect(next.nodes['c'].side).toBe('left')
  })

  it('ルート以外の子には side を付けない', () => {
    const { map } = buildMap()

    expect(map.nodes['a1']).not.toHaveProperty('side')
  })
})

describe('addSibling', () => {
  it('指定したノードの直後に兄弟を挿入する', () => {
    const { map } = buildMap()

    const next = addSibling(map, 'a1', 'a1b', 'A1b')

    expect(next.nodes['a'].children).toEqual(['a1', 'a1b', 'a2'])
    expect(next.nodes['a1b'].parentId).toBe('a')
  })

  it('ルートを指定すると、ルートの子として追加する', () => {
    const { map, rootId } = buildMap()

    const next = addSibling(map, rootId, 'c', 'C')

    expect(next.nodes['c'].parentId).toBe(rootId)
    expect(next.nodes[rootId].children).toContain('c')
  })

  it('ルート直下のノードの兄弟は、同じ side を引き継ぐ', () => {
    const { map } = buildMap()

    const next = addSibling(map, 'b', 'b2', 'B2')

    expect(next.nodes['b2'].side).toBe('left')
  })
})

describe('updateText', () => {
  it('テキストを更新する', () => {
    const { map } = buildMap()

    const next = updateText(map, 'a1', '変更後')

    expect(next.nodes['a1'].text).toBe('変更後')
  })

  it('同じテキストを指定すると、同じマップをそのまま返す', () => {
    const { map } = buildMap()

    expect(updateText(map, 'a1', 'A1')).toBe(map)
  })
})

describe('removeNode', () => {
  it('ノードを子孫ごと削除し、親の children からも取り除く', () => {
    const { map, rootId } = buildMap()

    const next = removeNode(map, 'a')

    expect(next.nodes).not.toHaveProperty('a')
    expect(next.nodes).not.toHaveProperty('a1')
    expect(next.nodes).not.toHaveProperty('a2')
    expect(next.nodes[rootId].children).toEqual(['b'])
  })

  it('ルートは削除できず、同じマップをそのまま返す', () => {
    const { map, rootId } = buildMap()

    expect(removeNode(map, rootId)).toBe(map)
  })
})

describe('nodeToSelectAfterRemove', () => {
  it('上の兄弟がいればそれを返す', () => {
    const { map } = buildMap()

    expect(nodeToSelectAfterRemove(map, 'a2')).toBe('a1')
    expect(nodeToSelectAfterRemove(map, 'b')).toBe('a')
  })

  it('上の兄弟がいなければ下の兄弟を返す', () => {
    const { map } = buildMap()

    expect(nodeToSelectAfterRemove(map, 'a1')).toBe('a2')
    expect(nodeToSelectAfterRemove(map, 'a')).toBe('b')
  })

  it('兄弟がいなければ親を返す', () => {
    const { map, rootId } = buildMap()
    const only = removeNode(map, 'a2')

    expect(nodeToSelectAfterRemove(only, 'a1')).toBe('a')
    expect(nodeToSelectAfterRemove(createMindMap('x'), rootId)).toBeNull()
  })

  it('ルートや存在しない id は null を返す', () => {
    const { map, rootId } = buildMap()

    expect(nodeToSelectAfterRemove(map, rootId)).toBeNull()
    expect(nodeToSelectAfterRemove(map, 'nothing')).toBeNull()
  })
})

describe('toggleCollapse', () => {
  it('子を持つノードの折りたたみ状態を切り替え、表示される子が無くなる', () => {
    const { map } = buildMap()

    const collapsed = toggleCollapse(map, 'a')

    expect(collapsed.nodes['a'].collapsed).toBe(true)
    expect(visibleChildren(collapsed, 'a')).toEqual([])
    expect(toggleCollapse(collapsed, 'a').nodes['a'].collapsed).toBe(false)
  })

  it('子を持たないノードは切り替えず、同じマップをそのまま返す', () => {
    const { map } = buildMap()

    expect(toggleCollapse(map, 'a1')).toBe(map)
  })
})

describe('moveNode', () => {
  it('別の親の末尾に付け替える', () => {
    const { map } = buildMap()

    const next = moveNode(map, 'a1', 'b')

    expect(next.nodes['a'].children).toEqual(['a2'])
    expect(next.nodes['b'].children).toEqual(['a1'])
    expect(next.nodes['a1'].parentId).toBe('b')
  })

  it('index を指定すると、その位置に挿入する', () => {
    const { map } = buildMap()
    const withB1 = addChild(map, 'b', 'b1', 'B1')

    const next = moveNode(withB1, 'a1', 'b', 0)

    expect(next.nodes['b'].children).toEqual(['a1', 'b1'])
  })

  it('自分の子孫へは移動できず、同じマップをそのまま返す', () => {
    const { map } = buildMap()

    expect(moveNode(map, 'a', 'a1')).toBe(map)
    expect(moveNode(map, 'a', 'a')).toBe(map)
  })

  it('ルートは移動できず、同じマップをそのまま返す', () => {
    const { map, rootId } = buildMap()

    expect(moveNode(map, rootId, 'a')).toBe(map)
  })

  it('ルート直下へ移動すると side が付き、ルート以外へ移動すると side が外れる', () => {
    const { map, rootId } = buildMap()

    const toRoot = moveNode(map, 'a1', rootId)
    const fromRoot = moveNode(map, 'b', 'a')

    expect(toRoot.nodes['a1'].side).toBe('left')
    expect(fromRoot.nodes['b']).not.toHaveProperty('side')
  })

  it('移動先の親が折りたたまれていれば展開する', () => {
    const { map } = buildMap()
    const collapsed = toggleCollapse(map, 'a')

    const next = moveNode(collapsed, 'b', 'a')

    expect(next.nodes['a'].collapsed).toBe(false)
  })
})

describe('isDescendant / collectSubtree / countSubtree', () => {
  it('isDescendant は自分自身と子孫に対して true、それ以外は false を返す', () => {
    const { map } = buildMap()

    expect(isDescendant(map, 'a', 'a')).toBe(true)
    expect(isDescendant(map, 'a', 'a2')).toBe(true)
    expect(isDescendant(map, 'a', 'b')).toBe(false)
  })

  it('collectSubtree は自分自身を先頭に、子を表示順の深さ優先で列挙する', () => {
    const { map } = buildMap()

    expect(collectSubtree(map, 'a')).toEqual(['a', 'a1', 'a2'])
    expect(countSubtree(map, 'a')).toBe(3)
  })
})

describe('フローティングノード', () => {
  it('addFloatingRoot は指定した中心座標で、親を持たない別のツリーの根を追加する', () => {
    const { map, rootId } = buildMap()

    const next = addFloatingRoot(map, 'f', 120, -40, '浮遊')

    expect(next.nodes['f']).toMatchObject({ text: '浮遊', parentId: null, x: 120, y: -40 })
    expect(next.floatingRootIds).toEqual(['f'])
    expect(next.rootId).toBe(rootId)
    expect(allRootIds(next)).toEqual([rootId, 'f'])
  })

  it('同じ id が既にあれば何もしない', () => {
    const { map } = buildMap()

    expect(addFloatingRoot(map, 'a', 0, 0)).toBe(map)
  })

  it('フローティングノードの直下に追加した子には左右の side が付き、左右のバランスが取られる', () => {
    let map = addFloatingRoot(buildMap().map, 'f', 0, 0, '浮遊')

    map = addChild(map, 'f', 'f1')
    map = addChild(map, 'f', 'f2')
    map = addChild(map, 'f1', 'f11')

    expect(map.nodes['f1'].side).toBe('right')
    expect(map.nodes['f2'].side).toBe('left')
    expect(map.nodes['f11'].side).toBeUndefined()
  })

  it('moveRoot はルートの座標だけを変え、同じ位置・ルート以外では同じ参照を返す', () => {
    const { map, rootId } = buildMap()
    const withFloating = addFloatingRoot(map, 'f', 10, 20)

    const moved = moveRoot(withFloating, 'f', 50, 60)
    const mainMoved = moveRoot(withFloating, rootId, 5, 6)

    expect(moved.nodes['f']).toMatchObject({ x: 50, y: 60 })
    expect(mainMoved.nodes[rootId]).toMatchObject({ x: 5, y: 6 })
    expect(moveRoot(withFloating, 'f', 10, 20)).toBe(withFloating)
    expect(moveRoot(withFloating, rootId, 0, 0)).toBe(withFloating)
    expect(moveRoot(withFloating, 'a', 1, 1)).toBe(withFloating)
  })

  it('removeNode はフローティングノードを子孫ごと削除できるが、メインのルートは削除できない', () => {
    let map = addFloatingRoot(buildMap().map, 'f', 0, 0, '浮遊')
    map = addChild(map, 'f', 'f1')

    const next = removeNode(map, 'f')

    expect(next.nodes).not.toHaveProperty('f')
    expect(next.nodes).not.toHaveProperty('f1')
    expect(next.floatingRootIds).toEqual([])
    expect(removeNode(map, map.rootId)).toBe(map)
  })

  it('別のツリーのノードへ付け替えられる', () => {
    let map = addFloatingRoot(buildMap().map, 'f', 0, 0, '浮遊')

    map = moveNode(map, 'a1', 'f')

    expect(map.nodes['a1'].parentId).toBe('f')
    expect(map.nodes['a1'].side).toBeDefined()
    expect(map.nodes['f'].children).toEqual(['a1'])
    expect(map.nodes['a'].children).toEqual(['a2'])
  })
})
