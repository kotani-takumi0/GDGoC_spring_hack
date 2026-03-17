import type {
  ScenarioSummary,
  ScenarioDefinition,
  ExperienceLevelDefinition,
  ScenarioDataLoader,
} from '@/types';

import scenarioListData from '@/data/scenarios/index.json';
import todoAppData from '@/data/scenarios/todo-app.json';
import experienceLevelsData from '@/data/experience-levels.json';

// ---------------------------------------------------------------------------
// 静的JSONデータのバリデーション付きキャスト
// ---------------------------------------------------------------------------

const scenarioList: readonly ScenarioSummary[] =
  scenarioListData as readonly ScenarioSummary[];

const scenarioMap: ReadonlyMap<string, ScenarioDefinition> = new Map([
  ['todo-app', todoAppData as unknown as ScenarioDefinition],
]);

const experienceLevels: readonly ExperienceLevelDefinition[] =
  experienceLevelsData as readonly ExperienceLevelDefinition[];

// ---------------------------------------------------------------------------
// エラー
// ---------------------------------------------------------------------------

class ScenarioNotFoundError extends Error {
  constructor(scenarioId: string) {
    super(`シナリオが見つかりません: ${scenarioId}`);
    this.name = 'ScenarioNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// データローダー実装
// ---------------------------------------------------------------------------

/**
 * シナリオ一覧を取得する
 */
function getScenarioList(): readonly ScenarioSummary[] {
  return scenarioList;
}

/**
 * 指定IDのシナリオ定義を取得する
 * @throws {ScenarioNotFoundError} シナリオが存在しない場合
 */
function getScenario(scenarioId: string): ScenarioDefinition {
  const scenario = scenarioMap.get(scenarioId);
  if (!scenario) {
    throw new ScenarioNotFoundError(scenarioId);
  }
  return scenario;
}

/**
 * 経験レベル一覧を取得する
 */
function getExperienceLevels(): readonly ExperienceLevelDefinition[] {
  return experienceLevels;
}

// ---------------------------------------------------------------------------
// エクスポート
// ---------------------------------------------------------------------------

export const scenarioDataLoader: ScenarioDataLoader = {
  getScenarioList,
  getScenario,
  getExperienceLevels,
};

export { getScenarioList, getScenario, getExperienceLevels, ScenarioNotFoundError };
