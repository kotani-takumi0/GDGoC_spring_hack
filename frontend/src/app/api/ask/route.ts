import { NextResponse } from "next/server";
import { geminiClient } from "@/lib/gemini-client";
import type { ConceptNodeData } from "@/types";

interface AskRequest {
  readonly nodeId: string;
  readonly nodeTitle: string;
  readonly nodeSubtitle: string;
  readonly question: string;
  readonly scenarioTitle: string;
  readonly experienceLevel: string;
}

export async function POST(request: Request) {
  let body: AskRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { nodeId, nodeTitle, nodeSubtitle, question, scenarioTitle, experienceLevel } = body;

  if (!question?.trim()) {
    return NextResponse.json({ error: "質問が空です" }, { status: 400 });
  }

  const levelLabel: Record<string, string> = {
    "complete-beginner": "プログラミング完全初心者",
    "python-experienced": "Python経験者",
    "other-language-experienced": "他言語経験者",
  };

  const prompt = `あなたはプログラミング学習支援AIです。
以下の概念について、ユーザーからの質問に答えてください。

## コンテキスト
シナリオ: ${scenarioTitle}
概念: ${nodeTitle}
概念の説明: ${nodeSubtitle}
ユーザーの経験レベル: ${levelLabel[experienceLevel] ?? experienceLevel}

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

  // Gemini APIでシンプルなテキスト応答を取得
  const result = await geminiClient.askAboutConcept(node, question, prompt);

  if (!result.success) {
    return NextResponse.json(
      { error: `AI応答の生成に失敗しました: ${result.error.message}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ answer: result.data });
}
