// =============================================================================
// POST /api/generate-question — 概念の理解度を確かめる質問を生成
// =============================================================================

import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? 'gdghackathon-7ff23';
const GCP_LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? 'asia-northeast1';

function createGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) return new GoogleGenAI({ apiKey });
  return new GoogleGenAI({ vertexai: true, project: GCP_PROJECT, location: GCP_LOCATION });
}

interface GenerateQuestionRequest {
  readonly conceptTitle: string;
  readonly code: string;
  readonly experienceLevel: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: GenerateQuestionRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { conceptTitle, code, experienceLevel } = body;

  if (!conceptTitle) {
    return NextResponse.json({ error: 'conceptTitle is required' }, { status: 400 });
  }

  const levelLabel: Record<string, string> = {
    'complete-beginner': 'プログラミング完全初心者',
    'python-experienced': 'Python経験者',
    'other-language-experienced': '他言語経験者',
  };

  const prompt = `あなたはプログラミングの先輩エンジニアです。口調はカジュアルで親しみやすいが、技術的に鋭い。

後輩が「${conceptTitle}」を本当に理解しているか確かめる質問を1つ作ってください。

## 後輩のレベル
${levelLabel[experienceLevel] ?? experienceLevel}

## 後輩が学習中のコード（右側に表示されている）
\`\`\`
${code.slice(0, 2000)}
\`\`\`

## 質問生成のルール
- コードの中の「${conceptTitle}」に関係する具体的な箇所を指して質問する
- 暗記では答えられない、理解していないと答えられない質問にする
- 「もしこの部分を○○に変えたらどうなる？」「ここを消したら何が起きる？」「なぜこう書いた？」のような、思考を要する問い
- 右のコードを見ながら答えられる内容にする
- 先輩っぽい口調で、1〜3文で簡潔に
- 「右のコード見て」から始める`;

  try {
    const ai = createGenAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            question: { type: 'STRING' },
          },
          required: ['question'],
        },
        thinkingConfig: { thinkingBudget: 512 },
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json({ error: '質問生成に失敗しました' }, { status: 502 });
    }

    const parsed = JSON.parse(text) as { question: string };
    return NextResponse.json({ question: parsed.question });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '質問生成エラー';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
