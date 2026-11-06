import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MapLibrary } from '../hooks/useMapLibrary'
import { addChild, createMindMap } from '../model/mindmap'
import type { MindMap } from '../model/types'
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
})
