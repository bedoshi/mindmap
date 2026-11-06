import { useMemo } from 'react'
import './App.css'
import { MindMapEditor } from './components/MindMapEditor'
import { useMapLibrary } from './hooks/useMapLibrary'
import { createStorage } from './storage'

function App() {
  const storage = useMemo(() => createStorage(), [])
  const library = useMapLibrary(storage)

  if (library.status === 'loading') {
    return <div className="screen-message">読み込み中…</div>
  }
  if (!library.current) {
    return (
      <div className="screen-message">
        <p>マップを開けませんでした。</p>
        {library.errorMessage && <p className="error">{library.errorMessage}</p>}
        <button type="button" onClick={() => void library.createMap()}>
          新しいマップを作成
        </button>
      </div>
    )
  }

  // key を変えてマップごとにエディタの状態（履歴・選択・表示位置）をリセットする
  return (
    <MindMapEditor
      key={library.current.id}
      initialMap={library.current.map}
      library={library}
    />
  )
}

export default App
