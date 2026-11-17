// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ensurePngExtension, toDefaultImageName, writeImage } from './imageFiles'

describe('toDefaultImageName', () => {
  it('マップのタイトルに .png を付ける', () => {
    expect(toDefaultImageName('中心トピック')).toBe('中心トピック.png')
  })

  it('すでに .png で終わっていれば重ねて付けない（大文字小文字は区別しない）', () => {
    expect(toDefaultImageName('map.png')).toBe('map.png')
    expect(toDefaultImageName('MAP.PNG')).toBe('MAP.PNG')
  })

  it('ファイル名に使えない文字は _ に置き換え、パス区切りでディレクトリを指定できないようにする', () => {
    expect(toDefaultImageName('a/b:c*d')).toBe('a_b_c_d.png')
    expect(toDefaultImageName('../../etc/passwd')).toBe('.._.._etc_passwd.png')
  })

  it('空のタイトルは mindmap.png にする', () => {
    expect(toDefaultImageName('')).toBe('mindmap.png')
    expect(toDefaultImageName('   ')).toBe('mindmap.png')
  })
})

describe('ensurePngExtension', () => {
  it('拡張子が無い、または別の拡張子のパスには .png を付ける', () => {
    expect(ensurePngExtension('/tmp/map')).toBe('/tmp/map.png')
    expect(ensurePngExtension('/tmp/map.jpg')).toBe('/tmp/map.jpg.png')
  })

  it('.png で終わっていればそのまま返す', () => {
    expect(ensurePngExtension('/tmp/map.png')).toBe('/tmp/map.png')
  })
})

describe('writeImage', () => {
  let dir: string | null = null
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
    dir = null
  })

  it('バイト列をそのままファイルに書き込む', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'mindmap-image-'))
    const target = path.join(dir, 'out.png')

    await writeImage(target, new Uint8Array([0x89, 0x50, 0x4e, 0x47]))

    expect([...(await readFile(target))]).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})
