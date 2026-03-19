// =============================================================================
// POST /api/generate-doc — 対話内容からパーソナライズ技術ドキュメントを生成
// Geminiで要約 → Google Docsに出力
// =============================================================================

import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { google } from 'googleapis';
import { logger } from '@/lib/logger';

const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? 'gdghackathon-7ff23';
const GCP_LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? 'asia-northeast1';

function createGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) return new GoogleGenAI({ apiKey });
  return new GoogleGenAI({ vertexai: true, project: GCP_PROJECT, location: GCP_LOCATION });
}

// =============================================================================
// 型定義
// =============================================================================

interface ConceptConversation {
  readonly conceptTitle: string;
  readonly messages: readonly { readonly role: 'senpai' | 'user'; readonly text: string }[];
}

interface GenerateDocRequest {
  readonly scenarioTitle: string;
  readonly experienceLevel: string;
  readonly conversations: readonly ConceptConversation[];
  readonly code: string;
}

// =============================================================================
// Geminiでドキュメント内容を生成
// =============================================================================

async function generateDocContent(req: GenerateDocRequest): Promise<string> {
  const ai = createGenAI();

  const conversationSummary = req.conversations
    .map((c) => {
      const dialog = c.messages
        .map((m) => `${m.role === 'senpai' ? '先輩' : '学習者'}: ${m.text}`)
        .join('\n');
      return `### ${c.conceptTitle}\n${dialog}`;
    })
    .join('\n\n---\n\n');

  const prompt = `あなたは技術ドキュメントライターです。
以下のプログラミング学習の対話記録から、学習者専用の技術ドキュメントを生成してください。

## シナリオ: ${req.scenarioTitle}
## 学習者レベル: ${req.experienceLevel}

## 対話記録
${conversationSummary}

## 学習したコード
\`\`\`
${req.code.slice(0, 3000)}
\`\`\`

## ドキュメント生成ルール
以下の構成で、学習者がこのドキュメントを後から見返したときに復習できる内容を作成してください。

1. **概要**: このシナリオで何を学んだかの簡潔なまとめ（2-3文）
2. **各概念のまとめ**: 概念ごとに以下を記載
   - 学習者の理解ポイント: 対話の中で学習者が正しく理解できていた点
   - 注意すべきポイント: 対話の中で先輩が補足・指摘した点
   - コード例: 対話で言及されたコードの抜粋と解説
3. **次のステップ**: この学習を踏まえて次に学ぶべきこと（2-3項目）

- 学習者の発言を元に、その人の理解度に合わせた言葉遣いで書く
- 技術的に正確であること
- 日本語で記述`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 2048 },
    },
  });

  return response.text ?? '# ドキュメント生成に失敗しました';
}

// =============================================================================
// Google Docsに書き込み
// =============================================================================

async function createGoogleDoc(
  title: string,
  content: string
): Promise<{ docId: string; docUrl: string }> {
  const auth = new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  const docs = google.docs({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });

  // 1. ドキュメント作成
  const createRes = await docs.documents.create({
    requestBody: { title },
  });

  const docId = createRes.data.documentId!;

  // 2. コンテンツを挿入（Markdown→プレーンテキスト）
  // Google Docs APIはMarkdownを直接サポートしないため、
  // セクション分けしてテキストとして挿入
  const sections = content.split('\n');
  const requests: { insertText: { location: { index: number }; text: string } }[] = [];

  let index = 1; // Docsのインデックスは1から
  for (const line of sections) {
    requests.push({
      insertText: {
        location: { index },
        text: line + '\n',
      },
    });
    index += line.length + 1;
  }

  if (requests.length > 0) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests },
    });
  }

  // 3. 共有設定（リンクを知っている人は誰でも閲覧可能）
  await drive.permissions.create({
    fileId: docId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
  return { docId, docUrl };
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(request: Request): Promise<NextResponse> {
  let body: GenerateDocRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { scenarioTitle, conversations } = body;

  if (!conversations || conversations.length === 0) {
    return NextResponse.json({ error: '対話データが必要です' }, { status: 400 });
  }

  const startTime = Date.now();

  try {
    // 1. Geminiでドキュメント内容を生成
    const content = await generateDocContent(body);

    // 2. Google Docsに書き込み
    const title = `【リアサポ】${scenarioTitle} - 学習ノート`;
    const { docId, docUrl } = await createGoogleDoc(title, content);

    logger.apiMetric('/api/generate-doc', Date.now() - startTime, 200);

    return NextResponse.json({
      docId,
      docUrl,
      content, // プレビュー用
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ドキュメント生成エラー';
    logger.error('generate-doc failed', { error: msg });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
