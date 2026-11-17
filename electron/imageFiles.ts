import type { BrowserWindow, Dialog, IpcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { IPC_CHANNELS } from '../src/storage/electronApi'

/**
 * 書き出した PNG 画像の保存。保存ダイアログで保存先をユーザーに選んでもらい、メインプロセスで書き込む。
 * ダイアログの初期位置は OS のダウンロードフォルダ。
 */

const IMAGE_EXTENSION = '.png'
/** Windows などでファイル名に使えない文字 */
const INVALID_FILE_NAME_CHARS = /[\\/:*?"<>|]/g

/** ダイアログに出す既定のファイル名を整える（パス区切りなどを除き、拡張子 .png を保証する） */
export function toDefaultImageName(name: string): string {
  // 制御文字（コードポイント 32 未満）も使えないので取り除く
  const printable = [...name].filter((ch) => ch.charCodeAt(0) >= 32).join('')
  const base = path.basename(printable.replace(INVALID_FILE_NAME_CHARS, '_')).trim()
  return ensurePngExtension(base === '' || base === IMAGE_EXTENSION ? 'mindmap' : base)
}

/** ユーザーが拡張子を消して確定した場合に備えて、末尾を .png にそろえる */
export function ensurePngExtension(filePath: string): string {
  return filePath.toLowerCase().endsWith(IMAGE_EXTENSION) ? filePath : filePath + IMAGE_EXTENSION
}

export async function writeImage(filePath: string, data: Uint8Array): Promise<void> {
  await writeFile(filePath, data)
}

/** main.ts から渡される Electron の機能（本体を import するとテストできなくなるため引数で受け取る） */
export interface ImageDialogDeps {
  dialog: Dialog
  fromWebContents: (webContents: Electron.WebContents) => BrowserWindow | null
  downloadsDir: () => string
}

export function registerImageFileHandlers(ipcMain: IpcMain, deps: ImageDialogDeps): void {
  const { dialog, fromWebContents, downloadsDir } = deps
  ipcMain.handle(IPC_CHANNELS.saveImage, async (event, defaultName: string, data: Uint8Array) => {
    const options = {
      title: '画像として書き出す',
      defaultPath: path.join(downloadsDir(), toDefaultImageName(defaultName)),
      filters: [{ name: 'PNG 画像', extensions: ['png'] }],
    }
    const owner = fromWebContents(event.sender)
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    const filePath = ensurePngExtension(result.filePath)
    await writeImage(filePath, data)
    return filePath
  })
}
