---
name: react-ts-structure-naming-rules
description: React + TypeScript プロジェクトで新しいファイルやディレクトリを作るとき、配置先を決めるとき、構成をレビュー・リファクタリングするときに使う。feature 単位の構成、依存方向、import、ファイル名・識別子の命名規則を定める。プロジェクト側に既存の構成規約がある場合はそちらを優先し、このルールとの差分があれば指摘する。
---

# React + TypeScript ディレクトリ構成・命名規則

React + TypeScript プロジェクトで新しいファイルやディレクトリを作るとき、配置先を決めるとき、構成をレビュー・リファクタリングするときは、このルールに従う。プロジェクトに既存の構成規約がある場合はそちらを優先し、このルールとの差分があれば指摘する。

## 1. 基本方針

- **feature（機能）単位で構成する。** 種類単位（components / hooks / api をトップレベルに並べる形）だけでは構成しない。
- 1つの機能に関するコード（画面部品・hook・API呼び出し・型・テスト）は、その機能のディレクトリにまとめる。
- 複数の feature で共有するものだけを、`src` 直下の共有ディレクトリに置く。
- 依存の向きは **shared → features → app** の一方向にする（後述）。

## 2. ディレクトリ構成

```
src/
├── app/                 # アプリの組み立て（エントリ、ルーティング、Provider）
│   ├── routes/          # ルート（画面）定義。feature を組み合わせる場所
│   ├── provider.tsx     # 全体の Provider をまとめる
│   └── router.tsx
├── features/            # 機能ごとのディレクトリ
│   ├── user/
│   │   ├── api/         # API 呼び出しとクエリ（例: get-users.ts）
│   │   ├── components/  # この機能専用のコンポーネント
│   │   ├── hooks/       # この機能専用の hook
│   │   ├── stores/      # この機能専用の状態
│   │   ├── types/       # この機能専用の型
│   │   └── utils/       # この機能専用の関数
│   └── order/
│       └── ...
├── components/          # 複数 feature で使う汎用 UI 部品（Button, Modal など）
│   ├── ui/              # 見た目だけの基本部品
│   └── layouts/         # 画面レイアウト
├── hooks/               # 複数 feature で使う汎用 hook
├── lib/                 # 外部ライブラリの初期化・ラッパー（api-client.ts, query-client.ts など）
├── config/              # 環境変数の読み込みや定数
├── types/               # アプリ全体で共有する型
├── utils/               # 複数 feature で使う純粋関数
├── assets/              # 画像・フォントなど
└── test/                # テスト共通設定（setup.ts, msw/, render.tsx）
```

ルール:

- feature 内のサブディレクトリ（api, components, hooks など）は**必要になったものだけ作る**。空のディレクトリを先に作らない。
- feature の中にさらに feature を入れ子にしない。大きくなった feature は兄弟 feature に分割する。
- 新しいファイルの置き場所に迷ったら、次の順で判断する。
  1. 1つの feature だけで使う → その feature の中
  2. 2つ以上の feature で使う → `src` 直下の共有ディレクトリ
  3. 最初は1つの feature で使っていたが、後から別の feature でも必要になった → そのときに共有ディレクトリへ移す（最初から共有に置かない）
- `app/routes` のファイルは薄く保つ。データ取得や業務ロジックは feature 側に置き、ルートは feature のコンポーネントを組み合わせるだけにする。

## 3. 依存方向のルール

```
components / hooks / lib / types / utils / config  （共有）
        ↓ import できる
features/*
        ↓ import できる
app
```

- 共有ディレクトリは `features` や `app` を import しない。
- `features` は `app` を import しない。
- **feature 同士は直接 import しない。** feature A の機能が feature B で必要になった場合は、次のどちらかで解決する。
  - 共通部分を共有ディレクトリに移す
  - `app` 層で両方の feature を組み合わせる（props や children で受け渡す）
- このルールは ESLint で強制する（第7章）。

## 4. import のルール

- `src` からの絶対パスを `@/` エイリアスで書く。`../../../` のような深い相対パスを使わない。同じディレクトリ内や1階層上までなら相対パスでよい。

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

```ts
// vite.config.ts（Vite 側にも同じエイリアスを設定する）
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
});
```

- **barrel ファイル（`index.ts` でまとめて再 export するファイル）は作らない。** ファイルを直接 import する。
  - 理由: barrel を経由すると、使わないモジュールまで読み込まれて開発サーバーやテストが遅くなり、循環参照も起きやすくなる。

```ts
// 良い例
import { UserList } from '@/features/user/components/user-list';

// 悪い例（barrel 経由）
import { UserList } from '@/features/user';
```

## 5. 命名規則

### 5.1 ファイル名・ディレクトリ名

**ファイル名とディレクトリ名はすべてケバブケース（小文字＋ハイフン）にする。**

| 種類 | ファイル名の例 | 中で export する名前 |
|---|---|---|
| コンポーネント | `user-list.tsx` | `UserList`（パスカルケース） |
| カスタム hook | `use-user-filter.ts` | `useUserFilter`（use + キャメルケース） |
| API 呼び出し | `get-users.ts`, `create-order.ts` | `getUsers`, `useUsers` など |
| 型定義 | `user.ts`（types/ 配下） | `User`, `UserRole` |
| ユーティリティ | `format-date.ts` | `formatDate` |
| 状態（store） | `cart-store.ts` | `useCartStore` |
| 定数 | `routes.ts`（config/ 配下） | `ROUTES` |
| テスト | `user-list.test.tsx` | 対象ファイルと同じ場所に置く |
| ディレクトリ | `user-profile/`, `order-history/` | |

理由:

- macOS と Windows のファイルシステムは大文字・小文字を区別しない。`UserList.tsx` を `userList.tsx` に変えるような変更を Git が検出できず、Linux の CI だけで import エラーになる事故が起きる。全部小文字にすれば、この問題は原理的に起きない。
- ファイル名の規則が1種類だけなので、種類ごとに「この種類はパスカルケース、これはキャメルケース」と覚える必要がない。

### 5.2 コード内の識別子

| 対象 | 規則 | 例 |
|---|---|---|
| コンポーネント | パスカルケース | `UserList`, `OrderDetailModal` |
| 型・interface | パスカルケース。`I` 接頭辞は付けない | `User`（`IUser` にしない） |
| Props の型 | コンポーネント名 + `Props` | `UserListProps` |
| hook | `use` + キャメルケース | `useUserFilter` |
| 関数・変数 | キャメルケース | `formatDate`, `userCount` |
| 真偽値 | `is` / `has` / `can` / `should` で始める | `isLoading`, `hasError` |
| イベントハンドラ（props） | `on` + 動詞 | `onSubmit`, `onChange` |
| イベントハンドラ（実装） | `handle` + 動詞 | `handleSubmit` |
| 定数（変更しない設定値） | 大文字スネークケース | `MAX_RETRY_COUNT` |
| enum 代わりのユニオン型 | パスカルケースの型 + 文字列リテラル | `type OrderStatus = 'pending' \| 'shipped'` |

- TypeScript の `enum` は使わず、文字列リテラルのユニオン型か `as const` オブジェクトを使う。
- export は **named export** にする（`export default` は使わない）。名前が import 側で勝手に変わるのを防ぎ、検索や一括リネームをしやすくするため。ただし、フレームワークが default export を要求するファイル（設定ファイル、ルートの遅延読み込みなど）は例外とする。
- 1ファイルで export するコンポーネントは原則1つにする。そのファイルでしか使わない小さな部品は、export せずに同じファイル内に書いてよい。

### 5.3 API 関連の命名

- API 呼び出しの関数は「動詞 + 対象」で命名する: `getUsers`, `getUser`, `createUser`, `updateUser`, `deleteUser`。
- 1つの API 操作につき1ファイルにし、関数・型・クエリ hook を同じファイルに置く。

```ts
// features/user/api/get-users.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { User } from '@/features/user/types/user';

export const getUsers = (): Promise<User[]> => api.get('/users');

export const useUsers = () =>
  useQuery({ queryKey: ['users'], queryFn: getUsers });
```

## 6. ファイルを作るときの手順

1. どの feature の話かを決める。どの feature にも属さないなら共有ディレクトリにする。
2. 種類（component / hook / api / type / util）に応じたサブディレクトリを選ぶ。なければ作る。
3. ケバブケースでファイル名を付ける。中の識別子は第5.2節の規則で付ける。
4. テストを書く場合は同じディレクトリに `同名.test.ts(x)` で置く。
5. import は `@/` から書き、別 feature を import していないか確認する。

## 7. ESLint による強制

命名と依存方向のルールは人の注意に頼らず、ESLint で検査する。前提は ESLint 10 の flat config（`eslint.config.mjs`）。

```js
// eslint.config.mjs に追加するブロック
import checkFile from 'eslint-plugin-check-file';
import importPlugin from 'eslint-plugin-import';

export default defineConfig(
  // ...既存の設定...
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'check-file': checkFile },
    rules: {
      // ファイル名をケバブケースに強制（.test などの付加部分は無視）
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      // ディレクトリ名をケバブケースに強制
      'check-file/folder-naming-convention': [
        'error',
        { 'src/**/': 'KEBAB_CASE' },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { import: importPlugin },
    rules: {
      'import/no-default-export': 'error',
      'import/no-cycle': 'error',
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            // feature 同士の import を禁止（feature ごとに1行ずつ追加する）
            { target: './src/features/user', from: './src/features', except: ['./user'] },
            { target: './src/features/order', from: './src/features', except: ['./order'] },
            // features から app への import を禁止
            { target: './src/features', from: './src/app' },
            // 共有ディレクトリから features と app への import を禁止
            {
              target: ['./src/components', './src/hooks', './src/lib', './src/types', './src/utils', './src/config'],
              from: ['./src/features', './src/app'],
            },
          ],
        },
      ],
    },
  },
  {
    // default export が必要な設定ファイルは除外
    files: ['*.config.{ts,mjs}', 'src/app/routes/**'],
    rules: { 'import/no-default-export': 'off' },
  },
);
```

- 新しい feature を追加したら、`import/no-restricted-paths` の zones にその feature の行を追加する。
- プラグインのバージョンが flat config に対応しているか、導入時に確認する。

## 8. レビュー時のチェックリスト

- [ ] 新しいファイルが正しい feature、または共有ディレクトリに置かれているか
- [ ] 1つの feature でしか使わないものを共有ディレクトリに置いていないか
- [ ] feature 同士が直接 import していないか
- [ ] ファイル名・ディレクトリ名がケバブケースか
- [ ] コンポーネントはパスカルケース、hook は `use` 始まりか
- [ ] named export になっているか（例外ファイルを除く）
- [ ] barrel ファイル（`index.ts` での再 export）を作っていないか
- [ ] 深い相対パスではなく `@/` で import しているか
- [ ] `app/routes` に業務ロジックが入り込んでいないか
