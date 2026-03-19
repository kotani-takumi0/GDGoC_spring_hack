// =============================================================================
// デモモード用 — 事前定義された質問・模範解答・よくある間違いパターン
// =============================================================================

export interface DemoQuestion {
  readonly conceptId: string;
  readonly question: string;
  readonly modelAnswer: string;
  readonly commonMistakes: readonly {
    readonly answer: string;
    readonly feedback: string;
  }[];
}

export const DEMO_QUESTIONS: readonly DemoQuestion[] = [
  {
    conceptId: 'variable',
    question: '右のコードで `let nextId: number = 1;` ってあるよね。もしこれを `const` に変えたら何が起きる？なんで `let` じゃないとダメなのか説明してみて。',
    modelAnswer: 'nextIdはタスクを追加するたびに1ずつ増える（インクリメントされる）ので、値が変わります。constは再代入できないため、nextId++でエラーになります。値が変わる変数にはletを使う必要があります。',
    commonMistakes: [
      {
        answer: '変数は値を入れる箱です。letもconstも同じだと思います。',
        feedback: 'letとconstの違いを理解できていないパターン。「再代入できるかどうか」がポイント。',
      },
    ],
  },
  {
    conceptId: 'array',
    question: '右のコードでTodoリストに新しいタスクを追加している部分を見つけて。もし配列じゃなくて普通の変数1つだけでTodoを管理しようとしたら、何が困る？',
    modelAnswer: '変数1つでは1件のタスクしか保持できません。配列を使うことで複数のタスクをまとめて管理でき、push()で追加、filter()で削除、forEach/mapで一覧表示ができます。Todoアプリはタスクの数が動的に変わるので配列が必須です。',
    commonMistakes: [
      {
        answer: '配列はデータの並びです。pushで取り出して、filterで追加すると思います。',
        feedback: 'push/filterの役割が逆。pushは追加、filterは条件で絞り込み（削除に使う）。',
      },
    ],
  },
  {
    conceptId: 'function',
    question: '右のコードの `addTodo` 関数を見て。もしこの関数を作らずに、同じ処理をボタンクリックのたびに直接書いてたらどうなると思う？',
    modelAnswer: '同じ処理を複数箇所に書くことになり、修正が必要になったとき全箇所を直す必要があります。関数にまとめることで1箇所の修正で済み、コードの重複がなくなります。また、関数名がドキュメントの役割を果たし、コードが読みやすくなります。',
    commonMistakes: [
      {
        answer: '関数は処理をまとめたものです。addTodoは何かを追加する関数だと思います。',
        feedback: '関数の定義は言えているが「なぜ関数にするのか」（再利用性・保守性）を理解できていない。',
      },
    ],
  },
  {
    conceptId: 'conditional',
    question: '右のコードでタスクの完了/未完了を切り替えている部分を見て。もし条件分岐なしで完了状態を管理しようとしたら、どんな問題が起きる？',
    modelAnswer: '条件分岐がないと、完了・未完了に関係なく全タスクに同じ処理が適用されます。例えば取り消し線の表示/非表示を切り替えられなくなり、ユーザーにどのタスクが完了済みか区別がつかなくなります。if文で状態を判定することで、状態に応じた異なるUIを表示できます。',
    commonMistakes: [
      {
        answer: '条件分岐はifを使うことです。todo.doneがtrueかfalseかを見ている気がします。',
        feedback: 'if文の存在は知っているが「なぜ必要か」「ないとどうなるか」を具体的に説明できていない。',
      },
    ],
  },
  {
    conceptId: 'loop',
    question: '右のコードでTodoリストを画面に表示している部分を見て。もしループを使わずに、1個ずつ手動で表示するコードを書いてたらどうなる？',
    modelAnswer: 'タスクの数が固定でないため、手動では対応できません。3件なら3行書けますが、100件になったら100行必要です。ループを使えばタスクが何件でも同じコードで全件表示できます。forEachやmapで配列の各要素に同じ処理を適用するのがポイントです。',
    commonMistakes: [
      {
        answer: 'ループは繰り返しです。forEachもmapも同じで、配列の中身を一つずつ見ます。',
        feedback: 'forEachとmapの違いを理解できていない。mapは新しい配列を返す（DOM要素の生成に使う）、forEachは副作用のみ。',
      },
    ],
  },
  {
    conceptId: 'event-handling',
    question: '右のコードで `addEventListener` を使っている部分を見て。もしイベントリスナーを登録しなかったら、ボタンを押したときどうなる？',
    modelAnswer: '何も起きません。HTMLのボタン要素だけでは見た目はあるけど、クリックしてもJavaScriptの処理が実行されません。addEventListenerでクリックイベントと処理（関数）を紐づけることで初めて、ユーザーの操作に反応するアプリになります。',
    commonMistakes: [
      {
        answer: 'addEventListenerでボタンを押したら動くようにしています。いつ登録するかはよくわかりません。',
        feedback: 'イベントリスナーの仕組みは理解しているが、登録タイミング（DOMロード後）の理解が不足。',
      },
    ],
  },
  {
    conceptId: 'state-management',
    question: '右のコードで配列 `todos` がアプリの「状態」になっているよね。もし状態を更新した後に画面の再描画（renderTodos）を呼ばなかったらどうなる？',
    modelAnswer: 'データ（配列）は更新されるけど、画面には反映されません。ユーザーがタスクを追加しても見た目が変わらず、画面をリロードしないと最新のリストが見えない状態になります。状態管理のポイントは「データが変わったら画面も更新する」ことです。',
    commonMistakes: [
      {
        answer: '状態管理は変数でデータを持っておくことだと思います。画面の更新とは関係ないと思います。',
        feedback: '状態を「持つ」ことは理解しているが、「状態変化→UI更新」の連動が核心であることを理解できていない。',
      },
    ],
  },
];
