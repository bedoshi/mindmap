import type { MapSummary } from '../storage'

interface Props {
  open: boolean
  maps: MapSummary[]
  currentId: string | null
  location: string
  storageKind: 'localStorage' | 'file'
  onClose: () => void
  onOpen: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}

const dateFormat = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function MapListPanel({
  open,
  maps,
  currentId,
  location,
  storageKind,
  onClose,
  onOpen,
  onCreate,
  onDelete,
}: Props) {
  if (!open) return null
  return (
    <aside className="map-panel" aria-label="マップ一覧">
      <div className="map-panel-header">
        <h2>マップ</h2>
        <button type="button" onClick={onClose} title="閉じる">
          ×
        </button>
      </div>
      <button type="button" className="map-panel-create" onClick={onCreate}>
        ＋ 新規マップ
      </button>
      <ul className="map-list">
        {maps.map((summary) => (
          <li key={summary.id} className={summary.id === currentId ? 'current' : undefined}>
            <button type="button" className="map-item" onClick={() => onOpen(summary.id)}>
              <span className="map-title">{summary.title}</span>
              <span className="map-updated">{dateFormat.format(summary.updatedAt)}</span>
            </button>
            <button
              type="button"
              className="map-delete"
              title="このマップを削除"
              onClick={() => {
                if (window.confirm(`「${summary.title}」を削除しますか？この操作は取り消せません。`)) {
                  onDelete(summary.id)
                }
              }}
            >
              削除
            </button>
          </li>
        ))}
      </ul>
      <div className="map-panel-footer">
        <div>保存先</div>
        <code>{storageKind === 'file' ? location : location || 'このブラウザ内'}</code>
      </div>
    </aside>
  )
}
