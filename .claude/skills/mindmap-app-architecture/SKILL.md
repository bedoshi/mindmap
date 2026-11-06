---
name: mindmap-app-architecture
description: このリポジトリ（マインドマップWebアプリ）のディレクトリ構成・技術的な決定事項（状態管理、レイアウト計算、保存層の抽象化と XML 形式、lintツール、TypeScript設定の分割など）を把握・変更する際に使う。
---

# 構成

- `src/main.tsx` がエントリーポイント。`src/App.tsx` をルートコンポーネントとしてDOMにマウントする、標準的なVite+Reactの構成。
- Lintは ESLint ではなく **oxlint** を使用（`.oxlintrc.json` で設定）。ESLint系のプラグインは使えないため、lintルールを追加する場合はoxlintの設定方法に従うこと。
- TypeScript設定は `tsconfig.json` から `tsconfig.app.json`（アプリコード用）と `tsconfig.node.json`（Vite設定など node 側コード用）を参照する分割構成。
- 追加の依存パッケージは使っていない（React + 標準の DOM / SVG のみ）。状態管理ライブラリや描画ライブラリを導入する場合は、このドキュメントも更新すること。

## ディレクトリ構成

```
src/
  main.tsx                 エントリーポイント
  App.tsx                  保存先の生成、useMapLibrary の呼び出し、MindMapEditor の描画
  App.css                  エディタ・ノード・ツールバー・マップ一覧パネルのスタイル
  index.css                CSS変数（ライト/ダーク）とリセット
  model/
    types.ts               MindMap / MindMapNode などのデータ型
    mindmap.ts             ツリー操作の純粋関数（追加・削除・移動・折りたたみなど）
    layout.ts              自動レイアウト計算（座標・接続線のパス・枝の色）
  storage/
    types.ts               MapStorage / MapSummary（保存先の抽象インターフェース）
    xml.ts                 MindMap ⇔ XML の相互変換、タイトル取得
    localStorageStorage.ts localStorage への保存
    index.ts               createStorage(): 保存先の MapStorage を返す
  hooks/
    useMindMap.ts          開いている 1 マップの履歴付き状態管理（Undo/Redo）
    useMapLibrary.ts       複数マップの一覧・切り替え・作成・削除と自動保存
  components/
    MindMapEditor.tsx      エディタ本体（選択・編集・キーボード・パン/ズーム・ドラッグ・保存操作）
    NodeView.tsx           ノード1つの描画（テキスト / 編集用 input / 折りたたみボタン）
    Toolbar.tsx            ツールバー（表示専用。状態は MindMapEditor が持つ）
    MapListPanel.tsx       マップ一覧パネル（表示専用）
```

## データモデル（`src/model/types.ts`）

- `MindMap = { rootId, nodes: Record<NodeId, MindMapNode> }` のフラットな構造。親子関係は各ノードの `parentId` と `children`（表示順）で双方向に持つ。
- `MindMapNode.side`（`left` | `right`）はルート直下のノードにのみ付与し、ルートのどちら側に出すかを表す。それ以外のノードは親と同じ側に配置されるため持たない。
- ノードID・マップIDは `crypto.randomUUID()` で生成する。

## 状態管理

### 開いているマップ（`src/hooks/useMindMap.ts`）

- `useReducer` で `{ past, present, future }` の履歴付き状態を持ち、編集アクションごとに `present` を `past` へ積む（上限 100 件）。Undo/Redo はこのスタックの入れ替え。
- 実際のツリー変更は `src/model/mindmap.ts` の純粋関数に委譲する。変更がない場合は同じ参照を返す約束なので、reducer は参照比較で「変更なし」を判定して履歴に積まない。
- 保存は行わない。`MindMapEditor` が `present` の変化を `useMapLibrary` の `reportChange` に通知する。
- 選択中ノード・編集中テキスト・ズーム/パンなどの UI 状態は履歴に含めず、`MindMapEditor` のローカル state で持つ。

### マップの一覧と保存（`src/hooks/useMapLibrary.ts`）

- `MapStorage` を受け取り、一覧（`maps`）・現在のマップ（`current`）・保存状態（`saveState`）を管理する。
- 初期化時に一覧を取得して更新日時が最新のマップを開く。1 つもなければ新規作成する。初期化処理は `useRef` に Promise を保持して、StrictMode の二重実行でもマップが二重に作られないようにしている。
- 自動保存は `reportChange` でデバウンス（600ms）し、`saveNow`（Ctrl+S / 保存ボタン）と `pagehide` で即時に書き出す。保存に失敗した変更は保持して次回再試行する。
- マップの切り替え・作成・削除の前には必ず保留中の変更を書き出す（`flush`）。
- `App` はマップ ID を `key` にして `MindMapEditor` を作り直すことで、履歴・選択・表示位置をマップごとにリセットしている。そのため一覧パネルの開閉状態もマップ切り替え時に閉じる。

## 保存層（`src/storage/`）

- `MapStorage` インターフェース（`list / load / save / remove / describeLocation`）で保存先を抽象化し、`createStorage()` が実装を返す。別の保存先（ファイルなど）を足すときは、このインターフェースの実装を追加して `createStorage()` で切り替える。
- **XML が正規の保存形式**。localStorage でも値には XML 文字列を入れ、一覧表示用にタイトルと更新日時を JSON で添えている。書き出し/読み込みのファイルも同じ XML。
- XML のシリアライズは `xml.ts` で自前の文字列組み立て（インデント付き）、パースはブラウザ標準の `DOMParser`。

## レイアウト（`src/model/layout.ts`）

- 毎レンダリングで `computeLayout(map)` を `useMemo` で計算する純粋関数。ルートを原点 (0,0) に置き、各部分木の高さを先に集計してから再帰的に座標を決める。
- ルート直下は `side` で左右に分け、それぞれ縦に積む。ルートに子を追加するときの側は `mindmap.ts` の `pickSide` が部分木のノード数の少ない側を選ぶ。
- ノード幅は Canvas の `measureText` でテキスト幅を測って決める。フォント指定（`NODE_FONT` / `ROOT_FONT`）を `NodeView` の inline style にも適用して、計測と描画のフォントを一致させている。CSS 側で padding や border を変えるときは `layout.ts` の定数と整合させること（枠線ありのノードは padding を枠線分だけ減らしている）。
- 接続線は 3 次ベジェ曲線の SVG パス文字列として返す。枝の色は `BRANCH_COLORS` をルート直下ノードの順序で割り当てる。
- 編集中はドラフトテキストでレイアウトを計算し、入力に合わせてノード幅が追従するようにしている。

## 描画と操作（`src/components/MindMapEditor.tsx`）

- キャンバスは `overflow: hidden` の `.canvas` の中に、`transform: translate(...) scale(...)` を当てた `.viewport` を置き、その中に接続線用の SVG（`overflow: visible`）と絶対配置したノード（HTML）を並べる構成。SVG と HTML を同じ transform 配下に置くことでパン/ズームを 1 箇所で扱う。
- ポインタ操作は `.canvas` の Pointer Events でまとめて処理する（背景ドラッグ＝パン、ノードドラッグ＝付け替え）。`setPointerCapture` を使うため `dblclick` がノード要素に届かないことがあり、ダブルクリックは pointerdown の間隔で自前判定している（`dblclick` もフォールバックで処理）。
- ドロップ先の判定は `document.elementFromPoint` で `[data-node-id]` を探す。ゴースト要素は `pointer-events: none`。
- ホイールイベントは `preventDefault` が必要なため React の `onWheel` ではなく `addEventListener('wheel', ..., { passive: false })` で登録している。
- キーボードショートカットは `window` の `keydown` で処理し、編集中（input にフォーカスがある間）は無効化する。IME 変換中（`isComposing`）の Enter は確定扱いにしない。
