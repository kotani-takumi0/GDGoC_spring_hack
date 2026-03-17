// =============================================================================
// POST /api/generate-code - コード生成APIエンドポイント
// =============================================================================

import { NextResponse } from 'next/server';

import { geminiClient } from '@/lib/gemini-client';
import { getScenario, ScenarioNotFoundError } from '@/lib/scenario-data-loader';
import type { ExperienceLevel } from '@/types';

// =============================================================================
// 型定義
// =============================================================================

interface GenerateCodeRequest {
  readonly scenarioId: string;
  readonly experienceLevel: ExperienceLevel;
}

interface GeneratedFileResponse {
  readonly filename: string;
  readonly code: string;
  readonly description: string;
}

interface GenerateCodeResponse {
  readonly files: readonly GeneratedFileResponse[];
  readonly language: string;
  readonly explanation: string;
}

interface ErrorResponse {
  readonly error: string;
}

// =============================================================================
// バリデーション
// =============================================================================

const VALID_EXPERIENCE_LEVELS: readonly ExperienceLevel[] = [
  'complete-beginner',
  'python-experienced',
  'other-language-experienced',
];

function isValidExperienceLevel(value: unknown): value is ExperienceLevel {
  return (
    typeof value === 'string' &&
    VALID_EXPERIENCE_LEVELS.includes(value as ExperienceLevel)
  );
}

function validateRequest(
  body: unknown
): { success: true; data: GenerateCodeRequest } | { success: false; message: string } {
  if (body === null || typeof body !== 'object') {
    return { success: false, message: 'リクエストボディが不正です' };
  }

  const { scenarioId, experienceLevel } = body as Record<string, unknown>;

  if (typeof scenarioId !== 'string' || scenarioId.trim() === '') {
    return {
      success: false,
      message: 'scenarioId は空でない文字列で指定してください',
    };
  }

  if (!isValidExperienceLevel(experienceLevel)) {
    return {
      success: false,
      message: `experienceLevel は ${VALID_EXPERIENCE_LEVELS.join(', ')} のいずれかで指定してください`,
    };
  }

  return {
    success: true,
    data: { scenarioId: scenarioId.trim(), experienceLevel },
  };
}

// =============================================================================
// ファイル名生成
// =============================================================================

const LANGUAGE_EXTENSION_MAP: Readonly<Record<string, string>> = {
  python: '.py',
  javascript: '.js',
  typescript: '.ts',
  java: '.java',
  c: '.c',
  cpp: '.cpp',
  'c++': '.cpp',
  go: '.go',
  rust: '.rs',
  ruby: '.rb',
  php: '.php',
  swift: '.swift',
  kotlin: '.kt',
};

function buildFilename(scenarioId: string, language: string): string {
  const normalizedLanguage = language.toLowerCase().trim();
  const extension = LANGUAGE_EXTENSION_MAP[normalizedLanguage] ?? '.txt';
  return `${scenarioId}${extension}`;
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(
  request: Request
): Promise<NextResponse<GenerateCodeResponse | ErrorResponse>> {
  // リクエストボディのパース
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'リクエストボディのJSON解析に失敗しました' },
      { status: 400 }
    );
  }

  // バリデーション
  const validation = validateRequest(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.message },
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

  // Gemini APIでコード生成
  const result = await geminiClient.generateCode(scenario, experienceLevel);

  if (!result.success) {
    console.error('[generate-code] Gemini API エラー:', result.error);
    return NextResponse.json(
      { error: 'コード生成に失敗しました。しばらく待ってからもう一度お試しください。' },
      { status: 502 }
    );
  }

  const { files, language, explanation } = result.data;

  return NextResponse.json<GenerateCodeResponse>(
    { files, language, explanation },
    { status: 200 }
  );
}
