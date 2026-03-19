"use client";

import { Suspense, useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import StepIndicator from "@/components/StepIndicator";
import AnswerPanel from "@/components/AnswerPanel";
import scenarioData from "@/data/scenarios/todo-app.json";
import type {
  ScenarioDefinition,
  ExperienceLevel,
} from "@/types";

// =============================================================================
// 型定義
// =============================================================================

interface StoredMapping {
  readonly nodeId: string;
  readonly codeSnippet: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly explanation: string;
}

type NodeStatus = "default" | "green" | "yellow" | "red";

interface EvaluateResponse {
  readonly nodeId: string;
  readonly status: "green" | "yellow" | "red";
  readonly feedback: string;
}

// =============================================================================
// 先輩の質問バリエーション（コードベース）
// =============================================================================

type QuestionTemplate = (snippet: string) => string;

const QUESTION_TEMPLATES: readonly QuestionTemplate[] = [
  () => `右のコード見て。\nこれ、なんでこう書く必要があるの？\n書かなかったらどうなるか含めて説明してみ。`,
  () => `右のコード見てね。\nこの部分、後輩に「何してるんですか？」って聞かれたら\nなんて答える？`,
  () => `右にコード出てるでしょ。\nこのコード、もしバグってたら何が起きると思う？\nこの処理の役割を踏まえて答えて。`,
  () => `右のコード、実際のアプリ上でどういう動きになるか、\nユーザー目線で説明してみて。`,
  () => `右のコード見ながら答えて。\nプログラミング知らない友達に説明するとしたら、\n何に例える？`,
  () => `右のコード、別の書き方でも同じことできると思う？\nなんでこの書き方なのか、考えを聞かせて。`,
  () => `右のコード見て。\nこの処理を消したら、アプリ全体にどう影響する？\n自分の言葉でどうぞ。`,
];

const FALLBACK_TEMPLATES: readonly ((title: string) => string)[] = [
  (title) => `「${title}」について、自分の言葉で説明してみて。\nどういう場面で使うか、なんで必要なのかも含めて。`,
  (title) => `「${title}」がなかったらどうなると思う？\nなんでこれが必要なのか教えて。`,
  (title) => `プログラミング初心者に「${title}」を教えるとしたら、\nどう説明する？`,
];

function getQuestionForNode(snippet: string, title: string, index: number): string {
  const hasCode = snippet && snippet !== title && snippet.length > 5;
  if (hasCode) {
    const template = QUESTION_TEMPLATES[index % QUESTION_TEMPLATES.length];
    return template(snippet);
  }
  const fallback = FALLBACK_TEMPLATES[index % FALLBACK_TEMPLATES.length];
  return fallback(title);
}

// =============================================================================
// ユーティリティ
// =============================================================================

function loadMappings(): readonly StoredMapping[] | null {
  try {
    const raw = sessionStorage.getItem("riasapo-mappings");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.mappings && Array.isArray(parsed.mappings) && parsed.mappings.length > 0) {
      return parsed.mappings;
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as StoredMapping[];
    }
    return null;
  } catch {
    return null;
  }
}

function buildCodeSnippetMap(
  scenario: ScenarioDefinition,
  mappings: readonly StoredMapping[] | null,
): Record<string, string> {
  const snippetMap: Record<string, string> = {};
  for (const fb of scenario.fallbackMappings) {
    snippetMap[fb.nodeId] = fb.codeExample;
  }
  if (mappings) {
    for (const m of mappings) {
      snippetMap[m.nodeId] = m.codeSnippet;
    }
  }
  return snippetMap;
}

// =============================================================================
// ステータス設定
// =============================================================================

const STATUS_CONFIG: Record<NodeStatus, { dot: string; label: string }> = {
  default: { dot: "bg-gray-600", label: "未回答" },
  green: { dot: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]", label: "OK" },
  yellow: { dot: "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]", label: "惜しい" },
  red: { dot: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]", label: "復習" },
};

// =============================================================================
// メインページ
// =============================================================================

function Step5Content() {
  const searchParams = useSearchParams();
  const level = (searchParams.get("level") ?? "complete-beginner") as ExperienceLevel;

  const scenario = scenarioData as unknown as ScenarioDefinition;
  const nodes = scenario.nodes.filter((n) => n.nodeType !== "feature" && n.nodeType !== "app");

  const [codeSnippetMap, setCodeSnippetMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const mappings = loadMappings();
    const map = buildCodeSnippetMap(scenario, mappings);
    setCodeSnippetMap(map);
  }, [scenario]);

  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>(() => {
    const initial: Record<string, NodeStatus> = {};
    for (const node of nodes) {
      initial[node.id] = "default";
    }
    return initial;
  });
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<{
    status: "green" | "yellow" | "red";
    text: string;
  } | null>(null);

  const answeredCount = useMemo(
    () => Object.values(nodeStatuses).filter((s) => s !== "default").length,
    [nodeStatuses],
  );

  const isAllCompleted = answeredCount === nodes.length;
  const currentNode = nodes[currentNodeIndex];
  const currentSnippet = currentNode ? (codeSnippetMap[currentNode.id] ?? "") : "";
  const currentQuestion = currentNode
    ? getQuestionForNode(currentSnippet, currentNode.title, currentNodeIndex)
    : "";

  const handleSubmit = useCallback(
    async (answer: string) => {
      if (!currentNode || isEvaluating) return;

      setIsEvaluating(true);
      setLastFeedback(null);

      try {
        const response = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeId: currentNode.id,
            nodeTitle: currentNode.title,
            codeSnippet: currentSnippet || `// ${currentNode.title}の例`,
            userAnswer: answer,
            experienceLevel: level,
          }),
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const result = (await response.json()) as EvaluateResponse;

        setNodeStatuses((prev) => ({ ...prev, [result.nodeId]: result.status }));
        setLastFeedback({ status: result.status, text: result.feedback });

        setTimeout(() => {
          if (currentNodeIndex < nodes.length - 1) {
            setCurrentNodeIndex((prev) => prev + 1);
            setLastFeedback(null);
          }
        }, 2500);
      } catch (error) {
        console.error("Evaluate API error:", error);
        setNodeStatuses((prev) => ({ ...prev, [currentNode.id]: "red" }));
        setLastFeedback({
          status: "red",
          text: "ごめん、評価中にエラーが出ちゃった。もう一回試してみて。",
        });
      } finally {
        setIsEvaluating(false);
      }
    },
    [currentNode, currentSnippet, currentNodeIndex, isEvaluating, level, nodes.length],
  );

  const percentage = nodes.length > 0 ? (answeredCount / nodes.length) * 100 : 0;

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0B] text-slate-200">
      <StepIndicator currentStep={5} />

      <div className="flex-1 flex overflow-hidden relative">
        {/* 背景 */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
          <div className="absolute right-0 top-0 -z-10 m-auto h-[400px] w-[400px] rounded-full bg-purple-500 opacity-20 blur-[120px]" />
        </div>

        {/* 左: 進捗パネル */}
        <aside className="w-56 flex-shrink-0 bg-white/[0.02] backdrop-blur-md border-r border-white/10 overflow-y-auto relative z-10 flex flex-col">
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">🧑‍💻</span>
              <h2 className="text-xs font-bold text-white">先輩チェック</h2>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>{answeredCount}/{nodes.length}</span>
                <span>{Math.round(percentage)}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
            {nodes.map((node, i) => {
              const st = nodeStatuses[node.id] ?? "default";
              const isCurrent = !isAllCompleted && i === currentNodeIndex;
              return (
                <div
                  key={node.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-all ${
                    isCurrent
                      ? "bg-indigo-500/15 border border-indigo-500/30 text-white font-medium"
                      : st !== "default"
                      ? "text-gray-400"
                      : "text-gray-600"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_CONFIG[st].dot}`} />
                  <span className="truncate flex-1">{node.title}</span>
                  {st !== "default" && (
                    <span className={`text-[8px] font-bold ${
                      st === "green" ? "text-emerald-500" : st === "yellow" ? "text-amber-500" : "text-red-500"
                    }`}>
                      {STATUS_CONFIG[st].label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {isAllCompleted ? (
          <main className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-4 relative z-10">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30 text-3xl">
              🎉
            </div>
            <h2 className="text-2xl font-bold text-white">お疲れ！全部チェックしたよ</h2>
            <p className="text-gray-400 text-sm leading-relaxed max-w-md">
              左のリストが君の理解度マップだ。<br />
              黄色や赤の概念があったら、もう一回コードを見直してみるといいよ。
            </p>
          </main>
        ) : (
          <>
            {/* 中央: チャット */}
            <main className="flex-1 flex flex-col overflow-hidden relative z-10 border-r border-white/10">
              <AnswerPanel
                nodeTitle={currentNode?.title ?? ""}
                codeSnippet={currentSnippet}
                questionText={currentQuestion}
                onSubmit={handleSubmit}
                isEvaluating={isEvaluating}
                feedback={lastFeedback?.text}
                status={lastFeedback?.status}
              />
            </main>

            {/* 右: コードパネル */}
            <aside className="w-[38%] flex-shrink-0 bg-black/40 relative z-10 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="text-xs">📝</span>
                  <h3 className="text-xs font-bold text-gray-300">
                    {currentNode?.title ?? "コード"}
                  </h3>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  このコードを見ながら質問に答えてね
                </p>
              </div>
              <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                {currentSnippet ? (
                  <pre className="text-emerald-300 text-[12px] leading-relaxed font-mono whitespace-pre-wrap">
                    {currentSnippet}
                  </pre>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-600 text-xs">コードスニペットなし</p>
                  </div>
                )}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}

export default function Step5Page() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>}>
      <Step5Content />
    </Suspense>
  );
}
