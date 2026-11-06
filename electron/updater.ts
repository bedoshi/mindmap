import { app } from 'electron'
// electron-updater は CommonJS なので、ESM のメインプロセスからは default import 経由で取り出す
import electronUpdater from 'electron-updater'

/**
 * 自動アップデート。起動時に GitHub Releases の latest.yml を確認し、新しいバージョンがあれば
 * バックグラウンドでダウンロードして、次にアプリを終了するときにインストールする。
 * パッケージ化していない起動（開発・preview）では何もしない。
 */
export function checkForUpdates(): void {
  if (!app.isPackaged) return
  const { autoUpdater } = electronUpdater
  // 確認やダウンロードの失敗でアプリの動作を止めない（オフライン時など）
  autoUpdater.on('error', (error) => {
    console.error('[updater]', error)
  })
  void autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => {
    console.error('[updater]', error)
  })
}
