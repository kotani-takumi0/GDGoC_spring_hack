// =============================================================================
// POST /api/personalize - パーソナライズAPIエンドポイント
// =============================================================================

import { NextResponse } from 'next/server';

import { geminiClient } from '@/lib/gemini-client';
import type { PersonalizedNode } from '@/lib/gemini-client';
import { getScenario, ScenarioNotFoundError } from '@/lib/scenario-data-loader';
import type {
  ExperienceLevel,
  ConceptNodeData,
  ConceptNodeDefinition,
} from '@/types';

// =============================================================================
// バリデーション
// =============================================================================

const VALID_EXPERIENCE_LEVELS: readonly ExperienceLevel[] = [
  'complete-beginner',
  'python-experienced',
  'other-language-experienced',
];

function isExperienceLevel(value: unknown): value is ExperienceLevel {
  return (
    typeof value === 'string' &&
    VALID_EXPERIENCE_LEVELS.includes(value as ExperienceLevel)
  );
}

interface PersonalizeRequest {
  readonly scenarioId: string;
  readonly experienceLevel: ExperienceLevel;
}

interface ValidationError {
  readonly field: string;
  readonly message: string;
}

function validateRequest(
  body: unknown
): { readonly valid: true; readonly data: PersonalizeRequest } | { readonly valid: false; readonly errors: readonly ValidationError[] } {
  if (body === null || typeof body !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'body', message: 'リクエストボディはJSONオブジェクトである必要があります' }],
    };
  }

  const errors: ValidationError[] = [];
  const record = body as Record<string, unknown>;

  if (typeof record.scenarioId !== 'string' || record.scenarioId.trim() === '') {
    errors.push({
      field: 'scenarioId',
      message: 'scenarioId は必須の文字列パラメータです',
    });
  }

  if (!isExperienceLevel(record.experienceLevel)) {
    errors.push({
      field: 'experienceLevel',
      message: `experienceLevel は ${VALID_EXPERIENCE_LEVELS.join(', ')} のいずれかである必要があります`,
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      scenarioId: (record.scenarioId as string).trim(),
      experienceLevel: record.experienceLevel as ExperienceLevel,
    },
  };
}

// =============================================================================
// データ変換
// =============================================================================

function toConceptNodeData(node: ConceptNodeDefinition): ConceptNodeData {
  return {
    id: node.id,
    title: node.title,
    subtitle: node.defaultSubtitle,
    status: 'default',
  };
}

function toFallbackNodes(
  nodes: readonly ConceptNodeDefinition[]
): PersonalizedNode[] {
  return nodes.map((node) => ({
    id: node.id,
    title: node.title,
    subtitle: node.defaultSubtitle,
  }));
}

// =============================================================================
// ルートハンドラ
// =============================================================================

export async function POST(request: Request): Promise<NextResponse> {
  // リクエストボディのパース
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'リクエストボディのJSONパースに失敗しました' },
      { status: 400 }
    );
  }

  // バリデーション
  const validation = validateRequest(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'バリデーションエラー', details: validation.errors },
      { status: 400 }
    );
  }

  const { scenarioId, experienceLevel } = validation.data;

  // シナリオ定義の取得
  let scenario;
  try {
    scenario = getScenario(scenarioId);
  } catch (e) {
    if (e instanceof ScenarioNotFoundError) {
      return NextResponse.json(
        { error: `シナリオが見つかりません: ${scenarioId}` },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'シナリオの取得中に予期しないエラーが発生しました' },
      { status: 500 }
    );
  }

  // ConceptNodeDefinition → ConceptNodeData に変換
  const conceptNodes: readonly ConceptNodeData[] =
    scenario.nodes.map(toConceptNodeData);

  // Gemini API でパーソナライズ
  const result = await geminiClient.personalizeDescriptions(
    conceptNodes,
    experienceLevel
  );

  // 失敗時フォールバック: 静的JSONのdefaultSubtitleをそのまま返す
  if (!result.success) {
    console.warn(
      `[personalize] Gemini API 失敗。フォールバックを使用します: ${result.error.message}`
    );
    const fallbackNodes = toFallbackNodes(scenario.nodes);
    return NextResponse.json({ nodes: fallbackNodes });
  }

  // 成功時
  return NextResponse.json({ nodes: result.data });
}
