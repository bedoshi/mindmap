import type { SaveState } from '../hooks/useMapLibrary'

interface Props {
  hasSelection: boolean
  canDelete: boolean
  canUndo: boolean
  canRedo: boolean
  zoom: number
  saveState: SaveState
  mapListOpen: boolean
  onAddChild: () => void
  onAddSibling: () => void
  onDelete: () => void
  onUndo: () => void
  onRedo: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onSave: () => void
  onExport: () => void
  onImport: () => void
  onToggleMapList: () => void
}

const SAVE_LABELS: Record<SaveState, string> = {
  saved: '保存済み',
  dirty: '未保存',
  saving: '保存中…',
  error: '保存失敗',
}

export function Toolbar(props: Props) {
  return (
    <div className="toolbar" role="toolbar" aria-label="マインドマップ操作">
      <div className="toolbar-group">
        <button
          type="button"
          className={props.mapListOpen ? 'active' : undefined}
          onClick={props.onToggleMapList}
          title="マップ一覧を開く / 閉じる"
        >
          ☰ マップ
        </button>
      </div>
      <div className="toolbar-group">
        <button type="button" onClick={props.onAddChild} disabled={!props.hasSelection} title="子ノードを追加 (Tab)">
          ＋ 子
        </button>
        <button type="button" onClick={props.onAddSibling} disabled={!props.hasSelection} title="兄弟ノードを追加 (Enter)">
          ＋ 兄弟
        </button>
        <button type="button" onClick={props.onDelete} disabled={!props.canDelete} title="ノードを削除 (Delete)">
          削除
        </button>
      </div>
      <div className="toolbar-group">
        <button type="button" onClick={props.onUndo} disabled={!props.canUndo} title="元に戻す (Ctrl+Z)">
          ↶
        </button>
        <button type="button" onClick={props.onRedo} disabled={!props.canRedo} title="やり直す (Ctrl+Y)">
          ↷
        </button>
      </div>
      <div className="toolbar-group">
        <button type="button" onClick={props.onZoomOut} title="縮小 (Ctrl+ホイール)">
          −
        </button>
        <span className="zoom-label">{Math.round(props.zoom * 100)}%</span>
        <button type="button" onClick={props.onZoomIn} title="拡大 (Ctrl+ホイール)">
          ＋
        </button>
        <button type="button" onClick={props.onFit} title="全体を表示">
          全体
        </button>
      </div>
      <div className="toolbar-group">
        <button type="button" onClick={props.onSave} title="今すぐ保存 (Ctrl+S)">
          保存
        </button>
        <span className={`save-state save-state-${props.saveState}`}>{SAVE_LABELS[props.saveState]}</span>
      </div>
      <div className="toolbar-group">
        <button type="button" onClick={props.onExport} title="XMLファイルとして書き出す">
          書き出し
        </button>
        <button type="button" onClick={props.onImport} title="XMLファイルを新しいマップとして読み込む">
          読み込み
        </button>
      </div>
    </div>
  )
}
