# Requirements Document

## Introduction
リアサポ（プログラミング学習支援アプリ）をGoogle Cloud Platform上で完全に動作させるための全面移行仕様。現在ローカル実行・SessionStorage依存・APIキー直接利用の構成を、Cloud Run / Vertex AI / Firestore / Firebase Auth / Secret Manager / Embedding 2 / Vector Search / NotebookLM連携を含むGCPネイティブ構成に移行する。

## Requirements

### Requirement 1: Cloud Runデプロイ
**Objective:** As a 開発者, I want リアサポのNext.jsアプリをCloud Runにコンテナデプロイしたい, so that スケーラブルかつ公開アクセス可能な環境で動作させられる

#### Acceptance Criteria
1. The リアサポ shall Cloud Run上でNext.jsアプリケーションをコンテナとして実行する
2. The Cloud Runサービス shall `asia-northeast1` リージョンにデプロイされる
3. When ユーザーがURLにアクセスした時, the Cloud Runサービス shall HTTPS経由でアプリケーションを提供する
4. The Dockerfile shall Next.jsのプロダクションビルド（`next build` + `next start`）を実行する
5. While トラフィックがない間, the Cloud Runサービス shall インスタンスを0にスケールダウンする
6. If デプロイが失敗した場合, the Cloud Run shall 前のリビジョンへ自動ロールバックする

### Requirement 2: Vertex AI移行（Gemini API）
**Objective:** As a システム, I want Gemini APIの呼び出しをGoogle AI StudioからVertex AIに移行したい, so that IAM認証・Grounding・Code Execution等の高度な機能を利用できる

#### Acceptance Criteria
1. The gemini-client shall `@google-cloud/vertexai` SDKを使用してGemini APIを呼び出す
2. The gemini-client shall APIキーではなくGoogle CloudのIAM認証（サービスアカウント）を使用する
3. The gemini-client shall 既存の5つのAPI機能（personalize, generate-code, mapping, evaluate, ask）を全てVertex AI経由で動作させる
4. When Vertex AI呼び出しが失敗した時, the gemini-client shall 指数バックオフによるリトライを行う（最大2回）
5. The gemini-client shall 既存の`Result<T, GeminiError>`型インターフェースを維持する
6. The Vertex AIリクエスト shall `asia-northeast1` リージョンのエンドポイントを使用する

### Requirement 3: Secret Manager統合
**Objective:** As a 開発者, I want 機密情報をSecret Managerで管理したい, so that APIキーやサービスアカウントキーをソースコードや環境変数に直接含めない

#### Acceptance Criteria
1. The リアサポ shall Google Cloud Secret Managerから機密情報を取得する
2. The リアサポ shall `.env.local` ファイルにシークレットをハードコードしない（Cloud Run環境）
3. When アプリケーション起動時, the リアサポ shall 必要なシークレットの存在を検証し、欠落時にエラーを報告する
4. If Secret Managerへのアクセスが失敗した場合, the リアサポ shall 明確なエラーメッセージをログに出力する
5. While ローカル開発環境で実行中, the リアサポ shall `.env.local` からのフォールバック読み込みをサポートする

### Requirement 4: Firebase Authentication
**Objective:** As a 学習者, I want Googleアカウントでログインしたい, so that 学習進捗が保存され、デバイスを跨いで継続できる

#### Acceptance Criteria
1. The リアサポ shall Firebase AuthenticationによるGoogleログイン機能を提供する
2. When ユーザーがログインボタンをクリックした時, the リアサポ shall Googleアカウント選択画面を表示する
3. When ログインが成功した時, the リアサポ shall ユーザーID・表示名・アバターを取得する
4. The リアサポ shall 未ログインユーザーにも匿名モード（現行のSessionStorage動作）でのアクセスを許可する
5. When ユーザーがログアウトした時, the リアサポ shall セッション情報をクリアし、Step 1にリダイレクトする
6. If 認証トークンが期限切れの場合, the Firebase Auth SDK shall 自動的にトークンをリフレッシュする

### Requirement 5: Firestore データ永続化
**Objective:** As a 学習者, I want 学習進捗・生成コード・理解度スコアが保存されたい, so that セッションを閉じても学習を継続できる

#### Acceptance Criteria
1. The リアサポ shall 以下のデータをFirestoreに保存する: ユーザープロフィール、選択シナリオ、生成コード、概念マッピング、理解度評価結果、Q&A履歴
2. When ログインユーザーがStep間を移動した時, the リアサポ shall 各Stepの状態をFirestoreに自動保存する
3. When ログインユーザーがアプリに再アクセスした時, the リアサポ shall 前回の学習状態を復元する
4. While ユーザーが未ログインの間, the リアサポ shall 従来通りSessionStorageにデータを保存する
5. The Firestoreセキュリティルール shall 各ユーザーが自分のデータのみ読み書きできるよう制限する
6. If Firestoreへの書き込みが失敗した場合, the リアサポ shall エラーをユーザーに通知し、ローカルにフォールバック保存する

### Requirement 6: Q&Aベクトル化と類似検索
**Objective:** As a 学習者, I want 過去の質問と類似した質問・回答を参照したい, so that 同じ概念でつまずいた他の学習者の学びを活かせる

#### Acceptance Criteria
1. When ユーザーがStep 2でConceptQAに質問を投稿した時, the リアサポ shall 質問文・回答・概念ID・ユーザーレベルをFirestoreに保存する
2. The リアサポ shall Gemini Embedding 2を使用して各Q&Aペアのベクトル埋め込みを生成する
3. When 新しい質問が投稿された時, the リアサポ shall Vertex AI Vector Searchを使用して類似度の高い過去のQ&Aを検索する
4. The リアサポ shall 類似Q&A結果を「他の学習者の質問」としてConceptQAパネルに表示する（上位3件）
5. The ベクトル検索 shall 同一概念ノードのQ&Aを優先的に返す
6. When 類似Q&Aが見つからない場合, the リアサポ shall 通常のGemini応答のみを表示する

### Requirement 7: つまずきパターン分析
**Objective:** As a システム, I want Q&Aデータからつまずきパターンを分析したい, so that 学習者が次につまずきそうな概念を先回りして支援できる

#### Acceptance Criteria
1. The リアサポ shall Q&A頻度・理解度スコアの集計データをFirestoreに蓄積する
2. The リアサポ shall 概念間のつまずき相関を分析する（例: 「変数」で低スコア→「配列」でも低スコアの傾向）
3. When 学習者の理解度がyellow/redの時, the リアサポ shall 関連する概念の補足説明をロードマップ上に自動表示する
4. The つまずき分析 shall 経験レベル別に集計する（初心者・Python経験者・他言語経験者で傾向が異なるため）

### Requirement 8: NotebookLM連携（復習支援）
**Objective:** As a 学習者, I want 理解できなかった概念をNotebookLMで深掘り学習したい, so that 異なるアプローチで理解を深められる

#### Acceptance Criteria
1. When Step 5で理解度がred（40未満）またはyellow（40-69）の概念がある時, the リアサポ shall 「復習ノートを作成」ボタンを表示する
2. When ユーザーが復習ノート作成をクリックした時, the リアサポ shall NotebookLMにノートブックを作成し、対象概念のソース（コード・説明・Q&A履歴）を追加する
3. Where NotebookLMのAudio Overview機能が利用可能な場合, the リアサポ shall 対象概念のポッドキャスト風音声解説の生成を提供する
4. The リアサポ shall NotebookLMのノートブックURLをユーザーに表示し、遷移できるようにする
5. If NotebookLMへの接続が失敗した場合, the リアサポ shall エラーを表示し、代替としてGeminiによる詳細解説を提供する

### Requirement 9: Cloud Logging / Monitoring
**Objective:** As a 開発者, I want アプリケーションの稼働状況とAPIの利用状況を監視したい, so that 障害の早期検知とコスト管理ができる

#### Acceptance Criteria
1. The リアサポ shall 構造化ログをCloud Loggingに出力する
2. The リアサポ shall 各APIエンドポイントのレイテンシ・成功率・エラー率をCloud Monitoringで計測する
3. The リアサポ shall Vertex AI APIの呼び出し回数・トークン消費量をログに記録する
4. When APIエラー率が閾値（5%）を超えた時, the Cloud Monitoring shall アラートを発報する
5. If Cloud Loggingへの書き込みが失敗した場合, the リアサポ shall 標準出力へフォールバックする

### Requirement 10: Vertex AI Grounding（Google検索連携）
**Objective:** As a 学習者, I want 概念説明が公式ドキュメントに基づいていてほしい, so that 信頼性の高い正確な説明で学習できる

#### Acceptance Criteria
1. When ConceptQAで概念について質問された時, the リアサポ shall Vertex AIのGrounding with Google Search機能を使用して回答を生成する
2. The Grounding付き回答 shall 参照元URLを引用として表示する
3. When パーソナライズ説明を生成する時, the リアサポ shall 公式ドキュメント（MDN, TypeScript公式等）をGroundingソースとして優先する
4. The リアサポ shall Grounding結果の信頼度スコアが低い場合、Groundingなしの通常回答にフォールバックする

### Requirement 11: Gemini Code Execution（コード実行）
**Objective:** As a 学習者, I want 生成されたコードの実行結果を確認したい, so that コードの動作を実際に見て理解を深められる

#### Acceptance Criteria
1. Where Gemini Code Execution機能が有効な場合, the リアサポ shall Step 4でコードスニペットの実行結果を表示する
2. When ユーザーが「実行して確認」ボタンをクリックした時, the リアサポ shall Gemini Code Executionサンドボックスでコードを実行する
3. The 実行結果 shall コンソール出力・戻り値・エラーメッセージを含む
4. If コード実行がタイムアウトした場合, the リアサポ shall タイムアウトメッセージを表示する（制限時間: 30秒）
5. The Code Execution shall ユーザー入力コードではなく、Geminiが生成・検証したコードのみを実行する
