# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

マインドマップのWebアプリケーション。フロントエンドは React + Vite + TypeScript で実装する（`readme.md` 参照）。現時点ではバックエンドはなく、Viteの `react-ts` テンプレートで生成したフロントエンドのみの構成。

## 詳細情報（Skill）

よく使うコマンドや構成の詳細は、必要な作業内容に応じて以下のSkillが自動的に読み込まれる。

- `mindmap-app-commands` — ビルド・開発サーバー・lintなどのコマンド
- `mindmap-app-architecture` — ディレクトリ構成・技術的な決定事項

## ドキュメント更新ルール

ソースコードや仕様に変更があった場合は、必ず関連するドキュメントも同じコミット内で更新すること。

- 機能・仕様（何を作るか、どう動くべきか）に関わる変更 → `readme.md` を更新する。
- アーキテクチャ・構成・使用コマンド（どう実装されているか、どう開発するか）に関わる変更 → `CLAUDE.md` または該当する `.claude/skills/**/SKILL.md` を更新する。
- どちらに書くべきか迷う場合は両方を確認し、必要な方（または両方）を更新する。
- ドキュメントを更新せずにコードや仕様だけを変更した状態でタスクを完了としないこと。
- ドキュメント（`readme.md` / `CLAUDE.md` / `.claude/skills/**/SKILL.md` を含む）は日本語で記載すること。
