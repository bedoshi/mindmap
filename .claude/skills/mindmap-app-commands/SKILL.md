---
name: mindmap-app-commands
description: このリポジトリ（マインドマップWebアプリ / Electronアプリ）でビルド・開発サーバー起動・lint・プレビュー・Electron の起動やパッケージングなど、npm コマンドを実行する際に使う。
---

# よく使うコマンド

## Web 版

```bash
npm install     # 依存パッケージのインストール（Electron 本体のダウンロードも含む）
npm run dev     # 開発サーバー起動（Vite、ブラウザで http://localhost:5173 を開く）
npm run build   # 型チェック(tsc -b) + 本番ビルド → dist/
npm run preview # ビルド結果をローカルでプレビュー
npm run lint    # oxlintによるlint
```

## Electron 版

```bash
npm run dev:electron    # electron-vite dev: レンダラーを HMR 付きで起動し、Electron ウィンドウを開く
npm run build:electron  # 型チェック(tsc -b) + electron-vite build → out/{main,preload,renderer}/
npm run start:electron  # electron-vite preview: ビルドしてから Electron で起動（本番相当の動作確認）
npm run package         # build:electron のあと electron-builder でインストーラを作成 → release/
```

- `npm run build:electron` 後に `npx electron .` でもビルド済みのアプリを起動できる。
- デバッグ用に `npx electron . --remote-debugging-port=9333` のように起動すると、Chrome DevTools Protocol でレンダラーに接続できる。
- 保存先ディレクトリを変えたいときは環境変数 `MINDMAP_DATA_DIR` を設定して起動する（例: `$env:MINDMAP_DATA_DIR = "C:\tmp\mindmap-test"; npx electron .`）。
- `npm run package` はプラットフォームごとのツールをダウンロードするため、初回は時間がかかる。Windows では管理者権限またはシンボリックリンク作成権限が必要になる場合がある。

## 型チェックだけ行う

```bash
npx tsc -b   # tsconfig.app.json / tsconfig.node.json / tsconfig.electron.json をまとめて検査
```

単体テストのコマンドはまだ存在しない（テストランナー未導入）。
