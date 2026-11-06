import { describe, expect, it } from 'vitest'
import { addChild, createMindMap, toggleCollapse } from '../model/mindmap'
import { mindMapToXml, titleOf, xmlToMindMap } from './xml'

function buildMap() {
  let map = createMindMap('中心')
  const rootId = map.rootId
  map = addChild(map, rootId, 'a', '右の子')
  map = addChild(map, rootId, 'b', '左の子')
  map = addChild(map, 'a', 'a1', '孫')
  map = toggleCollapse(map, 'a')
  return { map, rootId }
}

describe('mindMapToXml', () => {
  it('XML 宣言と mindmap 要素、入れ子の node 要素を出力する', () => {
    const { map, rootId } = buildMap()

    const xml = mindMapToXml(map)

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<mindmap version="1">')).toBe(
      true,
    )
    expect(xml).toContain(`<node id="${rootId}" text="中心">`)
    expect(xml).toContain('<node id="a" text="右の子" side="right" collapsed="true">')
    expect(xml).toContain('<node id="a1" text="孫"/>')
    expect(xml).toContain('<node id="b" text="左の子" side="left"/>')
  })

  it('属性に使えない文字をエスケープする', () => {
    const map = createMindMap('a<b>&"c"\n2行目')

    const xml = mindMapToXml(map)

    expect(xml).toContain('text="a&lt;b&gt;&amp;&quot;c&quot;&#10;2行目"')
  })
})

describe('xmlToMindMap', () => {
  it('mindMapToXml の出力を読み込むと、元のマップと等しくなる', () => {
    const { map } = buildMap()

    const restored = xmlToMindMap(mindMapToXml(map))

    expect(restored).toEqual(map)
  })

  it('エスケープされたテキストを元に戻す', () => {
    const map = createMindMap('a<b>&"c"\n2行目')

    const restored = xmlToMindMap(mindMapToXml(map))

    expect(restored.nodes[restored.rootId].text).toBe('a<b>&"c"\n2行目')
  })

  it('id が無いノードや重複したノードには新しい id を振る', () => {
    const xml = `<mindmap version="1">
      <node text="root">
        <node id="dup" text="one"/>
        <node id="dup" text="two"/>
      </node>
    </mindmap>`

    const map = xmlToMindMap(xml)

    const root = map.nodes[map.rootId]
    expect(root.text).toBe('root')
    expect(root.children).toHaveLength(2)
    expect(root.children[0]).toBe('dup')
    expect(root.children[1]).not.toBe('dup')
    expect(map.nodes[root.children[1]].text).toBe('two')
  })

  it('ルート以外の子に付いた side は無視し、ルート直下の side だけを読み込む', () => {
    const xml = `<mindmap version="1">
      <node id="r" text="root">
        <node id="c" text="child" side="left">
          <node id="g" text="grandchild" side="left"/>
        </node>
      </node>
    </mindmap>`

    const map = xmlToMindMap(xml)

    expect(map.nodes['c'].side).toBe('left')
    expect(map.nodes['g']).not.toHaveProperty('side')
  })

  it('不正な XML はエラーになる', () => {
    expect(() => xmlToMindMap('<mindmap><node')).toThrow('XML の解析に失敗しました')
  })

  it('ルート要素が mindmap でなければエラーになる', () => {
    expect(() => xmlToMindMap('<other><node text="x"/></other>')).toThrow(/mindmap/)
  })

  it('node 要素が無ければエラーになる', () => {
    expect(() => xmlToMindMap('<mindmap version="1"></mindmap>')).toThrow('ルートノードが見つかりません')
  })
})

describe('titleOf', () => {
  it('ルートノードのテキストを返す', () => {
    expect(titleOf(createMindMap('  計画  '))).toBe('計画')
  })

  it('ルートのテキストが空なら「無題のマップ」を返す', () => {
    expect(titleOf(createMindMap(''))).toBe('無題のマップ')
  })
})
