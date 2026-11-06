# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

MindMeister 風のマインドマップアプリケーション。フロントエンドは React + Vite + TypeScript で実装し、ブラウザで動く Web 版と、同じコードを Electron で包んだデスクトップ版の両方を提供する。バックエンドはなく、Web 版は localStorage、Electron 版は OS のユーザーデータディレクトリ内の XML ファイル（マップごとに 1 ファイル）にマップを保存する（機能仕様は `docs/spec.md` 参照）。

## 詳細情報（Skill）

よく使うコマンドや構成の詳細は、必要な作業内容に応じて以下のSkillが自動的に読み込まれる。

- `mindmap-app-commands` — ビルド・開発サーバー・lintなどのコマンド
- `mindmap-app-architecture` — ディレクトリ構成・技術的な決定事項
- `react-ts-structure-naming-rules` — React + TypeScript のディレクトリ構成（feature 単位）・依存方向・import・命名規則
- `react-ts-component-design-rules` — React + TypeScript のコンポーネント設計（関数コンポーネント・Props の型・責務の分け方・state と副作用・JSX の書き方）
- `react-ts-test-lint-rules` — テストコード（Vitest / Testing Library / MSW）の書き方と ESLint / Prettier の設定ルール

## ドキュメント更新ルール

ソースコードや仕様に変更があった場合は、必ず関連するドキュメントも同じコミット内で更新すること。

- 機能・仕様（何を作るか、どう動くべきか）に関わる変更 → `docs/spec.md` を更新する。`readme.md` は概要とリンクのみなので、提供形態や前提が変わったときだけ更新する。
- アーキテクチャ・構成・使用コマンド（どう実装されているか、どう開発するか）に関わる変更 → `CLAUDE.md` または該当する `.claude/skills/**/SKILL.md` を更新する。
- どちらに書くべきか迷う場合は両方を確認し、必要な方（または両方）を更新する。
- ドキュメントを更新せずにコードや仕様だけを変更した状態でタスクを完了としないこと。
- ドキュメント（`readme.md` / `docs/**` / `CLAUDE.md` / `.claude/skills/**/SKILL.md` を含む）は日本語で記載すること。

## コミットルール

コミットは差分全体を1つにまとめず、関連のある単位ごとに分けること。

- 例: 「プロジェクトのスキャフォルディング（依存パッケージ・設定ファイルなど）」と「ドキュメント・ルールの追加」は別の目的の変更なので、別コミットに分ける。
- 1つのコミットには、1つの目的・1つの意図のみを含めるようにする。無関係な変更を同じコミットに混在させない。
- 上記の「ドキュメント更新ルール」で求めている“同じコミット内でのドキュメント更新”は、そのコード変更自体を説明するドキュメントの更新を指す（例: アーキテクチャを変更したら、同じコミットで `.claude/skills/mindmap-app-architecture/SKILL.md` も更新する）。それ以外の目的の異なるドキュメント変更は別コミットにしてよい。
- コミットする前に `git status` / `git diff` で差分を確認し、意図した単位だけをステージングしてコミットすること（`git add -A` で無差別にまとめない）。
- `package.json` / `package-lock.json` / `.gitignore` など依存パッケージ・リポジトリ設定系のファイルは、他の変更（機能実装やドキュメント更新）と混在させず、それだけで独立したコミットにすること。ただし初回のプロジェクトスキャフォルディングのように、これらのファイルが他の生成ファイル一式と不可分に同時生成される場合は、そのスキャフォルディング一式でのコミットに含めてよい。
- コミットメッセージは日本語で記載すること。

## コミュニケーションルール

ターミナル上でのやり取り（ユーザーへの応答・説明・進捗報告など）は日本語で出力すること。
