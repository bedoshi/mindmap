import type { MindmapApi } from './electronApi'
import type { MapStorage, MapSummary } from './types'
import { mindMapToXml, titleOf, xmlToMindMap } from './xml'

/**
 * Electron 版の保存先。preload が公開する API を通じて、
 * ユーザーデータディレクトリ配下の maps/<id>.xml に読み書きする。
 * XML の解釈はレンダラー側（このモジュール）で行い、メインプロセスはファイルの入出力だけを担当する。
 */
export function createElectronStorage(api: MindmapApi): MapStorage {
  return {
    kind: 'file',
    describeLocation() {
      return api.getDataDir()
    },
    async list() {
      const files = await api.listMaps()
      const summaries: MapSummary[] = []
      for (const file of files) {
        const xml = await api.readMap(file.id)
        if (xml === null) continue
        let title: string
        try {
          title = titleOf(xmlToMindMap(xml))
        } catch {
          title = `（読み込めないファイル: ${file.id}）`
        }
        summaries.push({ id: file.id, title, updatedAt: file.updatedAt })
      }
      return summaries
    },
    async load(id) {
      const xml = await api.readMap(id)
      return xml === null ? null : xmlToMindMap(xml)
    },
    save(id, map) {
      return api.writeMap(id, mindMapToXml(map))
    },
    remove(id) {
      return api.deleteMap(id)
    },
  }
}
