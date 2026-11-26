import { describe, expect, it } from 'vitest'
import { addChild, addFloatingRoot, addTableChild, createMindMap } from './mindmap'
import { containsQuery, findMatches, isSearchable, splitByQuery } from './search'

describe('isSearchable', () => {
  it('空や空白だけの検索語では検索しない', () => {
    expect(isSearchable('')).toBe(false)
    expect(isSearchable('  ')).toBe(false)
    expect(isSearchable('a')).toBe(true)
  })
})

describe('splitByQuery', () => {
  it('一致する部分とそれ以外に分ける。大文字・小文字は区別しない', () => {
    expect(splitByQuery('React と react', 'REACT')).toEqual([
      { text: 'React', hit: true },
      { text: ' と ', hit: false },
      { text: 'react', hit: true },
    ])
  })

  it('正規表現の記号もそのままの文字として扱う', () => {
    expect(splitByQuery('a.b (c)', '(c)')).toEqual([
      { text: 'a.b ', hit: false },
      { text: '(c)', hit: true },
    ])
    expect(containsQuery('abc', '.')).toBe(false)
  })

  it('一致が無い・検索語が空のときはテキスト全体を 1 つの断片で返す', () => {
    expect(splitByQuery('テキスト', 'x')).toEqual([{ text: 'テキスト', hit: false }])
    expect(splitByQuery('テキスト', '')).toEqual([{ text: 'テキスト', hit: false }])
  })

  it('改行をまたがない範囲で、複数行のテキストの各行の一致を見つける', () => {
    expect(splitByQuery('一行目\n二行目', '行目').filter((s) => s.hit)).toHaveLength(2)
  })
})

describe('findMatches', () => {
  function buildMap() {
    let map = createMindMap('計画')
    map = addChild(map, map.rootId, 'a', '設計の計画')
    map = addChild(map, 'a', 'a1', '関係ない')
    map = addChild(map, 'a', 'a2', '詳細計画')
    map = addChild(map, map.rootId, 'b', '実装')
    map = addTableChild(map, 'b', 't', [
      ['項目', '計画値'],
      ['x', 'y'],
    ])
    map = addFloatingRoot(map, 'f', 300, 300, '別の計画')
    return map
  }

  it('一致するノードを、メインのツリー → フローティングノードの順に深さ優先で返す', () => {
    const map = buildMap()

    expect(findMatches(map, '計画')).toEqual([map.rootId, 'a', 'a2', 't', 'f'])
  })

  it('テーブルノードはいずれかのセルが一致すれば 1 件になる', () => {
    expect(findMatches(buildMap(), 'x')).toEqual(['t'])
  })

  it('空の検索語や一致が無い場合は空配列', () => {
    expect(findMatches(buildMap(), ' ')).toEqual([])
    expect(findMatches(buildMap(), '存在しない')).toEqual([])
  })
})
