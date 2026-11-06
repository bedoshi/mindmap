import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMindMap } from '../model/mindmap'
import { useMindMap } from './useMindMap'

describe('useMindMap', () => {
  it('子ノードを追加すると、マップに反映され Undo が可能になる', () => {
    const initial = createMindMap('root')
    const { result } = renderHook(() => useMindMap(initial))

    act(() => result.current.addChild(initial.rootId, 'c1', '子'))

    expect(result.current.map.nodes['c1']).toMatchObject({ text: '子', parentId: initial.rootId })
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
  })

  it('Undo で直前の状態に戻り、Redo でやり直せる', () => {
    const initial = createMindMap('root')
    const { result } = renderHook(() => useMindMap(initial))
    act(() => result.current.addChild(initial.rootId, 'c1', '子'))

    act(() => result.current.undo())

    expect(result.current.map).toBe(initial)
    expect(result.current.canRedo).toBe(true)

    act(() => result.current.redo())

    expect(result.current.map.nodes).toHaveProperty('c1')
  })

  it('変更後に新しい編集をすると、Redo の履歴は破棄される', () => {
    const initial = createMindMap('root')
    const { result } = renderHook(() => useMindMap(initial))
    act(() => result.current.addChild(initial.rootId, 'c1', '子'))
    act(() => result.current.undo())

    act(() => result.current.addChild(initial.rootId, 'c2', '別の子'))

    expect(result.current.canRedo).toBe(false)
    expect(result.current.map.nodes).not.toHaveProperty('c1')
  })

  it('変化のない操作は履歴に積まない', () => {
    const initial = createMindMap('root')
    const { result } = renderHook(() => useMindMap(initial))

    act(() => result.current.setText(initial.rootId, 'root'))

    expect(result.current.canUndo).toBe(false)
    expect(result.current.map).toBe(initial)
  })

  it('フローティングノードの追加とルートの移動が履歴に積まれ、Undo で戻せる', () => {
    const initial = createMindMap('root')
    const { result } = renderHook(() => useMindMap(initial))

    act(() => result.current.addFloating('f', 10, 20, '浮遊'))
    act(() => result.current.moveRoot('f', 30, 40))

    expect(result.current.map.nodes['f']).toMatchObject({ x: 30, y: 40 })

    act(() => result.current.undo())
    expect(result.current.map.nodes['f']).toMatchObject({ x: 10, y: 20 })

    act(() => result.current.undo())
    expect(result.current.map).toBe(initial)
  })
})
