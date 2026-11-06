import { useCallback, useEffect, useRef, useState } from 'react'
import { createMindMap, newId } from '../model/mindmap'
import type { MindMap } from '../model/types'
import type { MapStorage, MapSummary } from '../storage'
import { titleOf } from '../storage/xml'

/**
 * 複数マップの管理（一覧・切り替え・作成・削除）と、開いているマップの自動保存。
 * 変更はデバウンスして保存し、Ctrl+S などからは saveNow() で即時に書き出せる。
 */

const AUTOSAVE_DELAY_MS = 600

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

export interface CurrentMap {
  id: string
  map: MindMap
}

function sortByUpdated(list: MapSummary[]): MapSummary[] {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function useMapLibrary(storage: MapStorage) {
  const [maps, setMaps] = useState<MapSummary[]>([])
  const [current, setCurrent] = useState<CurrentMap | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [location, setLocation] = useState('')

  const currentIdRef = useRef<string | null>(null)
  const mapsRef = useRef<MapSummary[]>([])
  const pendingRef = useRef<CurrentMap | null>(null)
  const timerRef = useRef<number | null>(null)
  const initRef = useRef<Promise<{ list: MapSummary[]; target: CurrentMap | null }> | null>(null)

  const updateMaps = useCallback((updater: (prev: MapSummary[]) => MapSummary[]) => {
    mapsRef.current = sortByUpdated(updater(mapsRef.current))
    setMaps(mapsRef.current)
  }, [])

  const activate = useCallback((target: CurrentMap) => {
    currentIdRef.current = target.id
    setCurrent(target)
    setSaveState('saved')
  }, [])

  const upsertSummary = useCallback(
    (summary: MapSummary) =>
      updateMaps((prev) => [...prev.filter((m) => m.id !== summary.id), summary]),
    [updateMaps],
  )

  /** 保留中の変更があれば今すぐ保存する。成功したら true */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const pending = pendingRef.current
    if (!pending) return true
    pendingRef.current = null
    setSaveState('saving')
    try {
      await storage.save(pending.id, pending.map)
      upsertSummary({ id: pending.id, title: titleOf(pending.map), updatedAt: Date.now() })
      setSaveState(pendingRef.current ? 'dirty' : 'saved')
      return true
    } catch (error) {
      // 失敗した変更は捨てずに保持し、次回の保存で再試行する
      pendingRef.current ??= pending
      setSaveState('error')
      setErrorMessage(`保存に失敗しました: ${messageOf(error)}`)
      return false
    }
  }, [storage, upsertSummary])

  /** エディタからの変更通知。デバウンスして自動保存する */
  const reportChange = useCallback(
    (map: MindMap) => {
      const id = currentIdRef.current
      if (!id) return
      pendingRef.current = { id, map }
      setSaveState('dirty')
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS)
    },
    [flush],
  )

  // 初期化: 一覧を取得し、最後に更新したマップを開く。1 つもなければ新規作成する
  useEffect(() => {
    let cancelled = false
    initRef.current ??= (async () => {
      setLocation(await storage.describeLocation())
      const list = sortByUpdated(await storage.list())
      if (list.length === 0) {
        const id = newId()
        const map = createMindMap()
        await storage.save(id, map)
        return {
          list: [{ id, title: titleOf(map), updatedAt: Date.now() }],
          target: { id, map },
        }
      }
      const first = list[0]
      const map = await storage.load(first.id)
      return { list, target: map ? { id: first.id, map } : null }
    })()
    initRef.current
      .then(({ list, target }) => {
        if (cancelled) return
        updateMaps(() => list)
        if (target) {
          activate(target)
          setStatus('ready')
        } else {
          setErrorMessage('マップを読み込めませんでした')
          setStatus('error')
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setErrorMessage(messageOf(error))
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [storage, updateMaps, activate])

  // タブを閉じる・リロードするときに保留中の変更を書き出す
  useEffect(() => {
    const handlePageHide = () => void flush()
    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [flush])

  const openMap = useCallback(
    async (id: string) => {
      if (id === currentIdRef.current) return
      await flush()
      try {
        const map = await storage.load(id)
        if (!map) {
          setErrorMessage('マップが見つかりませんでした')
          updateMaps((prev) => prev.filter((m) => m.id !== id))
          return
        }
        activate({ id, map })
        setStatus('ready')
      } catch (error) {
        setErrorMessage(`マップを開けませんでした: ${messageOf(error)}`)
      }
    },
    [storage, flush, activate, updateMaps],
  )

  const createMap = useCallback(
    async (initial?: MindMap) => {
      await flush()
      const id = newId()
      const map = initial ?? createMindMap()
      try {
        await storage.save(id, map)
        upsertSummary({ id, title: titleOf(map), updatedAt: Date.now() })
        activate({ id, map })
        setStatus('ready')
      } catch (error) {
        setErrorMessage(`マップを作成できませんでした: ${messageOf(error)}`)
      }
    },
    [storage, flush, upsertSummary, activate],
  )

  const deleteMap = useCallback(
    async (id: string) => {
      await flush()
      try {
        await storage.remove(id)
      } catch (error) {
        setErrorMessage(`マップを削除できませんでした: ${messageOf(error)}`)
        return
      }
      if (pendingRef.current?.id === id) pendingRef.current = null
      updateMaps((prev) => prev.filter((m) => m.id !== id))
      if (currentIdRef.current === id) {
        const next = mapsRef.current[0]
        if (next) await openMap(next.id)
        else await createMap()
      }
    },
    [storage, flush, updateMaps, openMap, createMap],
  )

  const clearError = useCallback(() => setErrorMessage(null), [])

  return {
    storageKind: storage.kind,
    location,
    maps,
    current,
    status,
    errorMessage,
    saveState,
    reportChange,
    saveNow: flush,
    openMap,
    createMap,
    deleteMap,
    clearError,
  }
}

export type MapLibrary = ReturnType<typeof useMapLibrary>
