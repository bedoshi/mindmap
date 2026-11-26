import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MapLibrary } from '../hooks/useMapLibrary'
import { addChild, addTableChild, createMindMap, toggleCollapse } from '../model/mindmap'
import type { MindMap } from '../model/types'
import { titleOf } from '../storage/xml'
import { MindMapEditor } from './MindMapEditor'

/** useMapLibrary のテストダブル。保存や一覧操作はすべてモック関数にする */
function createLibrary(map: MindMap, overrides: Partial<MapLibrary> = {}): MapLibrary {
  return {
    storageKind: 'localStorage',
    location: 'テスト用の保存先',
    maps: [{ id: 'm1', title: 'テストマップ', updatedAt: Date.now() }],
    current: { id: 'm1', map },
    status: 'ready',
    errorMessage: null,
    saveState: 'saved',
    reportChange: vi.fn(),
    saveNow: vi.fn(async () => true),
    openMap: vi.fn(async () => {}),
    createMap: vi.fn(async () => {}),
    deleteMap: vi.fn(async () => {}),
    clearError: vi.fn(),
    ...overrides,
  }
}

function renderEditor(map: MindMap = createMindMap('中心')) {
  const library = createLibrary(map)
  const { container } = render(<MindMapEditor initialMap={map} library={library} />)
  return { library, container }
}

describe('MindMapEditor', () => {
  it('ルートが選択された状態で Tab を押すと入力欄が開き、Enter で確定すると子ノードが表示される', async () => {
    const user = userEvent.setup()
    const { library } = renderEditor()

    await user.keyboard('{Tab}')
    const input = screen.getByRole('textbox')
    await user.type(input, 'Frontend{Enter}')

    expect(screen.getByText('Frontend')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    const reported = vi.mocked(library.reportChange).mock.lastCall?.[0]
    expect(reported && Object.values(reported.nodes).map((n) => n.text)).toContain('Frontend')
  })

  it('空のまま Esc を押すと、追加した末端ノードは削除される', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.keyboard('{Tab}')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText('（空）')).not.toBeInTheDocument()
  })

  it('ルートを選択しているときは削除ボタンが無効で、子を選択すると有効になる', async () => {
    const user = userEvent.setup()
    const base = createMindMap('中心')
    renderEditor(addChild(base, base.rootId, 'c1', '子'))

    const deleteButton = screen.getByRole('button', { name: '削除' })
    expect(deleteButton).toBeDisabled()

    await user.click(screen.getByText('子'))

    expect(deleteButton).toBeEnabled()
  })

  it('子ノードを選択して Delete を押すと、そのノードが消える', async () => {
    const user = userEvent.setup()
    const base = createMindMap('中心')
    renderEditor(addChild(base, base.rootId, 'c1', '消える子'))

    await user.click(screen.getByText('消える子'))
    await user.keyboard('{Delete}')

    expect(screen.queryByText('消える子')).not.toBeInTheDocument()
  })

  it('Ctrl+S を押すと、その場で保存される', async () => {
    const user = userEvent.setup()
    const { library } = renderEditor()

    await user.keyboard('{Control>}s{/Control}')

    expect(library.saveNow).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('保存しました')).toBeInTheDocument()
  })

  it('「マップ」ボタンを押すと一覧パネルが開き、マップ名と保存先が表示される', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: '☰ マップ' }))

    expect(screen.getByRole('heading', { name: 'マップ' })).toBeInTheDocument()
    expect(screen.getByText('テストマップ')).toBeInTheDocument()
    expect(screen.getByText('テスト用の保存先')).toBeInTheDocument()
  })

  it('一覧の「新規マップ」を押すと、ライブラリの createMap が呼ばれる', async () => {
    const user = userEvent.setup()
    const { library } = renderEditor()
    await user.click(screen.getByRole('button', { name: '☰ マップ' }))

    await user.click(screen.getByRole('button', { name: '＋ 新規マップ' }))

    expect(library.createMap).toHaveBeenCalledTimes(1)
  })

  it('一覧の削除ボタンは確認ダイアログで OK したときだけ deleteMap を呼ぶ', async () => {
    const user = userEvent.setup()
    const { library } = renderEditor()
    const confirm = vi.spyOn(window, 'confirm')
    await user.click(screen.getByRole('button', { name: '☰ マップ' }))
    const panel = screen.getByRole('complementary', { name: 'マップ一覧' })

    confirm.mockReturnValue(false)
    await user.click(within(panel).getByRole('button', { name: '削除' }))
    expect(library.deleteMap).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    await user.click(within(panel).getByRole('button', { name: '削除' }))
    expect(library.deleteMap).toHaveBeenCalledWith('m1')
  })

  it('Undo ボタンは変更前は無効で、変更後に押すと元に戻る', async () => {
    const user = userEvent.setup()
    renderEditor()
    const undoButton = screen.getByRole('button', { name: '↶' })
    expect(undoButton).toBeDisabled()

    await user.keyboard('{Tab}')
    await user.type(screen.getByRole('textbox'), '一時的{Enter}')
    await user.click(undoButton)

    expect(screen.queryByText('一時的')).not.toBeInTheDocument()
  })

  it('余白をダブルクリックするとフローティングノードが作られ、すぐ入力できる', async () => {
    const user = userEvent.setup()
    const { library, container } = renderEditor()

    await user.dblClick(container.querySelector('.canvas')!)
    await user.type(screen.getByRole('textbox'), '浮遊{Enter}')

    expect(screen.getByText('浮遊')).toBeInTheDocument()
    const reported = vi.mocked(library.reportChange).mock.lastCall?.[0]
    expect(reported?.floatingRootIds).toHaveLength(1)
    const floating = reported!.nodes[reported!.floatingRootIds[0]]
    expect(floating).toMatchObject({ text: '浮遊', parentId: null })
    expect(typeof floating.x).toBe('number')
    expect(typeof floating.y).toBe('number')
  })

  /**
   * ダブルクリックは pointerdown 2 回で判定する。user-event の dblClick は jsdom 上で、
   * 2 回目の pointerdown で入れ替わった要素の代わりに body へフォーカスを移してしまう（ブラウザとは異なる）ため、
   * イベントを直接送り、直後の mousedown の既定動作（フォーカス移動・文字の選択）が止められることを確かめる
   */
  function doubleTap(element: HTMLElement) {
    fireEvent.pointerDown(element, { button: 0, pointerId: 1 })
    fireEvent.pointerUp(element, { button: 0, pointerId: 1 })
    fireEvent.pointerDown(element, { button: 0, pointerId: 1 })
  }

  it('ノードをダブルクリックすると既存のテキストが全選択された状態で編集が始まり、入力で置き換えられる', async () => {
    const user = userEvent.setup()
    const base = createMindMap('中心')
    const map = addChild(base, base.rootId, 'a', '既存のテキスト')
    const { library } = renderEditor(map)

    doubleTap(screen.getByText('既存のテキスト'))

    const input = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(input).toHaveFocus()
    expect(input.value).toBe('既存のテキスト')
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, '既存のテキスト'.length])
    // 続く mousedown の既定動作は止められ、全選択が保たれる
    expect(fireEvent.mouseDown(input)).toBe(false)

    await user.keyboard('新しい{Enter}')

    expect(screen.getByText('新しい')).toBeInTheDocument()
    expect(vi.mocked(library.reportChange).mock.lastCall?.[0].nodes.a.text).toBe('新しい')
  })

  it('テーブルのセルをダブルクリックすると、セルの内容が全選択された状態で編集が始まる', () => {
    const base = createMindMap('中心')
    const map = addTableChild(base, base.rootId, 't', [
      ['項目', '値'],
      ['x', 'y'],
    ])
    renderEditor(map)

    doubleTap(screen.getByText('項目'))

    const input = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(input).toHaveFocus()
    expect(input.value).toBe('項目')
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, '項目'.length])
    expect(fireEvent.mouseDown(input)).toBe(false)
  })

  it('1 回のクリックではフローティングノードは作られず、作った直後に空のまま Esc すると取り消される', async () => {
    const user = userEvent.setup()
    const { library, container } = renderEditor()
    const canvas = container.querySelector('.canvas')!

    await user.click(canvas)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await user.dblClick(canvas)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    const reported = vi.mocked(library.reportChange).mock.lastCall?.[0]
    expect(reported?.floatingRootIds ?? []).toHaveLength(0)
  })

  it('フローティングノードは削除でき、メインのルートは削除できない', async () => {
    const user = userEvent.setup()
    const { library, container } = renderEditor()
    await user.dblClick(container.querySelector('.canvas')!)
    await user.type(screen.getByRole('textbox'), '浮遊{Enter}')

    await user.click(screen.getByRole('button', { name: '削除' }))

    expect(screen.queryByText('浮遊')).not.toBeInTheDocument()
    expect(vi.mocked(library.reportChange).mock.lastCall?.[0].floatingRootIds).toEqual([])
    expect(screen.getByRole('button', { name: '削除' })).toBeDisabled()
  })

  it('画像書き出しは、PNG 画像を作れない環境ではエラーメッセージを表示する（jsdom では Canvas が使えない）', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: '画像書き出し' }))

    expect(await screen.findByText('画像の書き出しに失敗しました')).toBeInTheDocument()
  })

  describe('複数行のテキスト', () => {
    it('子ノードの編集中に Shift+Enter を押すと改行され、Enter で確定する', async () => {
      const user = userEvent.setup()
      const { library } = renderEditor()

      await user.keyboard('{Tab}')
      await user.type(screen.getByRole('textbox'), '1 行目{Shift>}{Enter}{/Shift}2 行目')
      expect(screen.getByRole('textbox')).toHaveValue('1 行目\n2 行目')
      await user.keyboard('{Enter}')

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      const reported = vi.mocked(library.reportChange).mock.lastCall?.[0]
      expect(Object.values(reported!.nodes).map((n) => n.text)).toContain('1 行目\n2 行目')
    })

    it('フローティングノードでも Shift+Enter で改行できる', async () => {
      const user = userEvent.setup()
      const { library, container } = renderEditor()

      await user.dblClick(container.querySelector('.canvas')!)
      await user.type(screen.getByRole('textbox'), '上{Shift>}{Enter}{/Shift}下{Enter}')

      const reported = vi.mocked(library.reportChange).mock.lastCall?.[0]
      expect(reported!.nodes[reported!.floatingRootIds[0]].text).toBe('上\n下')
    })

    it('メインのルートでも Shift+Enter で改行でき、マップのタイトルは改行を空白にしたものになる', async () => {
      const user = userEvent.setup()
      const { library } = renderEditor()

      await user.keyboard('{F2}')
      await user.type(screen.getByRole('textbox'), '{End}{Shift>}{Enter}{/Shift}2 行目{Enter}')

      const reported = vi.mocked(library.reportChange).mock.lastCall?.[0]
      expect(reported!.nodes[reported!.rootId].text).toBe('中心\n2 行目')
      expect(titleOf(reported!)).toBe('中心 2 行目')
    })

    it('テーブルのセルでも Shift+Enter で改行できる', async () => {
      const user = userEvent.setup()
      const { library } = renderEditor()

      await user.pointer({ keys: '[MouseRight]', target: screen.getByText('中心') })
      await user.click(screen.getByRole('menuitem', { name: '子にテーブルを追加' }))
      await user.type(
        screen.getByRole('textbox', { name: 'セル 1 行 1 列' }),
        '上{Shift>}{Enter}{/Shift}下{Enter}',
      )

      const reported = vi.mocked(library.reportChange).mock.lastCall?.[0]
      const table = Object.values(reported!.nodes).find((n) => n.table)
      expect(table?.table?.[0][0]).toBe('上\n下')
    })
  })

  describe('右クリックメニューとテーブル', () => {
    /** 最後に通知されたマップのノード t のテーブル */
    const reportedTable = (library: MapLibrary, id: string) =>
      vi.mocked(library.reportChange).mock.lastCall?.[0].nodes[id]?.table

    const tableMap = () => {
      const base = createMindMap('中心')
      return addTableChild(base, base.rootId, 't', [
        ['A', 'B'],
        ['C', 'D'],
      ])
    }

    it('ノードを右クリックして「子にテーブルを追加」を選ぶと、先頭のセルが編集状態になり Tab で次のセルへ移る', async () => {
      const user = userEvent.setup()
      const { library } = renderEditor()

      await user.pointer({ keys: '[MouseRight]', target: screen.getByText('中心') })
      await user.click(screen.getByRole('menuitem', { name: '子にテーブルを追加' }))

      const first = screen.getByRole('textbox', { name: 'セル 1 行 1 列' })
      expect(first).toHaveFocus()
      await user.type(first, '名前{Tab}')
      await user.type(screen.getByRole('textbox', { name: 'セル 1 行 2 列' }), '値{Enter}')

      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      const reported = vi.mocked(library.reportChange).mock.lastCall?.[0]
      const table = Object.values(reported!.nodes).find((n) => n.table)
      expect(table?.table).toEqual([
        ['名前', '値'],
        ['', ''],
      ])
      expect(table?.text).toBe('')
    })

    it('テキストのノードのメニューには行・列の操作が無く、テーブルノードのメニューにはある', async () => {
      const user = userEvent.setup()
      renderEditor(tableMap())

      await user.pointer({ keys: '[MouseRight]', target: screen.getByText('中心') })
      expect(screen.getByRole('menuitem', { name: '子ノードを追加' })).toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: '下に行を追加' })).not.toBeInTheDocument()
      // メインのルートは削除できない
      expect(screen.getByRole('menuitem', { name: 'ノードを削除' })).toBeDisabled()
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()

      await user.pointer({ keys: '[MouseRight]', target: screen.getByText('A') })
      for (const name of ['上に行を追加', '下に行を追加', '行を削除', '左に列を追加', '右に列を追加', '列を削除']) {
        expect(screen.getByRole('menuitem', { name })).toBeEnabled()
      }
    })

    it('右クリックしたセルを基準に行・列を追加・削除できる', async () => {
      const user = userEvent.setup()
      const { library } = renderEditor(tableMap())

      await user.pointer({ keys: '[MouseRight]', target: screen.getByText('A') })
      await user.click(screen.getByRole('menuitem', { name: '下に行を追加' }))
      expect(reportedTable(library, 't')).toEqual([
        ['A', 'B'],
        ['', ''],
        ['C', 'D'],
      ])

      await user.pointer({ keys: '[MouseRight]', target: screen.getByText('D') })
      await user.click(screen.getByRole('menuitem', { name: '右に列を追加' }))
      expect(reportedTable(library, 't')).toEqual([
        ['A', 'B', ''],
        ['', '', ''],
        ['C', 'D', ''],
      ])

      await user.pointer({ keys: '[MouseRight]', target: screen.getByText('C') })
      await user.click(screen.getByRole('menuitem', { name: '行を削除' }))
      await user.pointer({ keys: '[MouseRight]', target: screen.getByText('A') })
      await user.click(screen.getByRole('menuitem', { name: '列を削除' }))
      expect(reportedTable(library, 't')).toEqual([
        ['B', ''],
        ['', ''],
      ])
    })

    it('1 行（1 列）しかないときは、行（列）の削除を選べない', async () => {
      const user = userEvent.setup()
      const base = createMindMap('中心')
      renderEditor(addTableChild(base, base.rootId, 't', [['唯一']]))

      await user.pointer({ keys: '[MouseRight]', target: screen.getByText('唯一') })

      expect(screen.getByRole('menuitem', { name: '行を削除' })).toBeDisabled()
      expect(screen.getByRole('menuitem', { name: '列を削除' })).toBeDisabled()
    })

    it('テーブルノードを選択して F2 を押すと先頭のセルを編集でき、Esc で取り消せる', async () => {
      const user = userEvent.setup()
      const { library } = renderEditor(tableMap())

      await user.click(screen.getByText('B'))
      await user.keyboard('{F2}')
      const input = screen.getByRole('textbox', { name: 'セル 1 行 1 列' })
      await user.clear(input)
      await user.type(input, '変更{Escape}')

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(screen.getByText('A')).toBeInTheDocument()
      expect(library.reportChange).not.toHaveBeenCalled()
    })

    it('余白を右クリックするとフローティングノード・テーブルの追加メニューが開き、ノードの操作は出ない', async () => {
      const user = userEvent.setup()
      const { container } = renderEditor()

      await user.pointer({ keys: '[MouseRight]', target: container.querySelector('.canvas')! })

      const items = screen.getAllByRole('menuitem').map((item) => item.textContent)
      expect(items).toEqual(['フローティングノードを追加', 'テーブルを追加'])
    })

    it('余白の右クリックメニューの「テーブルを追加」で、テーブルのフローティングノードを作って先頭のセルを編集できる', async () => {
      const user = userEvent.setup()
      const { library, container } = renderEditor()

      await user.pointer({ keys: '[MouseRight]', target: container.querySelector('.canvas')! })
      await user.click(screen.getByRole('menuitem', { name: 'テーブルを追加' }))
      await user.type(screen.getByRole('textbox', { name: 'セル 1 行 1 列' }), '浮遊表{Enter}')

      const reported = vi.mocked(library.reportChange).mock.lastCall?.[0]
      expect(reported?.floatingRootIds).toHaveLength(1)
      const floating = reported!.nodes[reported!.floatingRootIds[0]]
      expect(floating).toMatchObject({ text: '', parentId: null })
      expect(floating.table).toEqual([
        ['浮遊表', ''],
        ['', ''],
      ])
      expect(typeof floating.x).toBe('number')
    })

    it('余白の右クリックメニューの「フローティングノードを追加」で、テキストのフローティングノードを作れる', async () => {
      const user = userEvent.setup()
      const { library, container } = renderEditor()

      await user.pointer({ keys: '[MouseRight]', target: container.querySelector('.canvas')! })
      await user.click(screen.getByRole('menuitem', { name: 'フローティングノードを追加' }))
      await user.type(screen.getByRole('textbox'), '浮遊{Enter}')

      const reported = vi.mocked(library.reportChange).mock.lastCall?.[0]
      const floating = reported!.nodes[reported!.floatingRootIds[0]]
      expect(floating).toMatchObject({ text: '浮遊', parentId: null })
      expect(floating.table).toBeUndefined()
    })

    it('テーブルのフローティングノードはメニューから削除できる', async () => {
      const user = userEvent.setup()
      const { library, container } = renderEditor()
      await user.pointer({ keys: '[MouseRight]', target: container.querySelector('.canvas')! })
      await user.click(screen.getByRole('menuitem', { name: 'テーブルを追加' }))
      await user.type(screen.getByRole('textbox', { name: 'セル 1 行 1 列' }), '消す{Enter}')

      await user.pointer({ keys: '[MouseRight]', target: screen.getByText('消す') })
      await user.click(screen.getByRole('menuitem', { name: 'テーブルを削除' }))

      expect(screen.queryByText('消す')).not.toBeInTheDocument()
      expect(vi.mocked(library.reportChange).mock.lastCall?.[0].floatingRootIds).toEqual([])
    })

    it('メニューの「テーブルを削除」でテーブルノードを削除できる', async () => {
      const user = userEvent.setup()
      renderEditor(tableMap())

      await user.pointer({ keys: '[MouseRight]', target: screen.getByText('A') })
      await user.click(screen.getByRole('menuitem', { name: 'テーブルを削除' }))

      expect(screen.queryByText('A')).not.toBeInTheDocument()
    })
  })

  describe('マップ内検索', () => {
    const searchMap = () => {
      let map = createMindMap('計画')
      map = addChild(map, map.rootId, 'a', '設計の計画')
      map = addChild(map, 'a', 'a1', '詳細計画')
      map = addChild(map, map.rootId, 'b', '実装')
      return toggleCollapse(map, 'a')
    }
    const hits = (container: HTMLElement) =>
      Array.from(container.querySelectorAll('mark.search-hit')).map((m) => m.textContent)
    const selectedText = (container: HTMLElement) =>
      container.querySelector('.node.selected')?.textContent

    it('Ctrl+F で検索欄が開き、一致した部分が黄色のハイライト（mark）になって最初の結果が選択される', async () => {
      const user = userEvent.setup()
      const { container } = renderEditor(searchMap())

      await user.keyboard('{Control>}f{/Control}')
      const input = screen.getByRole('textbox', { name: 'マップ内を検索' })
      expect(input).toHaveFocus()
      await user.type(input, '計画')

      expect(screen.getByText('1 / 3')).toBeInTheDocument()
      expect(hits(container)).toEqual(['計画', '計画'])
      expect(selectedText(container)).toBe('計画')
    })

    it('Enter・↓ で次、Shift+Enter・↑ で前の結果へ移り、端では反対の端に戻る', async () => {
      const user = userEvent.setup()
      const { container } = renderEditor(searchMap())
      await user.keyboard('{Control>}f{/Control}')
      await user.type(screen.getByRole('textbox', { name: 'マップ内を検索' }), '計画')

      await user.keyboard('{Enter}')
      expect(screen.getByText('2 / 3')).toBeInTheDocument()
      expect(selectedText(container)).toContain('設計の計画')

      await user.click(screen.getByRole('button', { name: '次の検索結果' }))
      expect(screen.getByText('3 / 3')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: '次の検索結果' }))
      expect(screen.getByText('1 / 3')).toBeInTheDocument()

      await user.click(screen.getByRole('textbox', { name: 'マップ内を検索' }))
      await user.keyboard('{Shift>}{Enter}{/Shift}')
      expect(screen.getByText('3 / 3')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: '前の検索結果' }))
      expect(screen.getByText('2 / 3')).toBeInTheDocument()
    })

    it('折りたたまれたノードが検索結果になると、祖先を展開して表示する', async () => {
      const user = userEvent.setup()
      const { container, library } = renderEditor(searchMap())
      expect(screen.queryByText('詳細計画')).not.toBeInTheDocument()

      await user.keyboard('{Control>}f{/Control}')
      await user.type(screen.getByRole('textbox', { name: 'マップ内を検索' }), '詳細')

      expect(selectedText(container)).toBe('詳細計画')
      expect(hits(container)).toEqual(['詳細'])
      expect(vi.mocked(library.reportChange).mock.lastCall?.[0].nodes['a'].collapsed).toBe(false)
    })

    it('テーブルのセルの一致部分もハイライトする', async () => {
      const user = userEvent.setup()
      const base = createMindMap('中心')
      const { container } = renderEditor(addTableChild(base, base.rootId, 't', [['予算計画', 'x']]))

      await user.keyboard('{Control>}f{/Control}')
      await user.type(screen.getByRole('textbox', { name: 'マップ内を検索' }), '計画')

      expect(screen.getByText('1 / 1')).toBeInTheDocument()
      expect(hits(container)).toEqual(['計画'])
    })

    it('一致が無いときは 0 件と表示し、前後のボタンは押せない', async () => {
      const user = userEvent.setup()
      renderEditor(searchMap())

      await user.keyboard('{Control>}f{/Control}')
      await user.type(screen.getByRole('textbox', { name: 'マップ内を検索' }), '存在しない')

      expect(screen.getByText('0 件')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '次の検索結果' })).toBeDisabled()
    })

    it('Esc で検索を終え、検索欄とハイライトが消える', async () => {
      const user = userEvent.setup()
      const { container } = renderEditor(searchMap())
      await user.keyboard('{Control>}f{/Control}')
      await user.type(screen.getByRole('textbox', { name: 'マップ内を検索' }), '計画')

      await user.keyboard('{Escape}')

      expect(screen.queryByRole('search')).not.toBeInTheDocument()
      expect(hits(container)).toEqual([])
    })

    it('検索欄の外（ノードの選択後など）で Esc を押しても検索を終える', async () => {
      const user = userEvent.setup()
      renderEditor(searchMap())
      await user.keyboard('{Control>}f{/Control}')
      await user.type(screen.getByRole('textbox', { name: 'マップ内を検索' }), '実装')
      await user.click(screen.getByText('実装'))

      await user.keyboard('{Escape}')

      expect(screen.queryByRole('search')).not.toBeInTheDocument()
    })

    it('マップの何も無い所をクリックすると検索を終える。ノードのクリックでは終えない', async () => {
      const user = userEvent.setup()
      const { container } = renderEditor(searchMap())
      await user.keyboard('{Control>}f{/Control}')
      await user.type(screen.getByRole('textbox', { name: 'マップ内を検索' }), '計画')

      await user.click(screen.getByText('実装'))
      expect(screen.getByRole('search')).toBeInTheDocument()

      await user.click(container.querySelector('.canvas')!)
      expect(screen.queryByRole('search')).not.toBeInTheDocument()
    })

    it('検索欄を閉じても検索語は残らず、もう一度 Ctrl+F で空の検索欄が開く', async () => {
      const user = userEvent.setup()
      renderEditor(searchMap())
      await user.keyboard('{Control>}f{/Control}')
      await user.type(screen.getByRole('textbox', { name: 'マップ内を検索' }), '計画')
      await user.click(screen.getByRole('button', { name: '検索を閉じる' }))

      await user.keyboard('{Control>}f{/Control}')

      expect(screen.getByRole('textbox', { name: 'マップ内を検索' })).toHaveValue('')
    })
  })
})
