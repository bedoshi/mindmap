# Mindmap

MindMeister 風のマインドマップアプリケーション。React + Vite + TypeScript で実装し、次の 2 つの形で動作する。

- **Web 版**: ブラウザで動作し、マップはブラウザの localStorage に保存される。
- **Electron 版（デスクトップアプリ）**: 同じ UI を Electron で包んだもの。マップは OS のユーザーデータディレクトリに XML ファイルとして保存される。

バックエンド（サーバー）は持たない。

## ドキュメント

| 内容 | 場所 |
| --- | --- |
| 機能仕様（操作方法・保存先・XML 形式・未実装項目） | [docs/spec.md](./docs/spec.md) |
| 方針・設計の決定記録（なぜそうしたか） | [docs/decisions.md](./docs/decisions.md) |
| 実装構成・技術的な決定事項 | [.claude/skills/mindmap-app-architecture/SKILL.md](./.claude/skills/mindmap-app-architecture/SKILL.md) |
| ビルド・起動などのコマンド | [.claude/skills/mindmap-app-commands/SKILL.md](./.claude/skills/mindmap-app-commands/SKILL.md) |
| 開発ルール（ドキュメント更新・コミット・コミュニケーション） | [CLAUDE.md](./CLAUDE.md) |

## 環境構築

パッケージマネージャーには [pnpm](https://pnpm.io/ja/) を使う。Node.js（LTS 版）と pnpm をインストールしてから、次の手順で進める。

```bash
# pnpm が未インストールの場合（Node.js 付属の Corepack を使う例）
corepack enable pnpm

# 依存パッケージのインストール
pnpm install
```

Electron 版を使う場合、pnpm 10 以降は依存パッケージのインストール後スクリプトを既定で実行しないため、Electron 本体が取得されないことがある。`pnpm dev:electron` で Electron が見つからないというエラーになったら、`pnpm approve-builds` で `electron`（パッケージ作成も行うなら `electron-builder` なども）を許可してから、`pnpm install` をやり直す。

## クイックスタート

```bash
pnpm dev               # Web 版を開発サーバーで起動（http://localhost:5173）
pnpm dev:electron      # Electron 版を開発モードで起動
```

本番ビルドは `pnpm build`（Web 版 → `dist/`）、`pnpm build:electron`（Electron 版 → `out/`）。
単体テストは `pnpm test:run`（Vitest）。
