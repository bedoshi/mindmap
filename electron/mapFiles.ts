import type { IpcMain } from 'electron'
import { mkdir, readdir, rename, rm, stat, writeFile, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { IPC_CHANNELS, type MapFileInfo } from '../src/storage/electronApi'

/**
 * マップファイル（XML）の保存ディレクトリ解決と、ファイル入出力の IPC ハンドラ。
 * ファイル操作はメインプロセスでのみ行い、レンダラーには ID と文字列だけをやり取りさせる。
 */

const APP_DIR_NAME = 'mindmap'
const MAPS_DIR_NAME = 'maps'
const MAP_ID_PATTERN = /^[A-Za-z0-9_-]+$/

/**
 * OS の慣習に沿ったユーザーデータディレクトリを返す。
 * 環境変数 MINDMAP_DATA_DIR が設定されていればそれを優先する（テスト・検証用）。
 */
export function resolveDataDir(): string {
  const override = process.env.MINDMAP_DATA_DIR
  if (override) return path.resolve(override)
  const home = os.homedir()
  switch (process.platform) {
    case 'win32':
      return path.join(
        process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local'),
        APP_DIR_NAME,
      )
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', APP_DIR_NAME)
    default:
      return path.join(
        process.env.XDG_DATA_HOME ?? path.join(home, '.local', 'share'),
        APP_DIR_NAME,
      )
  }
}

function mapsDir(): string {
  return path.join(resolveDataDir(), MAPS_DIR_NAME)
}

function mapFilePath(id: string): string {
  if (!MAP_ID_PATTERN.test(id)) throw new Error(`不正なマップIDです: ${id}`)
  return path.join(mapsDir(), `${id}.xml`)
}

async function ensureMapsDir(): Promise<string> {
  const dir = mapsDir()
  await mkdir(dir, { recursive: true })
  return dir
}

export async function listMaps(): Promise<MapFileInfo[]> {
  const dir = await ensureMapsDir()
  const entries = await readdir(dir, { withFileTypes: true })
  const infos: MapFileInfo[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.xml')) continue
    const id = entry.name.slice(0, -'.xml'.length)
    if (!MAP_ID_PATTERN.test(id)) continue
    const info = await stat(path.join(dir, entry.name))
    infos.push({ id, updatedAt: info.mtimeMs })
  }
  return infos
}

export async function readMap(id: string): Promise<string | null> {
  try {
    return await readFile(mapFilePath(id), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/** 書き込み途中でクラッシュしても元のファイルが壊れないよう、一時ファイルに書いてから置き換える */
export async function writeMap(id: string, xml: string): Promise<void> {
  await ensureMapsDir()
  const target = mapFilePath(id)
  const temp = `${target}.tmp`
  await writeFile(temp, xml, 'utf8')
  await rename(temp, target)
}

export async function deleteMap(id: string): Promise<void> {
  await rm(mapFilePath(id), { force: true })
}

export function registerMapFileHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.listMaps, () => listMaps())
  ipcMain.handle(IPC_CHANNELS.readMap, (_event, id: string) => readMap(id))
  ipcMain.handle(IPC_CHANNELS.writeMap, (_event, id: string, xml: string) => writeMap(id, xml))
  ipcMain.handle(IPC_CHANNELS.deleteMap, (_event, id: string) => deleteMap(id))
  ipcMain.handle(IPC_CHANNELS.getDataDir, () => resolveDataDir())
}
