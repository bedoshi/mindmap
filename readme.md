# Mindmap

MindMeister 風のマインドマップ Web アプリケーション。React + Vite + TypeScript で実装し、ブラウザで動作する。マップはブラウザの localStorage に保存され、バックエンド（サーバー）は持たない。

## ドキュメント

| 内容 | 場所 |
| --- | --- |
| 機能仕様（操作方法・保存・XML 形式・未実装項目） | [docs/spec.md](./docs/spec.md) |
| 実装構成・技術的な決定事項 | [.claude/skills/mindmap-app-architecture/SKILL.md](./.claude/skills/mindmap-app-architecture/SKILL.md) |
| ビルド・起動などのコマンド | [.claude/skills/mindmap-app-commands/SKILL.md](./.claude/skills/mindmap-app-commands/SKILL.md) |
| 開発ルール（ドキュメント更新・コミット・コミュニケーション） | [CLAUDE.md](./CLAUDE.md) |

## クイックスタート

```bash
npm install
npm run dev   # 開発サーバーで起動（http://localhost:5173）
```

本番ビルドは `npm run build`（→ `dist/`）。
