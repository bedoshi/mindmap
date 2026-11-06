---
name: mindmap-app-architecture
description: このリポジトリ（マインドマップWebアプリ）のディレクトリ構成・技術的な決定事項（lintツール、TypeScript設定の分割など）を把握・変更する際に使う。
---

# 構成

- `src/main.tsx` がエントリーポイント。`src/App.tsx` をルートコンポーネントとしてDOMにマウントする、標準的なVite+Reactの構成。
- Lintは ESLint ではなく **oxlint** を使用（`.oxlintrc.json` で設定）。ESLint系のプラグインは使えないため、lintルールを追加する場合はoxlintの設定方法に従うこと。
- TypeScript設定は `tsconfig.json` から `tsconfig.app.json`（アプリコード用）と `tsconfig.node.json`（Vite設定など node 側コード用）を参照する分割構成。

マインドマップ機能（ノードの描画、編集、保存など）はまだ実装されていない。今後実装する際は、このセクションを実際のアーキテクチャ（状態管理方法、データ永続化の方式など）に合わせて更新すること。
