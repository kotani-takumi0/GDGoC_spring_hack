# シナリオ定義

開発開始後、このファイルの内容をJSONファイルに変換して使用する。

---

## シナリオ1：Todoアプリ（React）

タスクの追加・完了・削除ができるシンプルなTodoアプリ。デモ用の1本目。

### 概念ノード一覧（7個）

| # | ID | タイトル | サブタイトル（初心者向け） | 依存先 |
|---|-----|---------|------------------------|--------|
| 1 | component-design | コンポーネント設計 | 画面を部品に分ける考え方 | なし |
| 2 | jsx | JSX記法 | JavaScriptの中にHTMLのようなUIを書く方法 | component-design |
| 3 | state-management | 状態管理 | データを覚えておく仕組み | component-design |
| 4 | list-rendering | リスト表示 | 一覧を並べて表示する | jsx, state-management |
| 5 | event-handling | イベントハンドリング | ボタンを押したときの動作 | state-management |
| 6 | conditional-rendering | 条件付きレンダリング | 状態に応じて表示を切り替える | list-rendering |
| 7 | persistence | 永続化 | 閉じても消えないようにする | state-management |

### 依存関係グラフ

```
component-design
  ├→ jsx ─────────────┐
  └→ state-management ─┤→ list-rendering → conditional-rendering
                       ├→ event-handling
                       └→ persistence
```

### 各ノードのコード対応（Step 4用フォールバック）

| ノード | コード例 | 説明 |
|--------|---------|------|
| component-design | `function App() { ... }` | アプリ全体を1つの関数として定義している部分 |
| jsx | `return ( <div>...</div> )` | 関数の中でHTMLのような記法でUIを記述している部分 |
| state-management | `const [todos, setTodos] = useState([])` | Todoリストのデータを保持し、変更を画面に反映させる仕組み |
| list-rendering | `todos.map(todo => <li key={todo.id}>...</li>)` | 配列のデータを1つずつ画面上の要素に変換して表示する部分 |
| event-handling | `onClick={() => handleAdd(newTodo)}` | ユーザーの操作に反応して状態を更新する部分 |
| conditional-rendering | `todo.completed ? <s>{todo.text}</s> : todo.text` | Todoの完了/未完了に応じて表示スタイルを変える部分 |
| persistence | `localStorage.setItem('todos', JSON.stringify(todos))` | ブラウザを閉じてもデータが残るよう保存する部分 |

---

## 経験レベル定義

| ID | ラベル | 説明 |
|----|--------|------|
| complete-beginner | 完全初心者 | プログラミング自体が初めて |
| python-experienced | Python経験あり | Pythonは書けるが、Web開発・Reactは初めて |
| other-language-experienced | 他言語でのWeb開発経験あり | 他のフレームワークでWeb開発経験があるが、Reactは初めて |
