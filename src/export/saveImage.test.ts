import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MindmapApi } from '../storage/electronApi'
import { saveImage } from './saveImage'

const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })

describe('saveImage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete window.mindmapApi
  })

  it('Web 版（window.mindmapApi なし）では、ファイル名を付けたダウンロードを開始する', async () => {
    const createObjectURL = vi.fn(() => 'blob:test')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const names: string[] = []
    const create = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = create(tag)
      if (tag === 'a') Object.defineProperty(el, 'download', {
          set: (v: string) => {
            names.push(v)
          },
          get: () => '',
        })
      return el
    })

    const result = await saveImage(blob, 'マップ.png')

    expect(result).toEqual({ status: 'saved', path: null })
    expect(click).toHaveBeenCalledTimes(1)
    expect(names).toEqual(['マップ.png'])
  })

  it('Electron 版では、保存ダイアログ経由で保存し、保存先のパスを返す', async () => {
    const api = { saveImage: vi.fn(async () => '/home/me/マップ.png') } as unknown as MindmapApi
    window.mindmapApi = api

    const result = await saveImage(blob, 'マップ.png')

    expect(result).toEqual({ status: 'saved', path: '/home/me/マップ.png' })
    const [name, data] = vi.mocked(api.saveImage).mock.calls[0]
    expect(name).toBe('マップ.png')
    expect([...data]).toEqual([1, 2, 3])
  })

  it('Electron 版でダイアログがキャンセルされたときは cancelled を返す', async () => {
    window.mindmapApi = { saveImage: vi.fn(async () => null) } as unknown as MindmapApi

    expect(await saveImage(blob, 'a.png')).toEqual({ status: 'cancelled' })
  })
})
