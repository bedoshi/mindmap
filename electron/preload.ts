import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type MapFileInfo, type MindmapApi } from '../src/storage/electronApi'

/**
 * レンダラーに公開する API。ファイルシステムへ直接触らせず、IPC 経由でメインプロセスに依頼する。
 */
const api: MindmapApi = {
  listMaps: () => ipcRenderer.invoke(IPC_CHANNELS.listMaps) as Promise<MapFileInfo[]>,
  readMap: (id) => ipcRenderer.invoke(IPC_CHANNELS.readMap, id) as Promise<string | null>,
  writeMap: (id, xml) => ipcRenderer.invoke(IPC_CHANNELS.writeMap, id, xml) as Promise<void>,
  deleteMap: (id) => ipcRenderer.invoke(IPC_CHANNELS.deleteMap, id) as Promise<void>,
  getDataDir: () => ipcRenderer.invoke(IPC_CHANNELS.getDataDir) as Promise<string>,
}

contextBridge.exposeInMainWorld('mindmapApi', api)
