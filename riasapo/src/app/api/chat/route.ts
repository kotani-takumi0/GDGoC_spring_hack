// =============================================================================
// POST /api/chat — 先輩エンジニアとの対話API
// 会話履歴を受け取り、先輩として返答する（一問一答ではなく対話形式）
// =============================================================================

import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { logger } from '@/lib/logger';

const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? 'gdghackathon-7ff23';
const GCP_LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? 'asia-northeast1';

function createGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) return new GoogleGenAI({ apiKey });
  return new GoogleGenAI({ vertexai: true, project: GCP_PROJECT, location: GCP_LOCATION });
}

interface ChatMessage {
  readonly role: 'senpai' | 'user';
  readonly text: string;
}

interface ChatRequest {
  readonly conceptTitle: string;
  readonly code: string;
  readonly experienceLevel: string;
  readonly history: readonly ChatMessage[];
  readonly userMessage: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { conceptTitle, code, experienceLevel, history, userMessage } = body;

  if (!userMessage?.trim()) {
    return NextResponse.json({ error: 'メッセージが空です' }, { status: 400 });
  }

  const startTime = Date.now();

  const levelLabel: Record<string, string> = {
    'complete-beginner': 'プログラミング完全初心者',
    'python-experienced': 'Python経験者',
    'other-language-experienced': '他言語経験者',
  };

  // 会話履歴をテキストに変換
  const historyText = history
    .map((m) => `${m.role === 'senpai' ? '先輩' : '後輩'}: ${m.text}`)
    .join('\n\n');

  const prompt = `あなたはプログラミングの先輩エンジニアです。
後輩と「${conceptTitle}」について対話しています。

## あなたの性格・口調
- カジュアルで親しみやすい。でも技術的には鋭い
- 正解/不正解をジャッジしない。理解を深めるための問いかけを続ける
- 後輩の回答が曖昧なら「もうちょいいける」「具体的には？」と深掘りする
- 後輩が良いことを言ったら素直に褒める
- コードの具体的な箇所を示しながら話す（バッククォートで囲む）

## 後輩のレベル
${levelLabel[experienceLevel] ?? experienceLevel}

## 対象コード（画面右側に表示中）
\`\`\`
${code.slice(0, 3000)}
\`\`\`

## これまでの会話
${historyText}

## 後輩の最新メッセージ
${userMessage}

## 指示
- 先輩として自然に返答してください
- 後輩の理解度に合わせて、深掘りしたり、新しい視点を提示したり、コードの別の部分に話を広げたりしてください
- 回答は日本語で、2〜4文で簡潔に
- 正解・不正解の判定はしない。あくまで対話で理解を深める`;

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
            reply: { type: 'STRING' },
          },
          required: ['reply'],
        },
        thinkingConfig: { thinkingBudget: 512 },
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json({ error: '返答生成に失敗しました' }, { status: 502 });
    }

    const parsed = JSON.parse(text) as { reply: string };

    logger.apiMetric('/api/chat', Date.now() - startTime, 200);
    return NextResponse.json({ reply: parsed.reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'チャットエラー';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
