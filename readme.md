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

## クイックスタート

```bash
npm install
npm run dev            # Web 版を開発サーバーで起動（http://localhost:5173）
npm run dev:electron   # Electron 版を開発モードで起動
```

本番ビルドは `npm run build`（Web 版 → `dist/`）、`npm run build:electron`（Electron 版 → `out/`）。
単体テストは `npm run test:run`（Vitest）。
