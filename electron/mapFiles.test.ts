// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteMap, listMaps, readMap, resolveDataDir, writeMap } from './mapFiles'

const ORIGINAL_ENV = { ...process.env }
const ORIGINAL_PLATFORM = process.platform

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  setPlatform(ORIGINAL_PLATFORM)
})

describe('resolveDataDir', () => {
  it('MINDMAP_DATA_DIR が設定されていれば、それを優先する', () => {
    process.env.MINDMAP_DATA_DIR = path.join('tmp', 'custom')

    expect(resolveDataDir()).toBe(path.resolve('tmp', 'custom'))
  })

  it('Windows では LOCALAPPDATA 配下の mindmap を使う', () => {
    delete process.env.MINDMAP_DATA_DIR
    setPlatform('win32')
    process.env.LOCALAPPDATA = path.join('C:', 'Users', 'me', 'AppData', 'Local')

    expect(resolveDataDir()).toBe(path.join('C:', 'Users', 'me', 'AppData', 'Local', 'mindmap'))
  })

  it('macOS では ~/Library/Application Support/mindmap を使う', () => {
    delete process.env.MINDMAP_DATA_DIR
    setPlatform('darwin')

    expect(resolveDataDir()).toBe(
      path.join(os.homedir(), 'Library', 'Application Support', 'mindmap'),
    )
  })

  it('Linux では XDG_DATA_HOME があればそれを、無ければ ~/.local/share を使う', () => {
    delete process.env.MINDMAP_DATA_DIR
    setPlatform('linux')

    process.env.XDG_DATA_HOME = path.join('/', 'data')
    expect(resolveDataDir()).toBe(path.join('/', 'data', 'mindmap'))

    delete process.env.XDG_DATA_HOME
    expect(resolveDataDir()).toBe(path.join(os.homedir(), '.local', 'share', 'mindmap'))
  })
})

describe('マップファイルの読み書き', () => {
  let dataDir: string

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), 'mindmap-test-'))
    process.env.MINDMAP_DATA_DIR = dataDir
  })

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true })
  })

  it('書き込んだ XML を同じ内容で読み戻せ、一覧に id と更新日時が載る', async () => {
    await writeMap('map-1', '<mindmap/>')

    expect(await readMap('map-1')).toBe('<mindmap/>')
    const list = await listMaps()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('map-1')
    expect(list[0].updatedAt).toBeGreaterThan(0)
  })

  it('存在しないマップを読むと null を返す', async () => {
    expect(await readMap('missing')).toBeNull()
  })

  it('削除すると一覧から消える。存在しないマップの削除はエラーにならない', async () => {
    await writeMap('map-1', '<mindmap/>')

    await deleteMap('map-1')
    await deleteMap('map-1')

    expect(await listMaps()).toEqual([])
  })

  it('上書きすると新しい内容になり、一時ファイルは残らない', async () => {
    await writeMap('map-1', '<mindmap version="1"/>')

    await writeMap('map-1', '<mindmap version="2"/>')

    expect(await readMap('map-1')).toBe('<mindmap version="2"/>')
    expect((await listMaps()).map((f) => f.id)).toEqual(['map-1'])
  })

  it('パス区切りなど不正な文字を含む id は拒否する', async () => {
    await expect(writeMap('../escape', '<mindmap/>')).rejects.toThrow('不正なマップID')
    await expect(readMap('a/b')).rejects.toThrow('不正なマップID')
  })
})
