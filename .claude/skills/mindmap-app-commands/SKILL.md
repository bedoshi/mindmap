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

## リリース（GitHub Releases）

```bash
# package.json の version を更新してコミットしたあと、v<version> のタグを push する
git tag v0.1.0
git push origin v0.1.0
```

- `.github/workflows/release.yml` が `v*` タグの push で起動し、Windows 上で lint・型チェック・テスト → `build:electron` → `electron-builder --publish never` を実行して、`release/` 内の `*.exe`・`*.exe.blockmap`・`latest.yml` を GitHub Release に添付する。
- 対象は Windows（NSIS インストーラ）のみ。macOS / Linux 向けは未対応。
- 添付するファイル名は `Mindmap-Setup-<version>.exe`（`electron-builder.yml` の `win.artifactName`）。`latest.yml` / `.blockmap` は `electron-updater` の自動アップデートが使うので、必ず一緒に添付する。
- Release の説明文は自動生成のままなので、必要なら `gh release edit <タグ> --notes ...` で変更点の要約に差し替える。
- タグ名と `package.json` の `version` は自動では連動しない。インストーラのファイル名は `version` で決まるので、タグを打つ前に揃えておく。

## 型チェックだけ行う

```bash
npx tsc -b   # tsconfig.app.json / tsconfig.node.json / tsconfig.electron.json をまとめて検査
```

## 単体テスト（Vitest）

```bash
npm test               # vitest をウォッチモードで起動
npm run test:run       # 全テストを 1 回実行（CI 向け）
npm run test:coverage  # カバレッジ付きで実行 → coverage/
npx vitest run src/model   # パスを指定して一部だけ実行
```

- テストファイルは対象と同じディレクトリの `対象名.test.ts(x)`。`src/**` と `electron/**` が対象。
- 既定の環境は jsdom。Node 専用のテスト（`electron/`）はファイル先頭に `// @vitest-environment node` を書く。
- 実行時に Node が `--localstorage-file was provided without a valid path` という警告を出すが、Vitest が Node 側の localStorage を無効化するために付けているフラグによるもので、テスト結果には影響しない。

## 変更前後の確認

コードを変更したら `npm run lint` → `npx tsc -b` → `npm run test:run` → 必要に応じて `npm run build` / `npm run build:electron` の順で確認する。
