---
name: react-ts-component-design-rules
description: React + TypeScript でコンポーネントを作る・直す・レビューするときに使う。関数コンポーネント、Props の型定義、1ファイル1コンポーネント、ロジックの分離、state と副作用、JSX の書き方、ファイル内の並び順を定める。プロジェクト側に既存の規約がある場合はそちらを優先し、このルールとの差分があれば指摘する。
---

# React + TypeScript コンポーネント設計ルール

React + TypeScript でコンポーネントを作る・直す・レビューするときは、このルールに従う。プロジェクトに既存の規約がある場合はそちらを優先し、差分があれば指摘する。ファイル配置と命名は react-ts-structure-naming-rules、テストと Lint は react-ts-test-lint-rules に従う。

前提: React 19 系、TypeScript の `strict: true`。package.json を確認し、React 18 以前の場合は第3.4節（ref）の扱いを変える。

## 1. 関数コンポーネントのみ使う

- コンポーネントはすべて関数コンポーネントで書く。クラスコンポーネント（`class X extends React.Component`）は書かない。
- 唯一の例外は Error Boundary。自作せず `react-error-boundary` ライブラリを使う。
- 定義は `function` 宣言で書き、named export する。
- `React.FC` / `React.FunctionComponent` は使わない。Props は引数に直接型を付ける。

```tsx
// 良い例
type UserCardProps = {
  name: string;
  email: string;
};

export function UserCard({ name, email }: UserCardProps) {
  return (
    <div>
      <p>{name}</p>
      <p>{email}</p>
    </div>
  );
}

// 悪い例
export const UserCard: React.FC<UserCardProps> = ({ name, email }) => { /* ... */ };
```

理由:
- `function` 宣言はスタックトレースや React DevTools で名前が確実に表示され、定義より前に書いた箇所からも参照できる。
- `React.FC` を使うと、ジェネリクスを持つコンポーネントが書きにくくなる。引数に型を付ける方が通常の関数と同じ書き方で済む。
- 戻り値の型（`JSX.Element` など）は推論に任せ、書かない。

## 2. Props の型は `type` で定義する

- Props の型は `type` で定義する。`interface` は使わない。
- 名前は `コンポーネント名 + Props`（例: `UserCardProps`）。
- Props 型はコンポーネントと同じファイルの直前に置く。他のファイルで使う場合だけ export する。

理由:
- ユニオン型（「A または B」）を表せるのは `type` だけで、Props では後述の判別共用体をよく使う。最初から `type` に揃えておけば書き換えが不要になる。
- `interface` は同名で複数回宣言すると自動でマージされる（declaration merging）。意図せず型が変わる原因になる。
- 例外: 外部ライブラリの型を拡張する（モジュール拡張）ときは `interface` を使う。

ESLint で強制する:

```js
'@typescript-eslint/consistent-type-definitions': ['error', 'type'],
```

### 2.1 Props の書き方

- 引数で分割代入し、デフォルト値もそこで指定する。`defaultProps` は使わない。
- 省略可能な Props には `?` を付ける。`string | undefined` と書かない。
- 真偽値は `is` / `has` などで始める。イベントの Props は `on` で始める。
- 子要素を受け取る場合は `children: ReactNode` と明示する。

```tsx
import type { ReactNode } from 'react';

type PanelProps = {
  title: string;
  isCollapsible?: boolean;
  onClose?: () => void;
  children: ReactNode;
};

export function Panel({ title, isCollapsible = false, onClose, children }: PanelProps) {
  /* ... */
}
```

### 2.2 状態によって必要な Props が変わる場合は判別共用体にする

省略可能な Props を並べると、あり得ない組み合わせが型上許されてしまう。共通の判別プロパティで分ける。

```tsx
// 悪い例: status が 'error' なのに errorMessage がない状態を許してしまう
type ResultProps = {
  status: 'loading' | 'success' | 'error';
  data?: User[];
  errorMessage?: string;
};

// 良い例
type ResultProps =
  | { status: 'loading' }
  | { status: 'success'; data: User[] }
  | { status: 'error'; errorMessage: string };
```

### 2.3 HTML 要素を包むコンポーネント

ボタンや入力欄など、HTML 要素を包む汎用部品は `ComponentProps` で元の属性を引き継ぎ、残りを `...rest` で渡す。

```tsx
import type { ComponentProps } from 'react';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary';
};

export function Button({ variant = 'primary', type = 'button', ...rest }: ButtonProps) {
  return <button type={type} data-variant={variant} {...rest} />;
}
```

- `...rest` はこのような汎用 UI 部品でだけ使う。業務コンポーネントでは Props を明示する。

## 3. 1ファイル1コンポーネント

- 1ファイルで export するコンポーネントは1つにする。ファイル名はそのコンポーネント名のケバブケース（`UserCard` → `user-card.tsx`）。
- そのファイルの中でしか使わない小さな補助コンポーネントは、export せず同じファイルに書いてよい。ただし次のどれかに当てはまったら別ファイルに分ける。
  - 他のファイルでも使いたくなった
  - 独自の state や hook を持ち始めた
  - 単体でテストしたくなった
- コンポーネント以外のもの（定数、ユーティリティ関数、hook）をコンポーネントファイルから export しない。それぞれの場所（`utils/`, `hooks/`, `config/`）に置く。
  - 理由: コンポーネント以外の export が混ざると、開発中の Fast Refresh（画面を保ったままの差し替え）が効かず、ページ全体が再読み込みになる。
- 目安として、コンポーネントファイルが 200 行を超えたら分割を検討する。

ESLint で強制する（eslint-plugin-react-refresh）:

```js
'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
```

### 3.4 ref の受け渡し（React 19）

- React 19 では `ref` を通常の Props として受け取れる。`forwardRef` は使わない。

```tsx
type TextInputProps = ComponentProps<'input'> & { label: string };

export function TextInput({ label, ref, ...rest }: TextInputProps) {
  return (
    <label>
      {label}
      <input ref={ref} {...rest} />
    </label>
  );
}
```

- React 18 以前のプロジェクトでは `forwardRef` を使う。

## 4. 責務の分け方

### 4.1 ロジックはカスタム hook に出す

- コンポーネントの関数本体は「何を表示するか」に集中させる。データ取得、複数の state を組み合わせた処理、複雑なイベント処理はカスタム hook に切り出す。
- 目安: `useState` / `useEffect` が合わせて 3 つ以上になったら、hook への切り出しを検討する。
- 表示に関係ない計算（金額計算、バリデーション、変換）は React に依存しない純粋関数にして `utils/` に置く。

```tsx
// features/user/hooks/use-user-search.ts
export function useUserSearch() {
  const [keyword, setKeyword] = useState('');
  const { data: users = [], isPending } = useUsers();
  const filteredUsers = users.filter((u) => u.name.includes(keyword));
  return { keyword, setKeyword, filteredUsers, isPending };
}

// features/user/components/user-search.tsx
export function UserSearch() {
  const { keyword, setKeyword, filteredUsers, isPending } = useUserSearch();
  if (isPending) return <Spinner />;
  return (
    <>
      <SearchBox value={keyword} onChange={setKeyword} />
      <UserList users={filteredUsers} />
    </>
  );
}
```

### 4.2 汎用 UI 部品と業務コンポーネントを分ける

- `src/components/ui/` の汎用部品は、API 呼び出し、グローバル状態、業務用語を持たない。必要な値はすべて Props で受け取る。
- 業務コンポーネント（feature 配下）がデータを取得し、汎用部品に渡す。

### 4.3 Props のバケツリレーを避ける

- 受け取った Props を自分では使わずに子へ渡すだけの階層が 2 段以上続いたら、次の順で解消を検討する。
  1. `children` を使ってコンポーネントを外から組み合わせる（最優先）
  2. そのデータを使うコンポーネント自身に取得させる（React Query などは同じキーならキャッシュが共有される）
  3. Context を使う（テーマ、ログインユーザーなど、広い範囲で使う値に限る）

## 5. state と副作用

- **他の state や Props から計算できる値は state にしない。** レンダー中に計算する。

```tsx
// 悪い例
const [fullName, setFullName] = useState('');
useEffect(() => setFullName(`${lastName} ${firstName}`), [lastName, firstName]);

// 良い例
const fullName = `${lastName} ${firstName}`;
```

- `useEffect` は外部システムとの同期（イベントリスナー登録、タイマー、外部ライブラリの操作）にだけ使う。次の用途では使わない。
  - データ取得 → React Query などのライブラリを使う
  - ユーザー操作への反応 → イベントハンドラに書く
  - 派生値の計算 → レンダー中に計算する
- `useEffect` で登録したものは、クリーンアップ関数で必ず解除する。
- state は使うコンポーネントのできるだけ近くに置く。複数の子で共有する必要が出たときにだけ親へ引き上げる。
- `useMemo` / `useCallback` / `memo` は、計測で性能問題が確認できた箇所にだけ使う。React Compiler を導入しているプロジェクトでは自動でメモ化されるため、手では書かない。

## 6. JSX の書き方

- 条件で表示を切り替えるとき:
  - 表示するかしないかの2択 → `{isOpen && <Modal />}`
  - 2つのうちどちらか → 三項演算子
  - 3つ以上に分かれる → JSX の外で早期 return するか、判別共用体に対して `switch` を使う。三項演算子を入れ子にしない。
- `&&` の左辺に数値を置かない。`{count && <List />}` は count が 0 のとき画面に `0` が表示される。`{count > 0 && <List />}` と書く。
- リストの `key` にはデータの一意な ID を使う。配列の添字（index）は、並び替えや追加削除がない固定リスト以外では使わない。
- コンポーネントの中で別のコンポーネントを定義しない（毎回新しいコンポーネントとして扱われ、state が消える）。
- イベントハンドラは短いものなら JSX 内にアロー関数で書いてよい。複数行になるものは `handle〜` という名前の関数に出す。

## 7. コンポーネントファイルの中の並び順

1. import
2. ファイル内で使う定数
3. Props の型
4. export するコンポーネント
   - hook の呼び出し（必ず先頭で、条件分岐の中で呼ばない）
   - 派生値の計算
   - イベントハンドラ
   - 早期 return（読み込み中・エラー）
   - JSX の return
5. ファイル内だけで使う補助コンポーネント

## 8. レビュー時のチェックリスト

- [ ] 関数コンポーネント（`function` 宣言・named export）で、`React.FC` を使っていないか
- [ ] Props が `type` で `〜Props` という名前になっているか
- [ ] あり得ない Props の組み合わせを判別共用体で防いでいるか
- [ ] export するコンポーネントが1ファイル1つで、コンポーネント以外を export していないか
- [ ] ロジックがカスタム hook や純粋関数に切り出され、コンポーネントが肥大化していないか
- [ ] 計算で求まる値を state にしていないか、`useEffect` を外部同期以外に使っていないか
- [ ] `key` に一意な ID を使っているか
- [ ] `&&` の左辺が数値になっていないか
- [ ] 汎用 UI 部品が API や業務ロジックに依存していないか
