---
name: mindmap-app-commands
description: このリポジトリ（マインドマップWebアプリ）でビルド・開発サーバー起動・lint・プレビューなど、npm コマンドを実行する際に使う。
---

# よく使うコマンド

```bash
npm install     # 依存パッケージのインストール
npm run dev     # 開発サーバー起動（Vite）
npm run build   # 型チェック(tsc -b) + 本番ビルド
npm run preview # ビルド結果をローカルでプレビュー
npm run lint    # oxlintによるlint
```

単体テストのコマンドはまだ存在しない（テストランナー未導入）。
