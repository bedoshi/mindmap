---
name: mindmap-app-commands
description: このリポジトリ（マインドマップWebアプリ / Electronアプリ）でビルド・開発サーバー起動・lint・プレビュー・Electron の起動やパッケージングなど、pnpm コマンドを実行する際に使う。
---

# よく使うコマンド

## Web 版

```bash
pnpm install    # 依存パッケージのインストール（Electron 本体のダウンロードも含む）
pnpm dev     # 開発サーバー起動（Vite、ブラウザで http://localhost:5173 を開く）
pnpm build   # 型チェック(tsc -b) + 本番ビルド → dist/
pnpm preview # ビルド結果をローカルでプレビュー
pnpm lint    # oxlintによるlint
```

## Electron 版

```bash
pnpm dev:electron    # electron-vite dev: レンダラーを HMR 付きで起動し、Electron ウィンドウを開く
pnpm build:electron  # 型チェック(tsc -b) + electron-vite build → out/{main,preload,renderer}/
pnpm start:electron  # electron-vite preview: ビルドしてから Electron で起動（本番相当の動作確認）
pnpm package         # build:electron のあと electron-builder でインストーラを作成 → release/
```

- `pnpm build:electron` 後に `pnpm exec electron .` でもビルド済みのアプリを起動できる。
- デバッグ用に `pnpm exec electron . --remote-debugging-port=9333` のように起動すると、Chrome DevTools Protocol でレンダラーに接続できる。
- 保存先ディレクトリを変えたいときは環境変数 `MINDMAP_DATA_DIR` を設定して起動する（例: `$env:MINDMAP_DATA_DIR = "C:\tmp\mindmap-test"; pnpm exec electron .`）。
- `pnpm package` はプラットフォームごとのツールをダウンロードするため、初回は時間がかかる。Windows では管理者権限またはシンボリックリンク作成権限が必要になる場合がある。

## リリース（GitHub Releases）

進め方（確認の順番・ブランチ・PR）は `CLAUDE.md` の「リリース手順ルール」に従う。コマンドは次のとおり。

```bash
# 前回のタグ以降に main へ入った変更と、未マージの PR を確認する
git fetch origin --tags
git log v0.3.0..origin/main --first-parent --oneline
gh pr list --state open

# バージョンの更新が必要なら release ブランチで PR にする
git checkout main && git pull --ff-only
git checkout -b release/v0.4.0
# package.json の version を更新してコミット → push → gh pr create

# PR のマージ後、main の CI の成功を確かめてからタグを push する
git checkout main && git pull --ff-only
git tag v0.4.0
git push origin v0.4.0

# リリース用ワークフローの完了を待ち、Release を確認して説明を差し替える
gh run watch <run-id> --exit-status
gh release view v0.4.0
gh release edit v0.4.0 --notes-file <説明のファイル>
```

- `.github/workflows/release.yml` が `v*` タグの push で起動し、Windows 上で lint・型チェック・テスト → `build:electron` → `electron-builder --publish never` を実行して、`release/` 内の `*.exe`・`*.exe.blockmap`・`latest.yml` を GitHub Release に添付する。
- 対象は Windows（NSIS インストーラ）のみ。macOS / Linux 向けは未対応。
- 添付するファイル名は `Mindmap-Setup-<version>.exe`（`electron-builder.yml` の `win.artifactName`）。`latest.yml` / `.blockmap` は `electron-updater` の自動アップデートが使うので、必ず一緒に添付する。
- Release の説明文は自動生成のままなので、必要なら `gh release edit <タグ> --notes ...` で変更点の要約に差し替える。
- タグ名と `package.json` の `version` は自動では連動しない。インストーラのファイル名は `version` で決まるので、タグを打つ前に揃えておく。

## CI（GitHub Actions）

- `.github/workflows/ci.yml` が `main` への PR（作成・更新）と `main` への push（PR のマージを含む）で起動し、Ubuntu 上で次を順に実行する。どれか 1 つでも失敗すると CI が失敗する。

```bash
pnpm install --frozen-lockfile
pnpm lint                     # oxlint
pnpm exec tsc -b              # 型チェック（app / node / electron の 3 構成）
pnpm test:run                 # Vitest
pnpm exec vite build          # Web 版のビルド
pnpm exec electron-vite build # Electron 版のビルド（インストーラは作らない）
```

- 手元で同じ確認をするときも上の順に実行すればよい（`pnpm build` は `tsc -b && vite build`、`pnpm build:electron` は `tsc -b && electron-vite build`）。
- CI では環境変数 `ELECTRON_SKIP_BINARY_DOWNLOAD=1` で Electron 本体のダウンロードを省いている。テストとビルドは Electron の型定義しか使わないため。Electron を実際に起動する確認（E2E など）を CI に足す場合は、この設定を外すこと。
- 同じ PR に新しいコミットを push すると、実行中の古い CI は取り消される（`concurrency`）。
- インストーラの作成（`electron-builder`）は CI では行わず、リリース用ワークフロー（`release.yml`）だけが行う。

## 型チェックだけ行う

```bash
pnpm exec tsc -b   # tsconfig.app.json / tsconfig.node.json / tsconfig.electron.json をまとめて検査
```

## 単体テスト（Vitest）

```bash
pnpm test               # vitest をウォッチモードで起動
pnpm test:run       # 全テストを 1 回実行（CI 向け）
pnpm test:coverage  # カバレッジ付きで実行 → coverage/
pnpm exec vitest run src/model   # パスを指定して一部だけ実行
```

- テストファイルは対象と同じディレクトリの `対象名.test.ts(x)`。`src/**` と `electron/**` が対象。
- 既定の環境は jsdom。Node 専用のテスト（`electron/`）はファイル先頭に `// @vitest-environment node` を書く。
- 実行時に Node が `--localstorage-file was provided without a valid path` という警告を出すが、Vitest が Node 側の localStorage を無効化するために付けているフラグによるもので、テスト結果には影響しない。

## 変更前後の確認

コードを変更したら `pnpm lint` → `pnpm exec tsc -b` → `pnpm test:run` → 必要に応じて `pnpm build` / `pnpm build:electron` の順で確認する。
