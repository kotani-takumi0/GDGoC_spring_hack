// =============================================================================
// POST /api/execute-code — Gemini Code Execution で概念コードの動作確認
// =============================================================================

import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// =============================================================================
// 型定義
// =============================================================================

interface ExecuteCodeRequest {
  readonly conceptTitle: string;
  readonly codeSnippet: string;
  readonly explanation: string;
}

// =============================================================================
// GenAI初期化
// =============================================================================

const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? 'gdghackathon-7ff23';
const GCP_LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? 'asia-northeast1';
const GEMINI_MODEL = 'gemini-2.5-flash';

function createGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    return new GoogleGenAI({ apiKey });
  }
  return new GoogleGenAI({
    vertexai: true,
    project: GCP_PROJECT,
    location: GCP_LOCATION,
  });
}

// =============================================================================
// ルートハンドラ
// =============================================================================

export async function POST(request: Request): Promise<NextResponse> {
  let body: ExecuteCodeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { conceptTitle, codeSnippet, explanation } = body;

  if (!codeSnippet?.trim()) {
    return NextResponse.json({ error: 'コードスニペットが空です' }, { status: 400 });
  }

  const prompt = `以下のプログラミング概念「${conceptTitle}」に関するTypeScriptコードを、Pythonに変換して実行し、動作を確認してください。

## 元のTypeScriptコード
\`\`\`typescript
${codeSnippet}
\`\`\`

## 概念の説明
${explanation}

## 指示
1. 上記のTypeScriptコードの動作を再現するPythonコードを書いてください
2. コードを実行して結果を確認してください
3. 実行結果をもとに、この概念がどう動作するか日本語で簡潔に説明してください`;

  try {
    const ai = createGenAI();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [{ codeExecution: {} }],
      },
    });

    // レスポンスからコード実行結果を抽出
    const parts = response.candidates?.[0]?.content?.parts ?? [];

    let executedCode = '';
    let executionOutput = '';
    let outcome: 'OUTCOME_OK' | 'OUTCOME_FAILED' | 'OUTCOME_DEADLINE_EXCEEDED' = 'OUTCOME_OK';
    let explanationText = response.text ?? '';

    for (const part of parts) {
      if (part.executableCode) {
        executedCode = part.executableCode.code ?? '';
      }
      if (part.codeExecutionResult) {
        executionOutput = part.codeExecutionResult.output ?? '';
        const rawOutcome = part.codeExecutionResult.outcome ?? 'OUTCOME_OK';
        if (rawOutcome === 'OUTCOME_FAILED' || rawOutcome === 'OUTCOME_DEADLINE_EXCEEDED') {
          outcome = rawOutcome;
        }
      }
    }

    return NextResponse.json({
      code: executedCode,
      output: executionOutput,
      outcome,
      explanation: explanationText,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Code Executionエラー';
    return NextResponse.json(
      { error: `コード実行に失敗しました: ${message}` },
      { status: 502 }
    );
  }
}
