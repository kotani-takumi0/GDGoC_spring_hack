// =============================================================================
// GET/POST /api/session — セッションデータの保存・復元
// =============================================================================

import { NextResponse } from 'next/server';
import { saveSession, loadSession } from '@/lib/firestore-service';

// =============================================================================
// GET: セッション復元
// =============================================================================

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { error: 'userId パラメータが必要です' },
      { status: 400 }
    );
  }

  const result = await loadSession(userId);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ session: result.data });
}

// =============================================================================
// POST: セッションデータ保存
// =============================================================================

export async function POST(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'リクエストボディのJSONパースに失敗しました' },
      { status: 400 }
    );
  }

  const { userId, key, data } = body;

  if (typeof userId !== 'string' || typeof key !== 'string') {
    return NextResponse.json(
      { error: 'userId と key は必須の文字列パラメータです' },
      { status: 400 }
    );
  }

  // キーに応じてセッションデータを部分更新
  const currentResult = await loadSession(userId);
  const current = currentResult.success ? currentResult.data : null;

  const sessionData = {
    scenarioId: current?.scenarioId ?? '',
    experienceLevel: current?.experienceLevel ?? 'complete-beginner' as const,
    mode: current?.mode ?? 'demo' as const,
    currentStep: current?.currentStep ?? 1,
    generatedCode: current?.generatedCode ?? null,
    mappings: current?.mappings ?? null,
  };

  // キーに応じてフィールドを更新
  if (key === 'riasapo-generated-code') {
    const codeData = data as typeof sessionData.generatedCode;
    return saveAndRespond(userId, { ...sessionData, generatedCode: codeData });
  }

  if (key === 'riasapo-mappings') {
    const mappingsData = data as typeof sessionData.mappings;
    return saveAndRespond(userId, { ...sessionData, mappings: mappingsData });
  }

  if (key === 'riasapo-scenario') {
    const scenarioData = data as {
      scenarioId?: string;
      experienceLevel?: typeof sessionData.experienceLevel;
      mode?: typeof sessionData.mode;
    };
    return saveAndRespond(userId, {
      ...sessionData,
      scenarioId: scenarioData?.scenarioId ?? sessionData.scenarioId,
      experienceLevel: scenarioData?.experienceLevel ?? sessionData.experienceLevel,
      mode: scenarioData?.mode ?? sessionData.mode,
    });
  }

  return NextResponse.json(
    { error: `不明なセッションキー: ${key}` },
    { status: 400 }
  );
}

async function saveAndRespond(
  userId: string,
  data: Parameters<typeof saveSession>[1]
): Promise<NextResponse> {
  const result = await saveSession(userId, data);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
