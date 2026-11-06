import { Menu, type MenuItemConstructorOptions } from 'electron'

/**
 * アプリケーションメニュー。
 * Electron 既定のメニューには Ctrl+= / Ctrl+- / Ctrl+0 のページズームが含まれており、
 * アプリ側のズームショートカットと衝突するため、ズーム項目を除いた最小限のメニューを定義する。
 */
export function buildApplicationMenu(): Menu {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'ファイル',
      submenu: [isMac ? { role: 'close' } : { role: 'quit', label: '終了' }],
    },
    {
      label: '編集',
      submenu: [
        { role: 'undo', label: '元に戻す' },
        { role: 'redo', label: 'やり直す' },
        { type: 'separator' },
        { role: 'cut', label: '切り取り' },
        { role: 'copy', label: 'コピー' },
        { role: 'paste', label: '貼り付け' },
        { role: 'selectAll', label: 'すべて選択' },
      ],
    },
    {
      label: '表示',
      submenu: [
        { role: 'reload', label: '再読み込み' },
        { role: 'toggleDevTools', label: '開発者ツール' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全画面表示' },
      ],
    },
    {
      label: 'ウィンドウ',
      submenu: [{ role: 'minimize', label: '最小化' }, ...(isMac ? [{ role: 'front' as const }] : [])],
    },
  ]

  return Menu.buildFromTemplate(template)
}
