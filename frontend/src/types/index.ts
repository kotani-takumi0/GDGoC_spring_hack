// =============================================================================
// 共有型定義 - シナリオ・概念ノード・経験レベル
// =============================================================================

/**
 * シナリオ一覧で表示するサマリー情報
 */
export interface ScenarioSummary {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly available: boolean;
}

/**
 * シナリオの完全な定義（ノード・エッジ・フォールバック含む）
 */
export interface ScenarioDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly nodes: readonly ConceptNodeDefinition[];
  readonly edges: readonly ConceptEdge[];
  readonly fallbackMappings: readonly FallbackMapping[];
}

/**
 * ノードの種別: feature=実装対象の機能, concept=理解が必要な概念
 */
export type NodeType = 'app' | 'feature' | 'concept';

/**
 * 概念ノードの定義（静的データ）
 */
export interface ConceptNodeDefinition {
  readonly id: string;
  readonly title: string;
  readonly defaultSubtitle: string;
  readonly dependsOn: readonly string[];
  readonly nodeType?: NodeType;
}

/**
 * 概念ノード間の依存関係エッジ
 */
export interface ConceptEdge {
  readonly source: string;
  readonly target: string;
}

/**
 * フォールバック時に表示するコード例と説明
 */
export interface FallbackMapping {
  readonly nodeId: string;
  readonly codeExample: string;
  readonly explanation: string;
}

/**
 * 経験レベルの識別子
 */
export type ExperienceLevel =
  | 'complete-beginner'
  | 'python-experienced'
  | 'other-language-experienced';

/**
 * 経験レベルの定義（表示用情報含む）
 */
export interface ExperienceLevelDefinition {
  readonly id: ExperienceLevel;
  readonly label: string;
  readonly description: string;
}

/**
 * UIで使用する概念ノードの状態付きデータ
 */
export interface ConceptNodeData {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly codeSnippet?: string;
  readonly status: 'default' | 'green' | 'yellow' | 'red';
  readonly nodeType?: NodeType;
}

/**
 * シナリオデータローダーのインターフェース
 */
export interface ScenarioDataLoader {
  getScenarioList(): readonly ScenarioSummary[];
  getScenario(scenarioId: string): ScenarioDefinition;
  getExperienceLevels(): readonly ExperienceLevelDefinition[];
}
