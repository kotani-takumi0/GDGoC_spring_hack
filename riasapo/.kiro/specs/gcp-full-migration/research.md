# Research & Design Decisions

## Summary
- **Feature**: `gcp-full-migration`
- **Discovery Scope**: Complex Integration
- **Key Findings**:
  - `@google-cloud/vertexai` は2025年6月に非推奨化 → `@google/genai` SDKに統一
  - Firestore内蔵ベクトル検索がリアサポ規模に最適（Vertex AI Vector Search不要）
  - 既存の`GeminiClient`インターフェースがクリーンな抽象層として機能 → 実装差し替えのみで移行可能

## Research Log

### Vertex AI SDK選定
- **Context**: Gemini APIをVertex AI経由で呼び出すためのSDK選定
- **Sources**: npm registry, Google Cloud公式ドキュメント, googleapis/js-genai GitHub
- **Findings**:
  - `@google-cloud/vertexai` は2025年6月24日に非推奨、2026年6月24日に削除予定
  - `@google/genai` (v1.45.0) が統一SDK。Vertex AIとGemini Developer API両対応
  - 初期化: `new GoogleGenAI({ vertexai: true, project, location })`
  - Cloud RunではADC（Application Default Credentials）が自動適用、APIキー不要
  - 構造化JSON出力（responseSchema）は同様にサポート
- **Implications**: `@google/genai`を採用。REST直叩きからSDKベースに移行

### Next.js 16 on Cloud Run
- **Context**: Next.jsアプリのコンテナデプロイ方法
- **Sources**: Next.js公式ドキュメント, Cloud Runクイックスタート
- **Findings**:
  - `output: "standalone"` でserver.jsを含む自己完結型ビルド生成
  - マルチステージDockerfileでイメージサイズ最小化
  - `HOSTNAME=0.0.0.0` と `PORT=8080` が必須
  - `NEXT_PUBLIC_*`はビルド時に埋め込み、ランタイム環境変数はCloud Runで設定
- **Implications**: next.config.tsにstandalone出力を追加、Dockerfile作成

### Firestore vs Vertex AI Vector Search
- **Context**: Q&Aベクトル類似検索の実装方法選定
- **Sources**: Firebase公式ドキュメント, Google Cloud Vector Searchドキュメント
- **Findings**:
  - Firestoreに`findNearest()`による内蔵ベクトル検索機能あり
  - 最大2048次元、COSINE/DOT_PRODUCT/EUCLIDEAN距離対応
  - プリフィルタ（概念ID等）と組み合わせ可能
  - Vertex AI Vector Searchは数十億ドキュメント向けで過剰
  - Firestoreベクトル検索はFirestoreの無料枠に含まれる
- **Implications**: Firestoreベクトル検索を採用。別サービス不要でコスト・複雑性を大幅削減

### Firebase Auth with Next.js App Router
- **Context**: Next.js 16 App Routerでの認証パターン
- **Sources**: next-firebase-auth-edge公式ドキュメント, Firebase Codelab
- **Findings**:
  - `next-firebase-auth-edge`がApp Router・Server Components・Edge Runtime対応
  - クライアント: `signInWithPopup` → IDトークン取得
  - サーバー: ミドルウェアでセッションCookie検証
  - Cloud Runでは`firebase-admin`がADCで自動認証
  - クライアントSDKとAdmin SDKを分離する設計が推奨
- **Implications**: Firebase Client SDK（クライアント）+ Firebase Admin SDK（サーバー）の二層構成

### Gemini Embedding 2
- **Context**: Q&Aテキストのベクトル化モデル選定
- **Sources**: Google Cloud Embeddings APIドキュメント
- **Findings**:
  - `gemini-embedding-001`: 最新GA、デフォルト3072次元
  - `outputDimensionality`で768に削減可能（Firestoreの2048次元制限に適合）
  - タスクタイプ: RETRIEVAL_QUERY / RETRIEVAL_DOCUMENT で検索精度最適化
  - `@google/genai` SDKの`embedContent`メソッドで呼び出し
- **Implications**: 768次元でFirestoreベクトル検索と組み合わせ

### Grounding with Google Search
- **Context**: 概念説明への公式ドキュメント引用
- **Sources**: Vertex AI Grounding公式ドキュメント
- **Findings**:
  - `tools: [{ googleSearch: {} }]`で有効化
  - `groundingMetadata`にソースURL・テキスト対応・信頼度スコアを含む
  - `searchEntryPoint.renderedContent`の表示がToS上必須
  - 他ツール（codeExecution等）と組み合わせ可能
- **Implications**: askAboutConcept APIにGrounding追加。UI側に引用表示コンポーネントが必要

### Gemini Code Execution
- **Context**: コードの実行・検証機能
- **Sources**: Vertex AI Code Executionドキュメント
- **Findings**:
  - `tools: [{ codeExecution: {} }]`で有効化
  - Pythonのみサポート、30秒タイムアウト
  - NumPy, pandas, matplotlib利用可能
  - 追加コストなし
  - outcome: OUTCOME_OK / OUTCOME_FAILED / OUTCOME_DEADLINE_EXCEEDED
- **Implications**: リアサポはTypeScript生成だがPythonのみ対応。Step 4での「概念の動作確認」用に限定的に活用

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Adapter Pattern | GeminiClientインターフェースを維持し実装のみ差し替え | 既存コード変更最小、テスト容易 | インターフェース拡張時に既存メソッド互換性維持が必要 | 採用 |
| Full Rewrite | API層を全面書き直し | 最適化の余地が大きい | リスク高、開発時間大 | 却下 |
| Strangler Fig | 段階的に新旧切替 | リスク分散 | 並行稼働の複雑性 | 規模に対して過剰 |

## Design Decisions

### Decision: SDK選定 — `@google/genai`
- **Context**: Vertex AI呼び出しのSDK
- **Alternatives Considered**:
  1. `@google-cloud/vertexai` — 非推奨、2026年6月削除
  2. `@google/genai` — Google推奨の統一SDK
  3. REST API直叩き（現行方式） — 管理負荷高
- **Selected Approach**: `@google/genai` を採用
- **Rationale**: Google公式推奨、ADC対応、Gemini全機能利用可能
- **Trade-offs**: 現行のREST呼び出しコードは全面差し替え（ただしインターフェースは維持）
- **Follow-up**: SDK v1.45.0のAPI安定性を確認

### Decision: ベクトル検索 — Firestoreベクトル検索
- **Context**: Q&A類似検索の基盤
- **Alternatives Considered**:
  1. Vertex AI Vector Search — 大規模向け、インフラ管理必要
  2. Firestore内蔵ベクトル検索 — Firestore統合、無料枠あり
  3. Pinecone等外部サービス — GCP外、コスト追加
- **Selected Approach**: Firestore内蔵ベクトル検索
- **Rationale**: 同一DBでデータ+ベクトル管理、コストゼロ、運用シンプル
- **Trade-offs**: 2048次元制限（768次元で十分）、ANN非対応（KNNのみ、小規模で問題なし）
- **Follow-up**: ベクトルインデックスの作成（gcloud CLI）

### Decision: 認証 — Firebase Auth + Cookie-based Session
- **Context**: Next.js App Routerでのユーザー認証
- **Alternatives Considered**:
  1. Firebase Auth（クライアントのみ） — Server Components非対応
  2. next-firebase-auth-edge — ミドルウェア統合、Cookie管理
  3. NextAuth.js — Firebase非ネイティブ
- **Selected Approach**: Firebase Auth + クライアントSDK（匿名モード併用）
- **Rationale**: 匿名ユーザーもサポートする要件のため、シンプルなクライアント認証で十分。Server Componentsでの認証は現時点で不要（全ページがクライアントコンポーネント）
- **Trade-offs**: サーバーサイド認証なし（APIルートの保護は将来課題）
- **Follow-up**: 必要に応じてmiddleware認証を追加

## Risks & Mitigations
- Code Executionの言語制限（Python only）→ TypeScriptコードの概念説明用にPython変換して実行、またはiframeプレビュー維持
- Firestore書き込み遅延 → SessionStorageとの二重書き込みでUX維持
- NotebookLM APIのレート制限 → バックオフ+Geminiフォールバック
- Cloud Run Cold Start → min-instances=1設定（コスト微増）

## References
- [@google/genai npm](https://www.npmjs.com/package/@google/genai) — 統一SDK
- [Vertex AI SDK移行ガイド](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/deprecations/genai-vertexai-sdk)
- [Firestoreベクトル検索](https://firebase.google.com/docs/firestore/vector-search) — 内蔵ベクトル検索
- [Next.jsデプロイドキュメント](https://nextjs.org/docs/app/getting-started/deploying) — standalone出力
- [Grounding with Google Search](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-search)
- [Gemini Code Execution](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/code-execution)
- [next-firebase-auth-edge](https://github.com/awinogrodzki/next-firebase-auth-edge)
