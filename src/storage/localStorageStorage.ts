import type { MindMap } from '../model/types'
import type { MapStorage, MapSummary } from './types'
import { mindMapToXml, titleOf, xmlToMindMap } from './xml'

/**
 * Web 版の保存先。マップごとに 1 つのキーで localStorage に保存する。
 * 値は Electron 版と同じ XML 文字列に、一覧表示用のメタ情報を添えた JSON。
 */

const KEY_PREFIX = 'mindmap.map.'

interface StoredEntry {
  title: string
  updatedAt: number
  xml: string
}

function keyOf(id: string): string {
  return `${KEY_PREFIX}${id}`
}

function readEntry(id: string): StoredEntry | null {
  try {
    const raw = localStorage.getItem(keyOf(id))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as StoredEntry).xml !== 'string'
    ) {
      return null
    }
    const entry = parsed as Partial<StoredEntry>
    return {
      title: typeof entry.title === 'string' ? entry.title : '',
      updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : 0,
      xml: entry.xml as string,
    }
  } catch {
    return null
  }
}

export function createLocalStorageStorage(): MapStorage {
  return {
    kind: 'localStorage',
    async describeLocation() {
      return 'このブラウザ内（localStorage）'
    },
    async list() {
      const summaries: MapSummary[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith(KEY_PREFIX)) continue
        const id = key.slice(KEY_PREFIX.length)
        const entry = readEntry(id)
        if (entry) summaries.push({ id, title: entry.title, updatedAt: entry.updatedAt })
      }
      return summaries
    },
    async load(id) {
      const entry = readEntry(id)
      return entry ? xmlToMindMap(entry.xml) : null
    },
    async save(id, map: MindMap) {
      const entry: StoredEntry = {
        title: titleOf(map),
        updatedAt: Date.now(),
        xml: mindMapToXml(map),
      }
      localStorage.setItem(keyOf(id), JSON.stringify(entry))
    },
    async remove(id) {
      localStorage.removeItem(keyOf(id))
    },
  }
}
