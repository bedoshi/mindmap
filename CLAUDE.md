# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

MindMeister 風のマインドマップアプリケーション。フロントエンドは React + Vite + TypeScript で実装し、ブラウザで動く Web 版と、同じコードを Electron で包んだデスクトップ版の両方を提供する。バックエンドはなく、Web 版は localStorage、Electron 版は OS のユーザーデータディレクトリ内の XML ファイル（マップごとに 1 ファイル）にマップを保存する。

## ドキュメントの所在

| 内容 | 場所 |
| --- | --- |
| 機能仕様（何を作るか・どう動くべきか） | `docs/spec.md` |
| 方針・設計の決定記録（なぜそうしたか、経緯） | `docs/decisions.md` |
| 実装構成・技術的な決定事項 | `.claude/skills/mindmap-app-architecture/SKILL.md` |
| ビルド・起動・検証のコマンド | `.claude/skills/mindmap-app-commands/SKILL.md` |
| 概要と各ドキュメントへのリンク | `readme.md` |

## これまでの主な決定事項（詳細は `docs/decisions.md`）

- Web 版を残しつつ Electron 版も提供する。Electron 固有コードは `electron/` に隔離し、保存先の違いは `MapStorage` インターフェースで吸収する。
- 保存先は OS の慣習に従う（Windows `%LOCALAPPDATA%\mindmap`、macOS `~/Library/Application Support/mindmap`、Linux `$XDG_DATA_HOME` または `~/.local/share/mindmap`）。当初案の `LocalLow` / `~/.cache` は採用しなかった。
- マップごとに 1 ファイル（`maps/<UUID>.xml`）で複数マップを扱う。
- 自動保存（約 0.6 秒のデバウンス）に加えて `Ctrl+S` で即時保存できる。
- 保存形式は XML のみ。初期試作の JSON 形式は廃止済みで移行処理は無い。
- 実行時依存は React のみ。Lint は oxlint。単体テストは Vitest + Testing Library（MSW・ESLint・Prettier は未導入）。
- コードを変更したら lint・型チェック・テスト（`npm run test:run`）を通してから完了とする。テストの書き方は `mindmap-app-architecture` スキルの「テスト」の節を参照。
- 後から追加された汎用スキル（`react-ts-*`）と既存のディレクトリ構成・命名には差分がある。各スキルの方針どおり既存規約を優先しており、移行するかどうかは未決定。構成を変える場合は機能変更と分けた独立のタスクで行うこと。

## 作業状況の注意

- `npm run package`（electron-builder によるインストーラ作成）はまだ動作確認していない。
- Electron 版の動作確認は `npx electron . --remote-debugging-port=9333` で起動し、Chrome DevTools Protocol 経由でレンダラーを操作する方法で行った（手順は `mindmap-app-commands` スキル参照）。

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
- 方針や設計を決めた・変えたとき（ユーザーとのやり取りで決まった事項を含む） → `docs/decisions.md` に日付付きで追記する。既存の決定を覆す場合は元の項目に「→ 変更」と書き、新しい項目を追加する。
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
