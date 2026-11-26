import { describe, expect, it } from 'vitest'
import {
  addChild,
  addFloatingRoot,
  addFloatingTable,
  addTableChild,
  createMindMap,
  moveRoot,
  toggleCollapse,
} from '../model/mindmap'
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
    expect(xml).toContain(`<node id="${rootId}" text="中心" x="0" y="0">`)
    expect(xml).toMatch(
      /<node id="a" text="右の子" x="[\d.]+" y="[\d.-]+" side="right" collapsed="true">/,
    )
    expect(xml).toMatch(/<node id="b" text="左の子" x="-[\d.]+" y="[\d.-]+" side="left"\/>/)
    // 折りたたみで非表示の孫には座標が付かない
    expect(xml).toContain('<node id="a1" text="孫"/>')
  })

  it('全ノードの中心座標を書き出し、右側の子は親より右、左側の子は親より左になる', () => {
    let map = createMindMap('中心')
    map = addChild(map, map.rootId, 'a', '右')
    map = addChild(map, map.rootId, 'b', '左')

    const xml = mindMapToXml(map)

    const x = (id: string) =>
      Number(xml.match(new RegExp(String.raw`id="${id}"[^>]* x="([\d.-]+)"`))![1])
    expect(x('a')).toBeGreaterThan(x(map.rootId))
    expect(x('b')).toBeLessThan(x(map.rootId))
  })

  it('フローティングノードを mindmap 直下に、座標付きで出力する', () => {
    let map = createMindMap('中心')
    map = addFloatingRoot(map, 'f', 300, -120, '浮遊')
    map = addChild(map, 'f', 'f1', '浮遊の子')

    const xml = mindMapToXml(map)

    expect(xml).toContain('  <node id="f" text="浮遊" x="300" y="-120">')
    expect(xml).toContain('    <node id="f1" text="浮遊の子"')
    expect(xml.indexOf(`id="${map.rootId}"`)).toBeLessThan(xml.indexOf('id="f"'))
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

  it('フローティングノードとその子孫・ルートの座標を元に戻す', () => {
    let map = createMindMap('中心')
    map = moveRoot(map, map.rootId, 40, -25)
    map = addFloatingRoot(map, 'f', 300, -120, '浮遊')
    map = addChild(map, 'f', 'f1', '浮遊の子')
    map = addFloatingRoot(map, 'g', -80, 200, '別の浮遊')

    const restored = xmlToMindMap(mindMapToXml(map))

    expect(restored).toEqual(map)
    expect(restored.floatingRootIds).toEqual(['f', 'g'])
  })

  it('ルート以外のノードの x / y は読み込まない', () => {
    const xml = `<mindmap version="1">
      <node id="r" text="root" x="abc" y="5">
        <node id="c" text="child" x="999" y="999"/>
      </node>
    </mindmap>`

    const map = xmlToMindMap(xml)

    expect(map.nodes.r.x).toBeUndefined()
    expect(map.nodes.r.y).toBe(5)
    expect(map.nodes.c.x).toBeUndefined()
    expect(map.floatingRootIds).toEqual([])
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

describe('テーブルノードの XML', () => {
  it('table / row / cell 要素として書き出し、読み込むと同じテーブルに戻る', () => {
    let map = createMindMap('中心')
    map = addTableChild(map, map.rootId, 't', [
      ['名前', '<値> & "引用"'],
      ['', '改行なし'],
    ])
    map = addChild(map, 't', 'c', 'テーブルの子')

    const xml = mindMapToXml(map)

    expect(xml).toMatch(/<node id="t" text="" [^>]*>\n\s+<table>/)
    expect(xml).toContain('<row><cell>名前</cell><cell>&lt;値&gt; &amp; "引用"</cell></row>')
    expect(xml).toContain('<row><cell/><cell>改行なし</cell></row>')
    const loaded = xmlToMindMap(xml)
    expect(loaded.nodes['t'].table).toEqual(map.nodes['t'].table)
    expect(loaded.nodes['t'].children).toEqual(['c'])
    expect(loaded.nodes['c'].text).toBe('テーブルの子')
  })

  it('子の無いテーブルノードも開始・終了タグで書き出す', () => {
    const base = createMindMap('中心')
    const xml = mindMapToXml(addTableChild(base, base.rootId, 't', [['x']]))

    expect(xml).toMatch(/<node id="t"[^>]*[^/]>\n\s+<table>\n\s+<row><cell>x<\/cell><\/row>\n\s+<\/table>\n\s+<\/node>/)
  })

  it('行ごとに列数が違う場合は空セルで揃え、行の無い table は無視する', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <mindmap version="1">
        <node id="r" text="中心">
          <node id="t" text="無視される"><table><row><cell>a</cell></row><row><cell>b</cell><cell>c</cell></row></table></node>
          <node id="e" text="空"><table/></node>
        </node>
      </mindmap>`

    const map = xmlToMindMap(xml)

    expect(map.nodes['t'].table).toEqual([
      ['a', ''],
      ['b', 'c'],
    ])
    expect(map.nodes['t'].text).toBe('')
    expect(map.nodes['e'].table).toBeUndefined()
    expect(map.nodes['e'].text).toBe('空')
  })

  it('テーブルのフローティングノードも書き出し・読み込みで元に戻る', () => {
    const map = addFloatingTable(createMindMap('中心'), 'f', 400, 300, [['x', 'y']])

    const loaded = xmlToMindMap(mindMapToXml(map))

    expect(loaded.floatingRootIds).toEqual(['f'])
    expect(loaded.nodes['f']).toMatchObject({ text: '', x: 400, y: 300, table: [['x', 'y']] })
  })

  it('メインのルートの table は無視する（テーブルノードになれるのはメインのルート以外）', () => {
    const map = xmlToMindMap(
      '<mindmap version="1"><node id="r" text="中心"><table><row><cell>a</cell></row></table></node></mindmap>',
    )

    expect(map.nodes['r'].table).toBeUndefined()
    expect(map.nodes['r'].text).toBe('中心')
  })
})
