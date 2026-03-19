// =============================================================================
// POST /api/evaluate - 理解度評価APIエンドポイント
// ベクトル化・保存・類似回答検索を含む
// =============================================================================

import { NextResponse } from 'next/server';

import { geminiClient } from '@/lib/gemini-client';
import { embedDocument, embedQuery } from '@/lib/embedding-service';
import { saveQALog, findSimilarQA, saveEvaluation } from '@/lib/firestore-service';
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
  readonly modelAnswer?: string;
  readonly scenarioId?: string;
  readonly experienceLevel: ExperienceLevel;
  readonly userId?: string | null;
  readonly question?: string;
}

interface EvaluateResponse {
  readonly nodeId: string;
  readonly status: 'green' | 'yellow' | 'red';
  readonly feedback: string;
  readonly similarMistakes?: readonly { readonly answer: string; readonly feedback: string }[];
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
      modelAnswer: typeof req.modelAnswer === 'string' ? req.modelAnswer : undefined,
      scenarioId: typeof req.scenarioId === 'string' ? req.scenarioId : undefined,
      experienceLevel: req.experienceLevel as ExperienceLevel,
      userId: typeof req.userId === 'string' ? req.userId : null,
      question: typeof req.question === 'string' ? req.question : undefined,
    },
  };
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(
  request: Request
): Promise<NextResponse<EvaluateResponse | ErrorResponse>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'リクエストボディのJSONパースに失敗しました' },
      { status: 400 }
    );
  }

  const validation = validateRequest(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.message },
      { status: 400 }
    );
  }

  const { nodeId, nodeTitle, codeSnippet, userAnswer, modelAnswer, scenarioId, experienceLevel, userId, question } = validation.data;

  const node: ConceptNodeData = {
    id: nodeId,
    title: nodeTitle,
    subtitle: '',
    status: 'default',
  };

  const startTime = Date.now();

  // 類似回答の検索（過去に同じ概念で似た回答をした人のパターン）
  let similarMistakes: { answer: string; feedback: string }[] = [];
  try {
    const queryVectorResult = await embedQuery(userAnswer);
    if (queryVectorResult.success) {
      const similarResult = await findSimilarQA(queryVectorResult.data, nodeId, 3);
      if (similarResult.success && similarResult.data.length > 0) {
        similarMistakes = similarResult.data
          .filter((qa) => qa.answer) // 回答があるもののみ
          .map((qa) => ({
            answer: qa.answer,
            feedback: qa.question, // questionフィールドにフィードバックを保存している
          }));
      }
    }
  } catch {
    // 類似検索失敗は無視
  }

  // 類似回答があればプロンプトのコンテキストに追加
  const similarContext = similarMistakes.length > 0
    ? `\n\n## 過去の類似回答パターン（参考）\n同じ概念で過去の学習者が以下のような回答をしています:\n${similarMistakes.map((m, i) => `${i + 1}. "${m.answer}"`).join('\n')}\nこれらの回答パターンを参考に、ユーザーの理解度をより正確に評価してください。`
    : '';

  try {
    // modelAnswerに類似パターン情報を追加
    const enrichedModelAnswer = modelAnswer
      ? `${modelAnswer}${similarContext}`
      : similarContext || undefined;

    const result = await geminiClient.evaluateUnderstanding(
      node,
      codeSnippet,
      userAnswer,
      enrichedModelAnswer
    );

    if (!result.success) {
      logger.apiMetric('/api/evaluate', Date.now() - startTime, 502);
      return NextResponse.json(
        { error: `Gemini API呼び出しに失敗しました: ${result.error.message}` },
        { status: 502 }
      );
    }

    // ユーザーの回答と評価結果をベクトル付きでFirestoreに保存
    try {
      const docVectorResult = await embedDocument(`${nodeTitle}: ${userAnswer}`);
      const embedding = docVectorResult.success ? [...docVectorResult.data] : undefined;

      // qa_logsに回答パターンを保存（将来の類似検索用）
      await saveQALog({
        userId: userId ?? null,
        nodeId,
        scenarioId: scenarioId ?? 'unknown',
        experienceLevel,
        question: result.data.feedback, // フィードバックを保存（類似検索時に活用）
        answer: userAnswer, // ユーザーの回答を保存
        embedding,
      });

      // evaluationsにスコアを保存
      if (userId) {
        await saveEvaluation(userId, {
          nodeId,
          scenarioId: scenarioId ?? 'unknown',
          score: result.data.status === 'green' ? 80 : result.data.status === 'yellow' ? 50 : 20,
          status: result.data.status,
          feedback: result.data.feedback,
          experienceLevel,
        });
      }
    } catch {
      // 保存失敗は無視（評価結果は返す）
    }

    const response: EvaluateResponse = {
      nodeId,
      status: result.data.status,
      feedback: result.data.feedback,
      similarMistakes: similarMistakes.length > 0
        ? similarMistakes.map((m) => ({ answer: m.answer, feedback: m.feedback }))
        : undefined,
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
