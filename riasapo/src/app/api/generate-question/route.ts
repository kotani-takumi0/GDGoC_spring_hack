// =============================================================================
// POST /api/generate-question — 全概念の質問＋模範解答を一括生成
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

interface ConceptInput {
  readonly id: string;
  readonly title: string;
}

interface GenerateQuestionsRequest {
  readonly concepts: readonly ConceptInput[];
  readonly code: string;
  readonly experienceLevel: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: GenerateQuestionsRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { concepts, code, experienceLevel } = body;

  if (!concepts || concepts.length === 0) {
    return NextResponse.json({ error: 'concepts is required' }, { status: 400 });
  }

  const levelLabel: Record<string, string> = {
    'complete-beginner': 'プログラミング完全初心者',
    'python-experienced': 'Python経験者',
    'other-language-experienced': '他言語経験者',
  };

  const conceptList = concepts.map((c) => `- ${c.id}: ${c.title}`).join('\n');

  const prompt = `あなたはプログラミングの先輩エンジニアです。口調はカジュアルで親しみやすいが、技術的に鋭い。

後輩が以下の概念を本当に理解しているか確かめる質問を、概念ごとに1つずつ作ってください。
また、それぞれの質問に対する模範解答も作ってください。

## 後輩のレベル
${levelLabel[experienceLevel] ?? experienceLevel}

## 確認する概念
${conceptList}

## 後輩が学習中のコード（画面右側に表示されている）
\`\`\`
${code.slice(0, 3000)}
\`\`\`

## 質問生成のルール
- 各概念につき質問を1つだけ生成する
- 右のコードの中の具体的な箇所を \`バッククォート\` で示して質問する
- 暗記では答えられない、コードを見て考えないと答えられない質問にする
- 「もしこの部分を変えたらどうなる？」「ここを消したら？」「なぜこう書いた？」のような思考を要する問い
- 先輩っぽいカジュアルな口調で、1〜3文で簡潔に
- 「右のコード見て」から始める

## 模範解答のルール
- 後輩のレベルに合った言葉で、2〜4文で簡潔に
- コードのどの部分がどう関係するかを具体的に説明する`;

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
            questions: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  conceptId: { type: 'STRING' },
                  question: { type: 'STRING' },
                  modelAnswer: { type: 'STRING' },
                },
                required: ['conceptId', 'question', 'modelAnswer'],
              },
            },
          },
          required: ['questions'],
        },
        thinkingConfig: { thinkingBudget: 1024 },
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json({ error: '質問生成に失敗しました' }, { status: 502 });
    }

    const parsed = JSON.parse(text) as { questions: { conceptId: string; question: string; modelAnswer: string }[] };
    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '質問生成エラー';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
