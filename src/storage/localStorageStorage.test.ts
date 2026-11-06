import { describe, expect, it } from 'vitest'
import { addChild, createMindMap } from '../model/mindmap'
import { createLocalStorageStorage } from './localStorageStorage'

describe('createLocalStorageStorage', () => {
  it('保存したマップを一覧に表示し、読み込める', async () => {
    const storage = createLocalStorageStorage()
    const base = createMindMap('計画')
    const map = addChild(base, base.rootId, 'x', '子')

    await storage.save('map-1', map)

    const summaries = await storage.list()
    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({ id: 'map-1', title: '計画' })
    expect(summaries[0].updatedAt).toBeGreaterThan(0)
    expect(await storage.load('map-1')).toEqual(map)
  })

  it('削除すると一覧から消え、読み込むと null になる', async () => {
    const storage = createLocalStorageStorage()
    await storage.save('map-1', createMindMap('a'))

    await storage.remove('map-1')

    expect(await storage.list()).toEqual([])
    expect(await storage.load('map-1')).toBeNull()
  })

  it('壊れたエントリは一覧から除外し、他のキーには影響しない', async () => {
    const storage = createLocalStorageStorage()
    await storage.save('ok', createMindMap('正常'))
    localStorage.setItem('mindmap.map.broken', '{not json')
    localStorage.setItem('unrelated', 'value')

    const summaries = await storage.list()

    expect(summaries.map((s) => s.id)).toEqual(['ok'])
  })

  it('保存先は localStorage であることを説明する', async () => {
    const storage = createLocalStorageStorage()

    expect(storage.kind).toBe('localStorage')
    expect(await storage.describeLocation()).toContain('localStorage')
  })
})
