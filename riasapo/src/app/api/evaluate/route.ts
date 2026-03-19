// =============================================================================
// POST /api/evaluate - 理解度評価APIエンドポイント
// =============================================================================

import { NextResponse } from 'next/server';

import { geminiClient } from '@/lib/gemini-client';
import { logger } from '@/lib/logger';
import type { ConceptNodeData, ExperienceLevel } from '@/types';

// =============================================================================
// リクエスト・レスポンス型
// =============================================================================

interface EvaluateRequest {
  readonly nodeId: string;
  readonly nodeTitle: string;
  readonly codeSnippet: string;
  readonly userAnswer: string;
  readonly experienceLevel: ExperienceLevel;
}

interface EvaluateResponse {
  readonly nodeId: string;
  readonly status: 'green' | 'yellow' | 'red';
  readonly feedback: string;
}

interface ErrorResponse {
  readonly error: string;
}

// =============================================================================
// 定数
// =============================================================================

const VALID_EXPERIENCE_LEVELS: readonly ExperienceLevel[] = [
  'complete-beginner',
  'python-experienced',
  'other-language-experienced',
];

const MAX_USER_ANSWER_LENGTH = 5000;

// =============================================================================
// バリデーション
// =============================================================================

function validateRequest(
  body: unknown
): { valid: true; data: EvaluateRequest } | { valid: false; message: string } {
  if (body === null || typeof body !== 'object') {
    return { valid: false, message: 'リクエストボディが不正です' };
  }

  const req = body as Record<string, unknown>;

  if (typeof req.nodeId !== 'string' || req.nodeId.trim() === '') {
    return { valid: false, message: 'nodeId は必須の文字列です' };
  }

  if (typeof req.nodeTitle !== 'string' || req.nodeTitle.trim() === '') {
    return { valid: false, message: 'nodeTitle は必須の文字列です' };
  }

  if (typeof req.codeSnippet !== 'string' || req.codeSnippet.trim() === '') {
    return { valid: false, message: 'codeSnippet は必須の文字列です' };
  }

  if (typeof req.userAnswer !== 'string' || req.userAnswer.trim() === '') {
    return { valid: false, message: 'userAnswer は必須の文字列です（空文字不可）' };
  }

  if (req.userAnswer.length > MAX_USER_ANSWER_LENGTH) {
    return {
      valid: false,
      message: `userAnswer は${MAX_USER_ANSWER_LENGTH}文字以内にしてください`,
    };
  }

  if (
    typeof req.experienceLevel !== 'string' ||
    !VALID_EXPERIENCE_LEVELS.includes(req.experienceLevel as ExperienceLevel)
  ) {
    return {
      valid: false,
      message: `experienceLevel は ${VALID_EXPERIENCE_LEVELS.join(', ')} のいずれかを指定してください`,
    };
  }

  return {
    valid: true,
    data: {
      nodeId: req.nodeId,
      nodeTitle: req.nodeTitle,
      codeSnippet: req.codeSnippet,
      userAnswer: req.userAnswer,
      experienceLevel: req.experienceLevel as ExperienceLevel,
    },
  };
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(
  request: Request
): Promise<NextResponse<EvaluateResponse | ErrorResponse>> {
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
      { error: validation.message },
      { status: 400 }
    );
  }

  const { nodeId, nodeTitle, codeSnippet, userAnswer } = validation.data;

  // ConceptNodeDataオブジェクトを構築
  const node: ConceptNodeData = {
    id: nodeId,
    title: nodeTitle,
    subtitle: '',
    status: 'default',
  };

  // Gemini APIで理解度評価を実行
  const startTime = Date.now();
  try {
    const result = await geminiClient.evaluateUnderstanding(
      node,
      codeSnippet,
      userAnswer
    );

    if (!result.success) {
      logger.apiMetric('/api/evaluate', Date.now() - startTime, 502);
      return NextResponse.json(
        { error: `Gemini API呼び出しに失敗しました: ${result.error.message}` },
        { status: 502 }
      );
    }

    const response: EvaluateResponse = {
      nodeId,
      status: result.data.status,
      feedback: result.data.feedback,
    };

    logger.apiMetric('/api/evaluate', Date.now() - startTime, 200);
    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '予期しないエラーが発生しました';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
