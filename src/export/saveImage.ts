/**
 * 書き出した画像（Blob）の保存。実行環境で保存先の決め方が変わる。
 * - Electron 版: 保存ダイアログを開き、ユーザーが選んだ場所に保存する。
 * - Web 版: ブラウザのダウンロード機能に任せる（保存先はブラウザの設定。通常はダウンロードフォルダ）。
 */

export type SaveImageResult =
  /** 保存した。Electron 版では保存先の絶対パス、Web 版では null（ブラウザが決めるため分からない） */
  | { status: 'saved'; path: string | null }
  /** ユーザーが保存ダイアログをキャンセルした（Electron 版のみ） */
  | { status: 'cancelled' }

/** Blob をファイルとしてダウンロードさせる */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  // すぐに revoke するとブラウザがファイル名を解決する前に URL が無効になり、
  // ファイル名が "download" になることがあるため、ダウンロード開始後に解放する
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function saveImage(blob: Blob, filename: string): Promise<SaveImageResult> {
  const api = window.mindmapApi
  if (api) {
    const savedPath = await api.saveImage(filename, new Uint8Array(await blob.arrayBuffer()))
    return savedPath === null ? { status: 'cancelled' } : { status: 'saved', path: savedPath }
  }
  downloadBlob(blob, filename)
  return { status: 'saved', path: null }
}
