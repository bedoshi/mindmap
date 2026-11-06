---
name: react-ts-test-lint-rules
description: React + TypeScript プロジェクトでテストコード（Vitest / Testing Library / MSW）を書くとき、ESLint / Prettier を設定するとき、またそれらをレビューするときに使う。プロジェクト側に既存の設定や規約がある場合はそちらを優先し、このルールとの差分があれば指摘する。
---

# React + TypeScript テスト・Lint 実装ルール

React + TypeScript プロジェクトでテストコードを書くとき、ESLint / Prettier を設定するとき、またそれらをレビューするときは、このルールに従う。プロジェクト側に既存の設定や規約がある場合はそちらを優先し、このルールとの差分があれば指摘する。

## 1. 前提とするツールとバージョン

| 用途 | ツール | 前提 |
|---|---|---|
| テストランナー | Vitest | 4.x 系（Vite 6/7 系と組み合わせる） |
| DOM環境 | jsdom（標準）/ Vitest Browser Mode（必要時） | 実ブラウザ依存の挙動を検証するときだけ Browser Mode を使う |
| コンポーネントテスト | @testing-library/react, @testing-library/user-event, @testing-library/jest-dom | |
| APIモック | MSW（Mock Service Worker） | fetch / axios を直接モックしない |
| Lint | ESLint 10 + typescript-eslint v8 | flat config（`eslint.config.mjs`）のみ。`.eslintrc*` / `.eslintignore` は使わない |
| React向けLint | eslint-plugin-react-hooks, eslint-plugin-jsx-a11y | |
| 整形 | Prettier | 整形は Prettier に一任し、ESLint では整形ルールを持たない（eslint-config-prettier で衝突ルールを無効化） |

バージョンは書く前に package.json を確認し、上記と異なる場合はプロジェクトのバージョンに合わせる。

## 2. ESLint ルール

### 2.1 設定ファイルの基本形

```js
// eslint.config.mjs
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import testingLibrary from 'eslint-plugin-testing-library';
import vitest from '@vitest/eslint-plugin';
import prettier from 'eslint-config-prettier';

export default defineConfig(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  reactHooks.configs['recommended-latest'],
  jsxA11y.flatConfigs.recommended,
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    ...testingLibrary.configs['flat/react'],
    ...vitest.configs.recommended,
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  prettier, // 必ず最後に置き、整形系ルールを無効化する
);
```

### 2.2 守ること

- 設定は flat config で書き、`defineConfig()` を使う（`tseslint.config()` は使わない）。
- 型情報を使うルール（`recommendedTypeChecked`）を有効にする。`projectService: true` を指定する。
- `eslint-config-prettier` は配列の最後に置く。
- `// eslint-disable` は原則禁止。どうしても必要なときは行単位（`eslint-disable-next-line ルール名`）にし、理由をコメントで書く。
- `react-hooks/exhaustive-deps` の警告は依存配列を直して解消する。無効化コメントで黙らせない。
- `any` は使わない。型が不明な外部データは `unknown` で受け、型ガードかスキーマ検証（zod など）で絞り込む。
- 型だけの import は `import type` を使う。
- Promise を返す関数は `await` するか、意図的に放置する場合は `void` を付ける。

## 3. Prettier ルール

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- 整形の議論はしない。Prettier の出力を正とする。
- `.prettierignore` に `dist`, `coverage`, 自動生成ファイルを入れる。
- エディタの保存時整形と、CI の `prettier --check` の両方を設定する。

## 4. package.json スクリプト

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

- `--ext` フラグは使わない（flat config では `files` で対象を指定する）。
- CI では `lint` → `format:check` → `typecheck` → `test:run` の順に実行し、どれか1つでも失敗したらマージしない。
- コミット前チェック（lint-staged など）を入れる場合は、変更ファイルだけに `eslint --fix` と `prettier --write` をかける。

## 5. Vitest 設定

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts', 'src/main.tsx'],
      thresholds: { lines: 80, branches: 70 },
    },
  },
});
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
```

- `globals: false` にし、`describe` / `it` / `expect` / `vi` は `vitest` から明示的に import する。
- `restoreMocks: true` でテストごとにモックを元に戻す。
- MSW は `onUnhandledRequest: 'error'` にし、モックし忘れた通信を失敗として検出する。
- カバレッジの閾値は目安で、数値を満たすためだけのテストは書かない。

## 6. テストの書き方

### 6.1 配置と命名

- テストファイルは対象と同じディレクトリに `対象名.test.tsx` で置く（例: `UserForm.tsx` と `UserForm.test.tsx`）。
- `describe` に対象（コンポーネント名や関数名）を書き、`it` には「〜のとき、〜になる」形式で振る舞いを日本語で書く。

```ts
describe('UserForm', () => {
  it('名前が空のまま送信すると、エラーメッセージが表示される', async () => { /* ... */ });
});
```

### 6.2 テストの構造

- 準備（Arrange）・実行（Act）・検証（Assert）の3段に分け、空行で区切る。
- 1つのテストで検証する振る舞いは1つにする。`expect` が複数あってもよいが、同じ振る舞いの検証に限る。
- テスト間で状態を共有しない。共通の準備はファクトリ関数にまとめ、各テストで呼ぶ。

### 6.3 Testing Library のルール

**実装の詳細ではなく、ユーザーから見える振る舞いをテストする。**

要素の取得は次の優先順位で行う。

1. `getByRole`（`name` オプションと組み合わせる）: 最優先
2. `getByLabelText`: フォーム要素
3. `getByPlaceholderText`, `getByText`, `getByDisplayValue`
4. `getByAltText`, `getByTitle`
5. `getByTestId`: 上記で取れない場合の最終手段

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserForm } from './UserForm';

describe('UserForm', () => {
  it('名前を入力して送信すると、入力値を引数にonSubmitが呼ばれる', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<UserForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('名前'), '山田太郎');
    await user.click(screen.getByRole('button', { name: '送信' }));

    expect(onSubmit).toHaveBeenCalledWith({ name: '山田太郎' });
  });
});
```

守ること:

- 要素は `screen` から取得する（`render` の戻り値から分割代入しない）。
- ユーザー操作は `userEvent.setup()` で作った `user` を使い、`await` する。`fireEvent` は userEvent で再現できない場合だけ使う。
- 存在しないことの確認は `queryBy*` を使う: `expect(screen.queryByText('エラー')).not.toBeInTheDocument()`。
- 非同期に表示される要素は `findBy*` で待つ。`waitFor` の中に操作（クリックなど）を書かない。`waitFor` の中には `expect` を1つだけ書く。
- 検証には jest-dom のマッチャーを使う（`toBeInTheDocument`, `toBeDisabled`, `toHaveValue`, `toHaveAccessibleName` など）。
- `container.querySelector` やクラス名での取得はしない。
- コンポーネント内部の state や private な関数を直接検証しない。
- スナップショットテストは原則使わない。使う場合は小さく安定した出力に限る。

### 6.4 モックのルール

- APIの呼び出しは MSW のハンドラでモックする。`vi.mock('axios')` や `global.fetch` の差し替えはしない。
- `vi.mock` は外部モジュール境界（日付・乱数・ルーター・外部SDK）に限る。テスト対象と同じ層の自作モジュールはなるべくモックしない。
- 時刻に依存する処理は `vi.useFakeTimers()` と `vi.setSystemTime()` で固定し、テスト後に `vi.useRealTimers()` で戻す。
- 呼び出し検証（`toHaveBeenCalledWith`）は、コールバック props など外部への出力を確かめるときに使う。

### 6.5 カスタム hook のテスト

- まず、その hook を使うコンポーネント経由でテストできないか検討する。
- 単体でテストする場合は `renderHook` を使い、状態更新は `act` で包む。

```ts
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('incrementを呼ぶと、countが1増える', () => {
    const { result } = renderHook(() => useCounter(0));

    act(() => result.current.increment());

    expect(result.current.count).toBe(1);
  });
});
```

### 6.6 Provider が必要なコンポーネント

ルーター、React Query、テーマなどの Provider は `src/test/render.tsx` に共通の `renderWithProviders` を作り、それを使う。テストごとに Provider を手書きしない。React Query の `QueryClient` はテストごとに新しく作り、`retry: false` にする。

## 7. テストを書く対象の優先度

1. ビジネスロジックを持つ純粋関数（バリデーション、計算、変換）: 必ず書く
2. ユーザー操作で分岐するコンポーネント（フォーム、条件表示）: 必ず書く
3. カスタム hook: ロジックを持つものは書く
4. 見た目だけのコンポーネント: 原則書かない（必要なら Storybook や Browser Mode の視覚回帰テストで補う）

## 8. レビュー時のチェックリスト

- [ ] `lint` / `format:check` / `typecheck` / `test:run` がすべて通るか
- [ ] `eslint-disable` に理由コメントがあるか
- [ ] `any` や不要な `as` キャストがないか
- [ ] 要素取得が `getByRole` などユーザー視点のクエリになっているか（`getByTestId` の多用はないか）
- [ ] `userEvent` を `await` しているか
- [ ] 非同期待ちに `findBy*` を使い、`waitFor` の使い方が正しいか
- [ ] API モックが MSW で書かれているか
- [ ] テスト名が振る舞いを表しているか
- [ ] 実装の詳細（state・内部関数・クラス名）に依存したテストになっていないか
