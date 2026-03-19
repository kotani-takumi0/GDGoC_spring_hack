import { NextResponse } from "next/server";
import { geminiClient, callWithGrounding } from "@/lib/gemini-client";
import type { Citation } from "@/lib/gemini-client";
import { embedDocument, embedQuery } from "@/lib/embedding-service";
import { saveQALog, findSimilarQA } from "@/lib/firestore-service";
import { logger } from "@/lib/logger";
import type { ConceptNodeData, ExperienceLevel } from "@/types";

interface AskRequest {
  readonly nodeId: string;
  readonly nodeTitle: string;
  readonly nodeSubtitle: string;
  readonly question: string;
  readonly scenarioTitle: string;
  readonly scenarioId?: string;
  readonly experienceLevel: string;
  readonly userId?: string | null;
}

export async function POST(request: Request) {
  let body: AskRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { nodeId, nodeTitle, nodeSubtitle, question, scenarioTitle, scenarioId, experienceLevel, userId } = body;

  if (!question?.trim()) {
    return NextResponse.json({ error: "質問が空です" }, { status: 400 });
  }

  const startTime = Date.now();

  // 類似Q&A検索（ベクトルインデックスが利用可能な場合）
  let similarQAs: readonly { readonly question: string; readonly answer: string }[] = [];
  try {
    const queryVectorResult = await embedQuery(question);
    if (queryVectorResult.success) {
      const similarResult = await findSimilarQA(queryVectorResult.data, nodeId, 3);
      if (similarResult.success) {
        similarQAs = similarResult.data.map((qa) => ({
          question: qa.question,
          answer: qa.answer,
        }));
      }
    }
  } catch {
    // ベクトル検索失敗は無視（通常回答にフォールバック）
  }

  const levelLabel: Record<string, string> = {
    "complete-beginner": "プログラミング完全初心者",
    "python-experienced": "Python経験者",
    "other-language-experienced": "他言語経験者",
  };

  // 類似Q&Aがあればコンテキストに追加
  const similarContext = similarQAs.length > 0
    ? `\n\n## 過去の類似質問（参考）\n${similarQAs.map((qa, i) => `${i + 1}. Q: ${qa.question}\n   A: ${qa.answer}`).join('\n')}`
    : '';

  const prompt = `あなたはプログラミング学習支援AIです。
以下の概念について、ユーザーからの質問に答えてください。

## コンテキスト
シナリオ: ${scenarioTitle}
概念: ${nodeTitle}
概念の説明: ${nodeSubtitle}
ユーザーの経験レベル: ${levelLabel[experienceLevel] ?? experienceLevel}${similarContext}

## ユーザーの質問
${question}

## 指示
- 経験レベルに合わせて分かりやすく回答してください
- 具体例やコード例を含めると理解しやすくなります
- 回答は日本語で、簡潔に（200文字以内が目安）`;

  const node: ConceptNodeData = {
    id: nodeId,
    title: nodeTitle,
    subtitle: nodeSubtitle,
    status: "default",
  };

  // Grounding付きで回答を取得（失敗時は通常回答にフォールバック）
  let answer: string;
  let citations: readonly Citation[] = [];

  const groundedResult = await callWithGrounding(prompt);
  if (groundedResult.success) {
    answer = groundedResult.data.answer;
    citations = groundedResult.data.citations;
  } else {
    // Groundingが失敗した場合は通常のGemini応答にフォールバック
    const fallbackResult = await geminiClient.askAboutConcept(node, question, prompt);
    if (!fallbackResult.success) {
      return NextResponse.json(
        { error: `AI応答の生成に失敗しました: ${fallbackResult.error.message}` },
        { status: 502 }
      );
    }
    answer = fallbackResult.data;
  }

  // Q&Aログをベクトル付きでFirestoreに保存（非同期・失敗しても回答は返す）
  try {
    const docVectorResult = await embedDocument(`${question} ${answer}`);
    const embedding = docVectorResult.success ? [...docVectorResult.data] : undefined;

    await saveQALog({
      userId: userId ?? null,
      nodeId,
      scenarioId: scenarioId ?? scenarioTitle,
      experienceLevel: experienceLevel as ExperienceLevel,
      question,
      answer,
      embedding,
    });
  } catch {
    // ログ保存失敗は無視
  }

  logger.apiMetric('/api/ask', Date.now() - startTime, 200);

  return NextResponse.json({
    answer,
    citations: citations.length > 0 ? citations : undefined,
    similarQAs: similarQAs.length > 0 ? similarQAs : undefined,
  });
}
