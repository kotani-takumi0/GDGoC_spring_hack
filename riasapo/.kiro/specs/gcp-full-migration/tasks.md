# Implementation Plan

## Phase 1: デプロイ基盤

- [ ] 1. Cloud Runデプロイ基盤の構築
- [x] 1.1 Next.jsのstandalone出力を有効化し、マルチステージDockerfileを作成する
  - next.config.tsに`output: "standalone"`を追加する
  - マルチステージDockerfile（deps → builder → runner）を作成する
  - `HOSTNAME=0.0.0.0`と`PORT=8080`の環境変数を設定する
  - `.dockerignore`を作成してnode_modules, .next, .envを除外する
  - ローカルでDockerビルド＆起動して動作確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 1.2 Cloud Runサービスの設定ファイルを作成する
  - `.gcloudignore`を作成する
  - Cloud Runサービス設定（リージョン: asia-northeast1、最小インスタンス: 0、最大: 10）を定義する
  - 0スケールダウンとロールバック設定を含める
  - _Requirements: 1.2, 1.5, 1.6_

## Phase 2: AI基盤切替

- [ ] 2. Vertex AI SDK移行
- [x] 2.1 `@google/genai` SDKをインストールし、Geminiクライアントの内部実装をVertex AI SDKに差し替える
  - `@google/genai`パッケージをインストールする
  - 現在のREST直叩き実装を`GoogleGenAI({ vertexai: true })`ベースに書き換える
  - 既存の`GeminiClient`インターフェース（5メソッド）のシグネチャは変更しない
  - `Result<T, GeminiError>`型によるエラーハンドリングを維持する
  - 指数バックオフリトライ（最大2回）のロジックを維持する
  - プロジェクトID `gdghackathon-7ff23`、リージョン `asia-northeast1` で初期化する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 2.2 ローカル開発環境でVertex AI経由の全5エンドポイントの動作確認テストを実施する
  - personalizeDescriptions: ノード説明のパーソナライズが正しく返却されることを確認
  - generateCode: TypeScriptコードが複数ファイルで生成されることを確認
  - mapConceptsToCode: 概念-コードマッピングが返却されることを確認
  - evaluateUnderstanding: スコア・フィードバック・ステータスが返却されることを確認
  - askAboutConcept: 質問に対する回答が返却されることを確認
  - _Requirements: 2.3, 2.5_

- [ ] 3. (P) Secret Manager統合
- [ ] 3.1 Secret Managerからシークレットを取得するサービスを実装する
  - `@google-cloud/secret-manager`パッケージをインストールする
  - Cloud Run環境ではSecret Managerから取得、ローカル環境では`.env.local`からフォールバックする仕組みを作る
  - アプリ起動時に必要なシークレットの存在を検証し、欠落時にエラーメッセージをログ出力する
  - 既存のAPIルートで環境変数参照箇所をSecret Manager経由に切り替える
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

## Phase 3: ユーザー管理・データ永続化

- [ ] 4. Firebase Authentication導入
- [x] 4.1 Firebaseクライアント初期化とAuthProvider（React Context）を実装する
  - `firebase`パッケージをインストールする
  - Firebaseクライアント初期化モジュールを作成する（firebaseConfig使用）
  - `NEXT_PUBLIC_FIREBASE_*`環境変数にFirebase設定値を定義する
  - 認証状態（ユーザー情報・ローディング・ログイン済みかどうか）をReact Contextで共有するProviderを作成する
  - `onAuthStateChanged`でリアルタイムに認証状態を同期する
  - _Requirements: 4.1, 4.3, 4.6_

- [x] 4.2 Googleログイン・ログアウトUIをHeaderコンポーネントに追加する
  - ヘッダーにログインボタン（未認証時）とユーザーアバター+ログアウトメニュー（認証時）を表示する
  - Googleログインはポップアップ方式（signInWithPopup）で実装する
  - ログアウト時にセッション情報をクリアし、Step 1にリダイレクトする
  - 未ログインでも全Stepにアクセス可能（匿名モード）とする
  - _Requirements: 4.2, 4.4, 4.5_

- [ ] 5. Firestore データ永続化
- [x] 5.1 Firestoreサーバーサイドクライアント（firebase-admin）を初期化し、コレクション操作のサービスモジュールを実装する
  - `firebase-admin`パッケージをインストールする
  - Cloud RunではADC（Application Default Credentials）で自動認証する初期化モジュールを作成する
  - `users`, `sessions`, `qa_logs`, `evaluations`コレクションのCRUD操作を実装する
  - エラー時は`Result`型で返却する
  - _Requirements: 5.1, 5.5_

- [x] 5.2 SessionStorage書き込み時にFirestoreにも自動保存するSessionSyncProviderを実装する
  - 認証済みユーザーの場合、SessionStorageとFirestoreに二重書き込みするContextを作成する
  - 未認証ユーザーの場合は従来通りSessionStorageのみに保存する
  - アプリ起動時（認証済み時）にFirestoreからSessionStorageを復元する処理を実装する
  - Firestore書き込み失敗時はSessionStorageの値を維持し、ユーザーにエラーを通知する
  - _Requirements: 5.2, 5.3, 5.4, 5.6_

- [x] 5.3 Firestoreセキュリティルールを作成しデプロイする
  - `firestore.rules`ファイルにUID一致チェックのルールを記述する
  - `qa_logs`は匿名ユーザーも読み書き可能、`users`/`sessions`/`evaluations`/`notebooks`はUID一致時のみ許可する
  - `stumble_stats`は全ユーザー読み取り可能とする
  - _Requirements: 5.5_

- [x] 5.4 既存のStep 1〜5ページでSessionSyncProviderを通じたデータ保存・復元を接続する
  - 各Stepページの`sessionStorage.setItem`/`getItem`呼び出しをSessionSyncProvider経由に置き換える
  - Step間のデータ受け渡し（generated-code, scenario, mappings）がFirestore経由でも正しく機能することを確認する
  - ログインユーザーがブラウザを閉じて再度開いた場合に、前回の学習状態から継続できることを確認する
  - _Requirements: 5.1, 5.2, 5.3_

## Phase 4: ベクトル検索機能

- [ ] 6. Q&Aベクトル化と類似検索
- [x] 6.1 Gemini Embedding 2を使ったテキストベクトル化サービスを実装する
  - `@google/genai`の`embedContent`メソッドで`gemini-embedding-001`モデルを使用する
  - 検索クエリ用（RETRIEVAL_QUERY）とドキュメント保存用（RETRIEVAL_DOCUMENT）のタスクタイプを使い分ける
  - 出力次元数を768に設定する（Firestoreベクトル検索の制限に適合）
  - _Requirements: 6.2_

- [x] 6.2 Q&A投稿時にFirestoreにベクトル付きでログを保存する処理を実装する
  - `/api/ask`ルートでGemini回答取得後、質問+回答テキストをベクトル化する
  - 質問文・回答・概念ID・ユーザーレベル・ベクトルをFirestoreの`qa_logs`コレクションに保存する
  - 匿名ユーザーの場合は`userId: null`で保存する
  - _Requirements: 6.1, 6.2_

- [x] 6.3 Firestoreベクトル検索インデックスを作成し、類似Q&A検索機能を実装する
  - gcloud CLIで`qa_logs`コレクションにベクトルインデックス（768次元, COSINE距離）を作成する
  - 新しい質問投稿時に、まず質問をベクトル化し`findNearest()`で類似Q&Aを検索する処理を追加する
  - 同一概念ノード（nodeId）のQ&Aを優先して返す（プリフィルタ適用）
  - 上位3件の類似Q&Aを返却する
  - 類似Q&Aが見つからない場合は通常のGemini応答のみを返す
  - _Requirements: 6.3, 6.4, 6.5, 6.6_

- [ ] 6.4 ConceptQAコンポーネントに「他の学習者の質問」セクションを追加する
  - `/api/ask`のレスポンスに類似Q&Aリストを追加する
  - ConceptQAパネルの回答表示の下部に、類似Q&Aを折りたたみリストで表示する
  - 各類似Q&Aには質問文・回答の要約・経験レベルを表示する
  - _Requirements: 6.4_

## Phase 5: 高度AI機能

- [ ] 7. Vertex AI Grounding（Google検索連携）
- [ ] 7.1 (P) askAboutConcept APIにGrounding with Google Search機能を追加する
  - GenAIクライアントの`askAboutConcept`呼び出し時に`tools: [{ googleSearch: {} }]`を追加する
  - レスポンスから`groundingMetadata`（ソースURL、テキスト対応、信頼度スコア）を抽出する
  - 信頼度スコアが低い場合はGroundingなしの通常回答にフォールバックする
  - 戻り値を`GroundedAnswer`型（answer + citations）に拡張する
  - _Requirements: 10.1, 10.3, 10.4_

- [ ] 7.2 (P) ConceptQAの回答表示に引用元URLリンクを表示するUIを追加する
  - 回答テキストの後に「参考リンク」セクションを表示する
  - 各引用にはタイトル・URL・関連テキスト抜粋を表示する
  - Google Search利用時のToS要件に準拠したSearch Entry Pointウィジェットを表示する
  - _Requirements: 10.2_

- [ ] 8. Gemini Code Execution機能
- [ ] 8.1 (P) 概念コードの動作確認を行うCode Execution APIエンドポイントを作成する
  - `/api/execute-code`エンドポイントを新規作成する
  - GenAIクライアントで`tools: [{ codeExecution: {} }]`を使い、概念に関連するコードの動作検証を実行する
  - 実行結果（コード、出力、成否ステータス）を返却する
  - タイムアウト（30秒）超過時はタイムアウトメッセージを返す
  - セキュリティ上、ユーザー入力コードではなくGemini生成コードのみ実行する
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 8.2 Step 4のコードパネルに「実行して確認」ボタンとCode Execution結果表示UIを追加する
  - 各概念ノード選択時にコードスニペット横に「実行して確認」ボタンを表示する
  - ボタンクリック時に`/api/execute-code`を呼び出し、ローディング状態を表示する
  - 実行結果（コンソール出力・戻り値）を構文ハイライト付きパネルで表示する
  - エラーやタイムアウト時は適切なメッセージを表示する
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 9. NotebookLM連携（復習支援）
- [ ] 9.1 NotebookLM APIを呼び出す復習ノートブック作成サービスを実装する
  - NotebookLMにノートブックを作成し、対象概念のソース（コード・説明・Q&A履歴）をテキストソースとして追加する一連の処理を実装する
  - Audio Overview（ポッドキャスト風音声解説）の生成リクエストを送信する
  - 音声生成ステータスをポーリングで確認する機能を実装する
  - 接続失敗時はGeminiによる詳細解説を生成するフォールバック処理を含める
  - _Requirements: 8.2, 8.3, 8.5_

- [ ] 9.2 NotebookLMのノートブック情報をFirestoreに保存するAPIエンドポイントを作成する
  - `/api/notebook`エンドポイントを新規作成する
  - 復習対象の概念ID・コード・Q&A履歴を受け取り、NotebookLM連携サービスを呼び出す
  - 作成されたノートブックID・URL・音声ステータスをFirestoreの`notebooks`コレクションに保存する
  - 認証済みユーザーのUIDと紐づけて保存する
  - _Requirements: 8.2, 8.4_

- [ ] 9.3 Step 5の理解度チェック画面に「復習ノートを作成」ボタンとNotebookLMリンク表示UIを追加する
  - 理解度がred（40未満）またはyellow（40-69）の概念がある場合に「復習ノートを作成」ボタンを表示する
  - ボタンクリック時に`/api/notebook`を呼び出し、ローディング状態を表示する
  - 完了後にNotebookLMのノートブックURLリンクを表示する
  - Audio Overview生成中の場合はステータスバッジ（生成中/完了/失敗）を表示する
  - _Requirements: 8.1, 8.3, 8.4_

## Phase 6: 分析・運用基盤

- [ ] 10. つまずきパターン分析
- [ ] 10.1 (P) Q&A頻度・理解度スコアの集計とつまずき相関分析ロジックを実装する
  - Firestoreの`qa_logs`と`evaluations`データを集計し、概念ごとの平均スコア・red率・試行回数を計算する
  - 概念間のつまずき共起（「変数」で低スコアの人が「配列」でも低スコアになる割合）を分析する
  - 経験レベル別に集計し、結果を`stumble_stats`コレクションにキャッシュする
  - _Requirements: 7.1, 7.2, 7.4_

- [ ] 10.2 ロードマップ画面にtumbleパターンに基づく補足説明を自動表示する機能を追加する
  - Step 2のロードマップで、学習者の理解度がyellow/redの概念に関連する補足情報をツールチップまたはバッジで表示する
  - つまずき集計データから「この概念が理解できなかった人はこちらも要注意」という先回り警告を表示する
  - _Requirements: 7.3_

- [ ] 11. (P) 構造化ログとモニタリング
- [ ] 11.1 JSON形式の構造化ログを出力するロガーモジュールを実装する
  - Cloud Run環境ではstdoutに構造化JSONを出力する（Cloud Loggingが自動転送）
  - ログレベル（info/warn/error）とAPI メトリクス（エンドポイント、レイテンシ、ステータスコード、トークン消費量）を記録する
  - Cloud Loggingへの書き込みが失敗した場合は標準出力へフォールバックする
  - _Requirements: 9.1, 9.2, 9.3, 9.5_

- [ ] 11.2 全APIルートにロガーを組み込み、レイテンシ・エラー率を計測する
  - 5つの既存APIルートと新規APIルート（execute-code, notebook）にログ出力を追加する
  - リクエスト開始/終了時刻からレイテンシを計算してログに記録する
  - Vertex AI呼び出しのトークン消費量（入力/出力）をレスポンスから抽出してログに記録する
  - _Requirements: 9.2, 9.3_

- [ ] 11.3 Cloud Monitoringでエラー率アラートを設定するための設定情報を定義する
  - ログベースメトリクス（APIエラー率）の定義をドキュメント化する
  - エラー率5%超過時のアラートポリシー設定を記述する
  - _Requirements: 9.4_

## Phase 7: 統合・検証

- [ ] 12. 全機能統合テスト
- [ ] 12.1 GenAIClient（Vertex AI）の単体テストを作成する
  - SDK呼び出しのモックを使用して5つのメソッドのResult型返却を検証する
  - リトライロジック（指数バックオフ）の動作を検証する
  - Grounding・Code Execution有効時のレスポンス解析を検証する
  - _Requirements: 2.3, 2.4, 2.5_

- [ ] 12.2 (P) FirestoreService・EmbeddingServiceの単体テストを作成する
  - Firestoreエミュレータを使用してCRUD操作を検証する
  - ベクトル保存・`findNearest()`検索の動作を検証する
  - セキュリティルール（UID一致チェック）の検証を含める
  - _Requirements: 5.5, 6.3, 6.5_

- [ ] 12.3 (P) AuthProvider・SessionSyncProviderの単体テストを作成する
  - ログイン/ログアウト状態遷移を検証する
  - SessionStorage↔Firestore二重書き込みの整合性を検証する
  - 未認証時のSessionStorageフォールバック動作を検証する
  - _Requirements: 4.4, 5.4, 5.6_

- [ ] 12.4 Q&Aベクトル検索フロー（質問投稿→ベクトル化→保存→類似検索→回答表示）のE2Eテストを作成する
  - 質問投稿から類似Q&A表示までの全フローを通しで検証する
  - 類似Q&Aが0件の場合の通常回答フォールバックを検証する
  - _Requirements: 6.1, 6.3, 6.4, 6.6_

- [ ] 12.5 ログイン→Step 1〜5完走→ログアウト→再ログイン→進捗復元のE2Eテストを作成する
  - 認証済みユーザーの学習進捗がFirestoreに保存され、再ログイン後に正しく復元されることを検証する
  - _Requirements: 5.2, 5.3_
