import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createMindMap, updateText } from '../model/mindmap'
import type { MindMap } from '../model/types'
import type { MapStorage } from '../storage'
import { titleOf } from '../storage/xml'
import { useMapLibrary } from './useMapLibrary'

interface Entry {
  map: MindMap
  updatedAt: number
}

/** メモリ上に保存する MapStorage のテストダブル */
function createFakeStorage(initial: Record<string, Entry> = {}) {
  const data = new Map<string, Entry>(Object.entries(initial))
  const storage: MapStorage = {
    kind: 'localStorage',
    describeLocation: async () => 'メモリ',
    list: async () =>
      [...data.entries()].map(([id, entry]) => ({
        id,
        title: titleOf(entry.map),
        updatedAt: entry.updatedAt,
      })),
    load: async (id) => data.get(id)?.map ?? null,
    save: async (id, map) => {
      data.set(id, { map, updatedAt: Date.now() })
    },
    remove: async (id) => {
      data.delete(id)
    },
  }
  return { storage, data }
}

async function renderReady(storage: MapStorage) {
  const rendered = renderHook(() => useMapLibrary(storage))
  await waitFor(() => expect(rendered.result.current.status).toBe('ready'))
  return rendered
}

describe('useMapLibrary', () => {
  it('保存済みのマップが無いとき、新しいマップを作って開く', async () => {
    const { storage, data } = createFakeStorage()

    const { result } = await renderReady(storage)

    expect(result.current.maps).toHaveLength(1)
    expect(result.current.current?.id).toBe(result.current.maps[0].id)
    expect(data.size).toBe(1)
    expect(result.current.location).toBe('メモリ')
  })

  it('複数のマップがあるとき、更新日時が最新のマップを開く', async () => {
    const { storage } = createFakeStorage({
      old: { map: createMindMap('古い'), updatedAt: 1000 },
      recent: { map: createMindMap('新しい'), updatedAt: 2000 },
    })

    const { result } = await renderReady(storage)

    expect(result.current.current?.id).toBe('recent')
    expect(result.current.maps.map((m) => m.id)).toEqual(['recent', 'old'])
  })

  it('変更を通知すると、しばらく待ったあと自動保存される', async () => {
    const { storage, data } = createFakeStorage({
      m1: { map: createMindMap('元'), updatedAt: 1000 },
    })
    const { result } = await renderReady(storage)
    const original = result.current.current!.map
    const edited = updateText(original, original.rootId, '変更後')

    act(() => result.current.reportChange(edited))

    expect(result.current.saveState).toBe('dirty')
    await waitFor(() => expect(result.current.saveState).toBe('saved'), { timeout: 3000 })
    expect(data.get('m1')?.map).toBe(edited)
    expect(result.current.maps[0].title).toBe('変更後')
  })

  it('saveNow を呼ぶと、待たずにその場で保存される', async () => {
    const { storage, data } = createFakeStorage({
      m1: { map: createMindMap('元'), updatedAt: 1000 },
    })
    const { result } = await renderReady(storage)
    const edited = updateText(result.current.current!.map, result.current.current!.map.rootId, '即時')
    act(() => result.current.reportChange(edited))

    let saved = false
    await act(async () => {
      saved = await result.current.saveNow()
    })

    expect(saved).toBe(true)
    expect(data.get('m1')?.map).toBe(edited)
    expect(result.current.saveState).toBe('saved')
  })

  it('保存に失敗すると saveState が error になり、エラーメッセージが設定される', async () => {
    const { storage } = createFakeStorage({
      m1: { map: createMindMap('元'), updatedAt: 1000 },
    })
    vi.spyOn(storage, 'save').mockRejectedValue(new Error('ディスクが一杯です'))
    const { result } = await renderReady(storage)
    const edited = updateText(result.current.current!.map, result.current.current!.map.rootId, 'x')
    act(() => result.current.reportChange(edited))

    await act(async () => {
      await result.current.saveNow()
    })

    expect(result.current.saveState).toBe('error')
    expect(result.current.errorMessage).toContain('ディスクが一杯です')
  })

  it('createMap で新しいマップが一覧に追加され、そのマップが開く', async () => {
    const { storage, data } = createFakeStorage({
      m1: { map: createMindMap('元'), updatedAt: 1000 },
    })
    const { result } = await renderReady(storage)

    await act(async () => {
      await result.current.createMap(createMindMap('取り込んだマップ'))
    })

    expect(result.current.maps).toHaveLength(2)
    expect(result.current.current?.id).not.toBe('m1')
    expect(titleOf(result.current.current!.map)).toBe('取り込んだマップ')
    expect(data.size).toBe(2)
  })

  it('openMap で別のマップに切り替えられる', async () => {
    const { storage } = createFakeStorage({
      old: { map: createMindMap('古い'), updatedAt: 1000 },
      recent: { map: createMindMap('新しい'), updatedAt: 2000 },
    })
    const { result } = await renderReady(storage)

    await act(async () => {
      await result.current.openMap('old')
    })

    expect(result.current.current?.id).toBe('old')
    expect(titleOf(result.current.current!.map)).toBe('古い')
  })

  it('開いているマップを削除すると、残っているマップが開く', async () => {
    const { storage, data } = createFakeStorage({
      old: { map: createMindMap('古い'), updatedAt: 1000 },
      recent: { map: createMindMap('新しい'), updatedAt: 2000 },
    })
    const { result } = await renderReady(storage)

    await act(async () => {
      await result.current.deleteMap('recent')
    })

    expect(data.has('recent')).toBe(false)
    expect(result.current.maps.map((m) => m.id)).toEqual(['old'])
    expect(result.current.current?.id).toBe('old')
  })

  it('最後のマップを削除すると、新しい空のマップが作られる', async () => {
    const { storage, data } = createFakeStorage({
      only: { map: createMindMap('唯一'), updatedAt: 1000 },
    })
    const { result } = await renderReady(storage)

    await act(async () => {
      await result.current.deleteMap('only')
    })

    expect(data.has('only')).toBe(false)
    expect(result.current.maps).toHaveLength(1)
    expect(result.current.current?.id).not.toBe('only')
  })
})
