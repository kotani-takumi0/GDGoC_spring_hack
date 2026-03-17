// =============================================================================
// Todoアプリ デモ用プリセットコード
// =============================================================================

export interface DemoFile {
  readonly filename: string;
  readonly code: string;
  readonly description: string;
}

export const TODO_APP_DEMO_FILES: readonly DemoFile[] = [
  {
    filename: "index.html",
    description: "アプリのUI構造を定義するHTMLファイル",
    code: `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Todoアプリ</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: #f0f4f8;
      color: #334155;
      padding: 32px 16px;
    }
    .container {
      max-width: 480px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      padding: 24px;
    }
    h1 {
      font-size: 20px;
      margin-bottom: 16px;
      color: #1e293b;
    }
    .input-row {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    .input-row input {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
    }
    .input-row input:focus { border-color: #6366f1; }
    .btn {
      padding: 10px 18px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-add { background: #6366f1; color: #fff; }
    .btn-add:hover { background: #4f46e5; }
    .btn-delete { background: #fee2e2; color: #dc2626; font-size: 12px; padding: 4px 10px; }
    .btn-delete:hover { background: #fecaca; }
    .todo-list { list-style: none; }
    .todo-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .todo-item:last-child { border-bottom: none; }
    .todo-item.done .todo-text { text-decoration: line-through; color: #94a3b8; }
    .todo-text { flex: 1; font-size: 14px; }
    .stats { margin-top: 16px; font-size: 13px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📝 Todoアプリ</h1>
    <div class="input-row">
      <input type="text" id="todo-input" placeholder="新しいタスクを入力...">
      <button class="btn btn-add" id="add-btn">追加</button>
    </div>
    <ul class="todo-list" id="todo-list"></ul>
    <div class="stats" id="stats"></div>
  </div>
</body>
</html>`,
  },
  {
    filename: "types.ts",
    description: "型定義と変数 — データの形を決める",
    code: `// === 変数とデータ型 ===
// Todoアイテム1つの形を「型」として定義します。
// 型を使うことで、データの構造を明確にし、間違いを防ぎます。

// Todo1つ分のデータの形
type Todo = {
  id: number;       // 一意の識別番号
  text: string;     // タスクの内容（文字列）
  done: boolean;    // 完了したかどうか（真偽値）
};

// IDを自動で増やすためのカウンター変数
let nextId: number = 1;

// === 配列・リスト ===
// 複数のTodoをまとめて管理する配列（リスト）です。
// 配列を使うことで、タスクを追加・削除・一覧表示できます。
let todos: Todo[] = [];`,
  },
  {
    filename: "logic.ts",
    description: "関数・条件分岐・ループ — アプリのロジック",
    code: `// === 関数定義 ===
// 処理をまとめて名前をつけることで、何度でも呼び出せます。

// 新しいTodoを追加する関数
function addTodo(text: string): void {
  // 新しいTodoオブジェクトを作成して配列に追加
  const newTodo: Todo = {
    id: nextId,
    text: text,
    done: false,
  };
  nextId = nextId + 1;
  todos.push(newTodo);
}

// Todoを削除する関数
function deleteTodo(id: number): void {
  // 指定したID以外のTodoだけを残す（フィルタリング）
  todos = todos.filter(function(todo: Todo): boolean {
    return todo.id !== id;
  });
}

// === 条件分岐 ===
// 条件によって処理を分けます。

// 完了/未完了を切り替える関数
function toggleTodo(id: number): void {
  // 配列の中から該当するTodoを探す
  for (let i = 0; i < todos.length; i++) {
    if (todos[i].id === id) {
      // 条件分岐: 完了なら未完了に、未完了なら完了にする
      if (todos[i].done) {
        todos[i].done = false;
      } else {
        todos[i].done = true;
      }
    }
  }
}

// === ループ処理 ===
// 配列の全要素を順番に処理します。

// Todo一覧を画面に表示する関数
function renderTodos(): void {
  const listEl = document.getElementById("todo-list") as HTMLElement;
  const statsEl = document.getElementById("stats") as HTMLElement;
  listEl.innerHTML = "";

  let doneCount: number = 0;

  // ループ: todosの各アイテムについて処理
  for (let i = 0; i < todos.length; i++) {
    const todo: Todo = todos[i];

    // 完了数をカウント
    if (todo.done) {
      doneCount = doneCount + 1;
    }

    // HTMLを組み立てて画面に追加
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.done ? " done" : "");
    li.innerHTML =
      '<input type="checkbox" ' + (todo.done ? "checked" : "") + '>' +
      '<span class="todo-text">' + todo.text + '</span>' +
      '<button class="btn btn-delete">削除</button>';

    // チェックボックスのイベント
    const checkbox = li.querySelector("input") as HTMLInputElement;
    checkbox.addEventListener("change", function(): void {
      toggleTodo(todo.id);
      renderTodos();
    });

    // 削除ボタンのイベント
    const deleteBtn = li.querySelector(".btn-delete") as HTMLButtonElement;
    deleteBtn.addEventListener("click", function(): void {
      deleteTodo(todo.id);
      renderTodos();
    });

    listEl.appendChild(li);
  }

  // 統計情報を表示
  statsEl.textContent =
    "合計: " + todos.length + "件 ／ 完了: " + doneCount + "件";
}`,
  },
  {
    filename: "app.ts",
    description: "イベント処理・状態管理 — ユーザー操作でアプリを動かす",
    code: `// === イベント処理 ===
// ユーザーの操作（クリック、キー入力）に反応してプログラムを実行します。

const inputEl = document.getElementById("todo-input") as HTMLInputElement;
const addBtn = document.getElementById("add-btn") as HTMLButtonElement;

// 「追加」ボタンがクリックされたときのイベント処理
addBtn.addEventListener("click", function(): void {
  const text: string = inputEl.value.trim();

  // 条件分岐: 空欄なら追加しない
  if (text === "") {
    return;
  }

  // === 状態管理 ===
  // addTodo関数で状態（todos配列）を更新し、
  // renderTodos関数で画面を再描画します。
  // この「状態を変更 → 画面を更新」の流れが状態管理の基本です。
  addTodo(text);
  inputEl.value = "";
  renderTodos();
});

// Enterキーでも追加できるようにする（イベント処理）
inputEl.addEventListener("keypress", function(event: KeyboardEvent): void {
  if (event.key === "Enter") {
    addBtn.click();
  }
});

// 初期表示
renderTodos();
console.log("Todoアプリが起動しました！");`,
  },
];

export const TODO_APP_DEMO = {
  files: TODO_APP_DEMO_FILES,
  language: "typescript",
  explanation: "Todoアプリを4つのファイルに分割しました。types.ts（型と変数）、logic.ts（関数・条件分岐・ループ）、app.ts（イベント処理・状態管理）、index.html（UI）です。",
};
