# Research & Design Decisions

## Summary
- **Feature**: `riasapo-learning-support`
- **Discovery Scope**: New Feature（グリーンフィールド）
- **Key Findings**:
  - React Flow v12はカスタムノード・エッジ・ミニマップをサポートし、概念ロードマップの描画に最適
  - Gemini APIの構造化出力（JSON mode / response_schema）により、パーソナライズ・マッピング・判定の全ステップで安定したJSON応答が得られる
  - Next.js App Router + API Routesで全体を1プロジェクトに集約し、Cloud Runにコンテナデプロイが最もシンプルな構成

## Research Log

### React Flowによる概念グラフ描画
- **Context**: 概念ノード（5〜8個）と依存関係を視覚的に表示し、ノードのクリック・ホバーでコードとの対応を示す必要がある
- **Sources Consulted**: React Flow公式ドキュメント、React Flowカスタムノード例
- **Findings**:
  - React Flow v12はカスタムノード（Reactコンポーネント）を完全サポート
  - dagre / elkjsによる自動レイアウトで依存関係グラフを上から下に配置可能
  - ノードのスタイル動的変更（色付け）はsetNodesで容易に実現
  - ミニマップ・コントロールパネルは不要（ノード数が少ないため）
- **Implications**: カスタムノードでタイトル+サブテキスト+コード例の3層表示を実現。ノードの色変更はステート管理で制御

### Gemini API構造化出力
- **Context**: 4つのステップ（パーソナライズ、コード生成、マッピング、判定）でGemini APIを使用し、安定した出力が必要
- **Sources Consulted**: Gemini API公式ドキュメント、構造化出力ガイド
- **Findings**:
  - `response_mime_type: "application/json"` + `response_schema` でJSONスキーマを指定可能
  - Gemini 2.5 Flashはコスト効率が高く、ハッカソン用途に適切
  - コード生成のみMarkdown形式で返し、他はJSON構造化出力を使用するのが最適
- **Implications**: 各ステップのリクエスト・レスポンスにJSON Schemaを定義し、型安全なパイプラインを構築

### Next.js App Router + Cloud Run構成
- **Context**: フロント・バック・APIを1プロジェクトに集約してCloud Runにデプロイ
- **Sources Consulted**: Next.js App Router公式ドキュメント、Cloud Run + Next.jsデプロイガイド
- **Findings**:
  - App Routerのroute handlersでAPI Routesを実装（`app/api/*/route.ts`）
  - `output: 'standalone'` でDockerイメージサイズを最小化
  - Cloud Runはコンテナ起動が速く、ハッカソンのデモに十分
  - 環境変数でGemini APIキーを管理
- **Implications**: Dockerfileで`standalone`出力をビルドし、Cloud Runにデプロイ。環境変数は Cloud Run の設定で注入

### コードハイライト表示
- **Context**: Step 4で生成コードをシンタックスハイライト付きで表示し、概念ノードに対応する箇所をハイライトする
- **Sources Consulted**: Prism.js, Shiki, react-syntax-highlighter
- **Findings**:
  - Shikiはサーバーサイドでトークン化し、行単位のハイライトが容易
  - react-syntax-highlighterはクライアントサイドで動作し、行範囲のカスタムスタイルを適用可能
  - 概念ノードとコード行範囲のマッピングにはGemini APIの出力で行番号を含める
- **Implications**: react-syntax-highlighterを使用し、Gemini APIから返される行範囲情報でハイライトを制御

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Next.js一体型 | App Router + API Routes + React Flow | 1プロジェクト完結、デプロイ簡単、開発速度最速 | スケーラビリティに制限 | ハッカソンに最適。Cloud Run 1サービスで完結 |
| フロント+バック分離 | React SPA + Express API | 独立スケーリング、関心の分離 | 2つのサービス管理、CORS設定 | オーバーエンジニアリング |
| Serverless Functions | Cloud Functions per endpoint | 自動スケーリング | コールドスタート、開発体験が悪い | ハッカソンには不向き |

## Design Decisions

### Decision: Next.js App Router一体型アーキテクチャ
- **Context**: ハッカソンで最速に動くプロトタイプを構築する必要がある
- **Alternatives Considered**:
  1. フロント・バック分離（React + Express）
  2. Serverless Functions（Cloud Functions）
- **Selected Approach**: Next.js App Routerで全体を1プロジェクトに集約
- **Rationale**: 開発速度最優先。1リポジトリ・1デプロイで全ステップが動く。Cloud Runへのデプロイもシンプル
- **Trade-offs**: スケーラビリティは犠牲になるが、ハッカソンのプロトタイプには十分
- **Follow-up**: デモ時のレスポンス速度を検証

### Decision: 静的JSON + Gemini APIのハイブリッドアプローチ
- **Context**: 概念ロードマップの構造は安定させたいが、説明文はパーソナライズしたい
- **Alternatives Considered**:
  1. 全て静的JSON（パーソナライズなし）
  2. 全てGemini API動的生成（構造もAI生成）
- **Selected Approach**: 構造（ノード・依存関係）は静的JSON、説明文はGemini APIで動的生成
- **Rationale**: 構造の安定性を確保しつつ、Gemini APIの活用ポイント（パーソナライズ）を明確にする
- **Trade-offs**: シナリオ追加にはJSON定義の手動作成が必要
- **Follow-up**: フォールバック説明文の品質確認

### Decision: React Flowでのグラフ描画
- **Context**: 概念ノード間の依存関係を視覚的に表示し、インタラクティブな操作が必要
- **Alternatives Considered**:
  1. D3.js（低レベルグラフ描画）
  2. Mermaid.js（静的図表）
  3. 自前SVG実装
- **Selected Approach**: React Flow v12
- **Rationale**: React統合が最も自然。カスタムノード・エッジ、クリック/ホバーイベント、自動レイアウトを標準サポート。コミュニティも活発
- **Trade-offs**: バンドルサイズが増えるが、ハッカソンでは問題にならない
- **Follow-up**: dagreレイアウトの見た目調整

## Risks & Mitigations
- Gemini APIのレスポンス遅延（特にコード生成） → ローディングUI + ストリーミング対応検討
- Gemini APIの出力フォーマット不安定 → 構造化出力モード + フォールバック値
- React Flowの自動レイアウトが意図通りにならない → dagre設定の調整 + 手動位置指定のフォールバック
- Cloud Runのコールドスタート → min-instances=1 設定（デモ前にウォームアップ）

## References
- [React Flow v12 Documentation](https://reactflow.dev/) — カスタムノード、自動レイアウト
- [Gemini API Structured Output](https://ai.google.dev/gemini-api/docs/structured-output) — JSON mode設定
- [Next.js App Router](https://nextjs.org/docs/app) — Route Handlers, Server Components
- [Cloud Run + Next.js](https://cloud.google.com/run/docs/quickstarts) — コンテナデプロイ
- [react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter) — コードハイライト
- [dagre](https://github.com/dagrejs/dagre) — 有向グラフ自動レイアウト
