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

// =============================================================================
// デモモード用 — 事前定義された対話履歴（ドキュメント生成用）
// =============================================================================

export interface DemoConversation {
  readonly conceptTitle: string;
  readonly messages: readonly { readonly role: 'senpai' | 'user'; readonly text: string }[];
}

export const DEMO_CONVERSATIONS: readonly DemoConversation[] = [
  {
    conceptTitle: '変数とデータ型',
    messages: [
      { role: 'senpai', text: '右のコードで `let nextId: number = 1;` ってあるよね。もしこれを `const` に変えたら何が起きる？なんで `let` じゃないとダメなのか説明してみて。' },
      { role: 'user', text: 'constは変更できないから、nextIdを増やせなくなると思います。' },
      { role: 'senpai', text: 'その通り！じゃあさ、`const`で宣言した配列に`push`はできると思う？`const todos = [];`みたいなやつ。' },
      { role: 'user', text: 'えっと...constは再代入できないだけで、配列の中身は変えられるんですよね？だからpushはできると思います。' },
      { role: 'senpai', text: 'お、いいね！constは「変数への再代入」を防ぐだけで、オブジェクトや配列の中身は変更できる。ここ混同する人多いんだよね。よく分かってるじゃん。' },
    ],
  },
  {
    conceptTitle: '配列・リスト',
    messages: [
      { role: 'senpai', text: '右のコードでTodoリストに新しいタスクを追加している部分を見つけて。もし配列じゃなくて普通の変数1つだけでTodoを管理しようとしたら、何が困る？' },
      { role: 'user', text: '変数1つだと1個のタスクしか持てないから、複数のタスクを管理できないです。配列なら何個でも入れられます。' },
      { role: 'senpai', text: 'そうそう。じゃあ右のコードで`push`と`filter`が使われてるところ見つけて、それぞれ何してるか説明できる？' },
      { role: 'user', text: 'pushは配列の最後に新しい要素を追加して、filterは条件に合う要素だけ残す...だから削除に使えるんですね！' },
      { role: 'senpai', text: 'バッチリ！filter は元の配列を変えずに新しい配列を返すってとこもポイントね。イミュータブルな操作ってやつ。' },
    ],
  },
  {
    conceptTitle: '関数定義',
    messages: [
      { role: 'senpai', text: '右のコードの `addTodo` 関数を見て。もしこの関数を作らずに、同じ処理をボタンクリックのたびに直接書いてたらどうなると思う？' },
      { role: 'user', text: '同じコードを何回も書かないといけなくなって、修正するときも全部直さないといけなくなります。' },
      { role: 'senpai', text: 'その通り。DRY原則ってやつだね。じゃあ `addTodo` が引数として `taskName` を受け取ってるのはなんでだと思う？' },
      { role: 'user', text: '毎回違うタスク名を渡せるようにするため？同じ関数で色んなタスクを追加できます。' },
      { role: 'senpai', text: 'そう、引数があることで関数が汎用的になる。「タスクを追加する」という処理は同じだけど、中身は毎回変わる。うまく抽象化できてるね。' },
    ],
  },
  {
    conceptTitle: '条件分岐',
    messages: [
      { role: 'senpai', text: '右のコードでタスクの完了/未完了を切り替えている部分を見て。もし条件分岐なしで完了状態を管理しようとしたら、どんな問題が起きる？' },
      { role: 'user', text: '完了したタスクとしてないタスクを区別できなくなって、取り消し線とかの表示を変えられなくなります。' },
      { role: 'senpai', text: 'そうだね。条件分岐は「状態に応じてUIを出し分ける」ために必須。じゃあ三項演算子 `todo.done ? "完了" : "未完了"` みたいな書き方、if文との違いは分かる？' },
      { role: 'user', text: '三項演算子は式として値を返せるから、JSXの中で使えるんですよね。if文は文だから直接は使えない。' },
      { role: 'senpai', text: '完璧。React/JSXでは式として書けることが重要なんだよね。よく理解できてる。' },
    ],
  },
  {
    conceptTitle: 'ループ処理',
    messages: [
      { role: 'senpai', text: '右のコードでTodoリストを画面に表示している部分を見て。もしループを使わずに、1個ずつ手動で表示するコードを書いてたらどうなる？' },
      { role: 'user', text: 'タスクが何個あるか分からないから、手動だと対応できないです。ループなら何個でも同じコードで表示できます。' },
      { role: 'senpai', text: 'そう。右のコードでは `map` を使ってるけど、`forEach` との違いは分かる？' },
      { role: 'user', text: 'mapは新しい配列を返して、forEachは返さない...だからmapはHTMLの要素を作って返すのに使えるんですか？' },
      { role: 'senpai', text: 'その通り！mapが返した配列がそのままDOMに描画される。forEachだと戻り値がないから、UIの構築には使えない。実践的な理解ができてるね。' },
    ],
  },
  {
    conceptTitle: 'イベント処理',
    messages: [
      { role: 'senpai', text: '右のコードで `addEventListener` を使っている部分を見て。もしイベントリスナーを登録しなかったら、ボタンを押したときどうなる？' },
      { role: 'user', text: '何も起きないです。ボタンの見た目はあるけど、クリックしてもJavaScriptの処理が動かない。' },
      { role: 'senpai', text: 'そう。HTMLとJavaScriptを「繋ぐ」のがイベントリスナーの役割。じゃあ、なんでDOMContentLoadedイベントの中でリスナーを登録してるか分かる？' },
      { role: 'user', text: 'HTMLが全部読み込まれてからじゃないと、ボタン要素がまだ存在しないから...getElementByIdがnullになっちゃう？' },
      { role: 'senpai', text: 'バッチリ。DOM要素が準備できてからでないとイベントを紐づけられない。この「タイミング」の理解は重要だよ。' },
    ],
  },
  {
    conceptTitle: '状態管理',
    messages: [
      { role: 'senpai', text: '右のコードで配列 `todos` がアプリの「状態」になっているよね。もし状態を更新した後に画面の再描画を呼ばなかったらどうなる？' },
      { role: 'user', text: 'データは変わるけど画面には反映されないから、ユーザーからは何も変わってないように見えます。' },
      { role: 'senpai', text: 'そう、「データと表示の同期」が状態管理のキモ。右のコードだと `renderTodos()` を毎回呼んでるよね。Reactだとこれを自動でやってくれるんだけど、仕組みとしては同じ。' },
      { role: 'user', text: 'なるほど、Reactの `useState` とかは、値が変わったら自動で再描画してくれるってことですか？' },
      { role: 'senpai', text: 'その通り！今のコードは手動でrenderを呼んでるけど、Reactはそこを自動化してる。この仕組みを理解してるとReact学ぶとき楽になるよ。いい質問だね。' },
    ],
  },
];

