# 並列実行計画 — リアサポ実装

## 概要

tasks.mdの全タスクを依存関係に基づいて5フェーズに分割し、各フェーズ内で独立したタスクをエージェント並列実行する。

## フェーズ構成

### Phase 1: プロジェクト基盤（順次）

| タスク | 内容 | 状態 |
|--------|------|------|
| 1.1 | Next.jsプロジェクト初期化・依存パッケージ・環境変数 | ✅ 完了 |

**依存**: なし（全タスクの起点）

---

### Phase 2: 基盤並列（1.1完了後、3エージェント並列）

| Agent | タスク | 内容 | 依存 | 状態 |
|-------|--------|------|------|------|
| A | 1.2 | シナリオ定義JSON + データローダー | 1.1 | ⬜ |
| B | 1.3 | 共通レイアウト・ナビゲーション | 1.1 | ⬜ |
| C | 2.1 | Gemini APIクライアント基盤 | 1.1 | ⬜ |

**並列度**: 3
**理由**: 3タスクは互いに依存せず、すべて1.1のプロジェクト構造のみに依存

- **Agent A** — `src/data/` にJSON定義、`src/lib/scenario-data-loader.ts` にユーティリティ
- **Agent B** — `src/app/layout.tsx` に共通レイアウト、`src/components/` にヘッダー・ステップインジケーター
- **Agent C** — `src/lib/gemini-client.ts` に共通クライアント（構造化出力・リトライ・フォールバック）

---

### Phase 3: API並列（2.1完了後、4エージェント並列）

| Agent | タスク | 内容 | 依存 | 状態 |
|-------|--------|------|------|------|
| D | 2.2 | パーソナライズAPIエンドポイント | 2.1, 1.2 | ⬜ |
| E | 2.3 | コード生成APIエンドポイント | 2.1 | ⬜ |
| F | 2.4 | マッピングAPIエンドポイント | 2.1 | ⬜ |
| G | 2.5 | 理解度評価APIエンドポイント | 2.1 | ⬜ |

**並列度**: 4
**理由**: 各APIエンドポイントはGeminiClientを共有するが、個別のRoute Handlerで完全に独立

- **Agent D** — `src/app/api/personalize/route.ts`（フォールバック: 静的JSONのデフォルト説明文）
- **Agent E** — `src/app/api/generate-code/route.ts`（失敗時: エラーレスポンス + リトライ促進）
- **Agent F** — `src/app/api/mapping/route.ts`（フォールバック: 静的JSONのマッピング）
- **Agent G** — `src/app/api/evaluate/route.ts`（失敗時: エラーレスポンス + リトライ促進）

**注意**: Agent D は 1.2（シナリオJSON）にも依存するため、Agent Aの完了を待つ必要がある。Agent E/F/G は2.1のみに依存。

---

### Phase 4: UI画面並列（Phase 2-3完了後、最大5エージェント並列）

| Agent | タスク | 内容 | 依存 | 状態 |
|-------|--------|------|------|------|
| H | 3.1 | Step 1 シナリオ選択画面 | 1.2, 1.3 | ⬜ |
| I | 4.1-4.2 | Step 2 ロードマップ画面 | 1.2, 1.3, 2.2 | ⬜ |
| J | 5.1 | Step 3 コード生成画面 | 1.3, 2.3 | ⬜ |
| K | 6.1-6.2 | Step 4 マッピング画面 | 1.3, 2.4 | ⬜ |
| L | 7.1-7.2 | Step 5 評価画面 | 1.3, 2.5 | ⬜ |

**並列度**: 3〜5（API完了状況により変動）
**段階的起動戦略**:
1. Phase 2完了時点で **Agent H**（Step 1）は即座に起動可能（APIに依存しない）
2. Phase 3の各Agentが完了次第、対応するUI Agentを起動
   - 2.2完了 → Agent I（Step 2）起動
   - 2.3完了 → Agent J（Step 3）起動
   - 2.4完了 → Agent K（Step 4）起動
   - 2.5完了 → Agent L（Step 5）起動

**各Agentの担当ファイル**:
- **Agent H** — `src/app/step/1/page.tsx`, `src/components/ScenarioCard.tsx`, `src/components/LevelSelector.tsx`
- **Agent I** — `src/app/step/2/page.tsx`, `src/components/RoadmapGraph.tsx`, `src/components/ConceptNode.tsx`
- **Agent J** — `src/app/step/3/page.tsx`（ローディングアニメーション + 背景ロードマップ）
- **Agent K** — `src/app/step/4/page.tsx`, `src/components/CodePanel.tsx`, `src/components/ConnectionLines.tsx`
- **Agent L** — `src/app/step/5/page.tsx`, `src/components/AnswerPanel.tsx`

---

### Phase 5: 統合（全Phase完了後）

| タスク | 内容 | 依存 | 状態 |
|--------|------|------|------|
| 8.1 | E2Eフロー検証 | 全タスク | ⬜ |
| 8.2 | ユニット・インテグレーションテスト | 全タスク | ⬜ |

**並列度**: 1（統合テストのため順次実行）

---

## 依存関係グラフ

```
1.1 ✅
 ├── 1.2 (Agent A) ──┬── 2.2 (Agent D) ──── 4.1-4.2 (Agent I)
 │                    │                        ↑
 ├── 1.3 (Agent B) ──┤── 3.1 (Agent H)       │
 │                    │                        │
 └── 2.1 (Agent C) ──┼── 2.3 (Agent E) ──── 5.1 (Agent J)
                      │
                      ├── 2.4 (Agent F) ──── 6.1-6.2 (Agent K)
                      │
                      └── 2.5 (Agent G) ──── 7.1-7.2 (Agent L)
                                                    │
                                                    ↓
                                              8.1-8.2 (統合)
```

## クリティカルパス

**1.1 → 2.1 → 2.2 → 4.1-4.2 → 8.1**

ロードマップ画面（Step 2）がパーソナライズAPIとReact Flowの両方に依存するため、最も長い依存チェーンとなる。

## ファイル競合回避ルール

各Agentが編集するファイルが重複しないよう、以下を遵守:

1. **各Agentは担当ファイルのみ作成・編集する**（上記の担当ファイル欄参照）
2. **共有型定義**（`src/types/`）はPhase 2のAgent Aが一括作成し、他Agentは読み取りのみ
3. **`layout.tsx`** はAgent Bのみが編集。他AgentはPage単位で作業
4. **`gemini-client.ts`** はAgent Cが作成。Phase 3のAgentはimportして使用するのみ
