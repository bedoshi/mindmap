# 方針・設計の決定記録

このプロジェクトで決めた方針と、その経緯・理由を時系列で記録する。新しい決定を追加するときは末尾に追記し、既存の決定を覆す場合は元の項目に「→ 変更」と追記したうえで新しい項目を書く。

## 2026-11-07

### D-01 MindMeister 風のマインドマップアプリを作る

- **決定**: MindMeister のような操作感（中心トピックから左右に枝を伸ばす自動レイアウト、Tab / Enter によるノード追加、ドラッグでの付け替え）を目標にする。
- **経緯**: 最初の要望が「mindmeister のような mindmap アプリを作りたい」であったため。
- **影響**: ノードの手動配置は行わず、常に自動レイアウトにする。

### D-02 追加の実行時依存パッケージを入れず、React + SVG で描画する

- **決定**: 状態管理ライブラリや描画ライブラリ（React Flow、D3 など）は使わず、React と標準の DOM / SVG だけで実装する。
- **理由**: ツリー構造の自動レイアウトとベジェ曲線の描画だけなら自前実装で十分であり、依存を増やさない方が保守しやすい。
- **影響**: レイアウト計算（`src/model/layout.ts`）とツリー操作（`src/model/mindmap.ts`）は純粋関数として持つ。

### D-03 Web 版を残しつつ Electron 版も提供する

- **決定**: ブラウザで動く Web 版はそのまま残し、同じコードを Electron で包んだデスクトップ版を追加する。
- **経緯**: 「Electron で動くアプリとして実装することは可能か」という質問に対し、可能である旨と構成案を提示し、「Web 版も残しつつ Electron アプリも作る」方針が選ばれた。
- **影響**: `index.html` と `src/` を両者で共有し、Electron 固有のコードは `electron/` に隔離する。保存先の違いは `MapStorage` インターフェースで吸収する。

### D-04 保存先は OS の慣習に沿ったユーザーデータディレクトリにする

- **決定**:
  - Windows: `%LOCALAPPDATA%\mindmap`
  - macOS: `~/Library/Application Support/mindmap`
  - Linux: `$XDG_DATA_HOME/mindmap`（未設定なら `~/.local/share/mindmap`）
- **経緯**: 当初の案は「Windows は `AppData\LocalLow`、macOS / Linux は `~/.cache/mindmap`」だった。これに対して次の懸念を伝えた。
  - `LocalLow` は低権限プロセス用の場所で、一般的なアプリは `AppData\Local` を使う。
  - `~/.cache` は「消えても困らないキャッシュ」を置く慣習の場所で、クリーンアップツールに削除される可能性がある。永続データには `~/.local/share` や `~/Library/Application Support` が慣習に沿う。
  - 検討の結果、「OS の慣習に沿った場所」に変更することになった。
- **補足**: Electron の `app.getPath('userData')` は Windows で Roaming（`%APPDATA%`）を返すため使わず、自前で解決している。検証用に環境変数 `MINDMAP_DATA_DIR` で上書きできる。

### D-05 マップごとに 1 ファイルとし、複数マップを扱えるようにする

- **決定**: 1 マップ = 1 ファイル（`maps/<UUID>.xml`）。アプリ内にマップ一覧を持ち、作成・切り替え・削除ができる。
- **経緯**: 「1 ファイル固定か、マップごとに 1 ファイルで複数マップを扱うか」の確認に対し、後者が選ばれた。
- **影響**: Web 版も同じモデルに合わせ、localStorage にマップごとのキーで保存する。マップのタイトルはルートノードのテキストとし、別途の名前付け機能は持たない。

### D-06 自動保存を基本とし、Ctrl+S で明示的にも保存できるようにする

- **決定**: 変更から約 0.6 秒後に自動保存する。`Ctrl+S` と「保存」ボタンで即時保存できる。ツールバーに保存状態を表示する。
- **経緯**: 「自動保存か明示的な保存か」の確認に対し、「自動保存としつつ Ctrl+S でも保存できるように」という回答だった。
- **影響**: ウィンドウを閉じるときにも保留中の変更を書き出す。マップの切り替え・削除の前にも必ず書き出す。

### D-07 保存形式は XML を正規とし、JSON 形式は廃止する

- **決定**: ファイル保存・書き出し・読み込み・localStorage のすべてで同じ XML 形式を使う。最初の試作で使っていた JSON 形式は廃止し、移行処理も入れない。
- **経緯**: XML での保存が要望に含まれていた。形式を 1 つにして実装と仕様を単純にするため JSON は廃止した。JSON 形式のデータは当日の試作データしか存在しなかったため、移行は不要と判断した。
- **影響**: XML の生成・解釈はレンダラー側で行い（ブラウザ標準の `DOMParser` を使う）、Electron のメインプロセスはファイルの読み書きだけを担当する。形式の詳細は [spec.md](./spec.md#xml-形式) を参照。

### D-08 Electron のビルドには electron-vite を使う

- **決定**: `electron-vite` でメイン / preload / レンダラーをビルドし、インストーラは `electron-builder` で作る。
- **理由**: 既存の Vite 構成をほぼそのまま流用でき、開発時に HMR 付きで Electron ウィンドウを起動できる。
- **補足**: `package.json` が `"type": "module"` のため preload は ESM（`.mjs`）で出力され、Electron の制約により `sandbox: false` にしている（`contextIsolation` は有効）。`npm run package` によるインストーラ作成はまだ動作確認していない。

### D-09 Lint は oxlint、テストランナーは未導入

- **決定**: Lint は ESLint ではなく oxlint を使う（スキャフォルディング時の選択を踏襲）。単体テストはまだ導入していない。
- **補足**: 後から追加された汎用スキル `react-ts-test-lint-rules` は Vitest / ESLint / Prettier を前提にしている。導入する場合は依存パッケージの追加になるため、独立したコミットで行う（CLAUDE.md のコミットルール参照）。

### D-10 汎用の React + TypeScript 規約スキルと既存構成の差分は未解決

- **状況**: 機能実装のあとに `react-ts-structure-naming-rules` / `react-ts-component-design-rules` / `react-ts-test-lint-rules` が追加された。各スキルは「プロジェクトに既存の規約がある場合はそちらを優先し、差分があれば指摘する」としているため、既存構成はそのままにしている。
- **差分**:
  - ファイル名がパスカルケース（スキルはケバブケース）
  - `features/` 単位ではなく `model` / `storage` / `hooks` / `components` の種類単位の構成
  - `src/storage/index.ts` が barrel ファイル、`App.tsx` が default export
  - `@/` パスエイリアス未設定、ESLint ではなく oxlint
- **今後**: 規約に合わせて構成を移行するかどうかは未決定。移行する場合は機能変更と分けた独立のタスク・コミットで行う。

### D-11 ドキュメントの置き場所

- **決定**: 機能仕様は `docs/spec.md`、方針決定の経緯はこの `docs/decisions.md`、実装構成は `.claude/skills/mindmap-app-architecture/SKILL.md`、コマンドは `.claude/skills/mindmap-app-commands/SKILL.md` に書く。`readme.md` は概要と各ドキュメントへのリンクに留める。
- **経緯**: 「ここまでのやり取りの情報を CLAUDE.md または仕様面については docs 配下にまとめてほしい」という要望による。それまでは `readme.md` に仕様を書いていた。
