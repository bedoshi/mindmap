import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import path from 'node:path'
import { registerMapFileHandlers } from './mapFiles'
import { buildApplicationMenu } from './menu'
import { checkForUpdates } from './updater'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // ESM 形式の preload を使うため sandbox は無効にする（contextIsolation は有効）
      sandbox: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  // レンダラーからの外部リンクは OS のブラウザで開く
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devServerUrl = process.env.ELECTRON_RENDERER_URL
  if (devServerUrl) {
    void win.loadURL(devServerUrl)
  } else {
    void win.loadFile(path.join(import.meta.dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  Menu.setApplicationMenu(buildApplicationMenu())
  registerMapFileHandlers(ipcMain)
  createWindow()
  checkForUpdates()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
