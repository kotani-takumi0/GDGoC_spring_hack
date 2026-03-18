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
// Step 5 — 理解度評価画面
// =============================================================================

/** sessionStorage から取得するマッピングデータの型 */
interface StoredMapping {
  readonly nodeId: string;
  readonly codeSnippet: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly explanation: string;
}

/** ノードごとの評価ステータス */
type NodeStatus = "default" | "green" | "yellow" | "red";

/** API レスポンス */
interface EvaluateResponse {
  readonly nodeId: string;
  readonly status: "green" | "yellow" | "red";
  readonly feedback: string;
}

// -----------------------------------------------------------------------------
// ステータス色定義
// -----------------------------------------------------------------------------
const STATUS_COLORS: Record<NodeStatus, string> = {
  default: "bg-white/5 border-white/10 text-gray-400",
  green: "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]",
  yellow: "bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]",
  red: "bg-red-500/10 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]",
};

const STATUS_DOT_COLORS: Record<NodeStatus, string> = {
  default: "bg-gray-500",
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};

// -----------------------------------------------------------------------------
// ユーティリティ: マッピングデータの取得
// -----------------------------------------------------------------------------
function loadMappings(): readonly StoredMapping[] | null {
  try {
    const raw = sessionStorage.getItem("riasapo-mappings");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { mappings: StoredMapping[] };
    if (Array.isArray(parsed.mappings) && parsed.mappings.length > 0) {
      return parsed.mappings;
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

  // fallback を先にセット
  for (const fb of scenario.fallbackMappings) {
    snippetMap[fb.nodeId] = fb.codeExample;
  }

  // sessionStorage のマッピングがあれば上書き
  if (mappings) {
    for (const m of mappings) {
      snippetMap[m.nodeId] = m.codeSnippet;
    }
  }

  return snippetMap;
}

// -----------------------------------------------------------------------------
// ノードカードリスト（左パネル）
// -----------------------------------------------------------------------------
function NodeCard({
  title,
  status,
  isCurrent,
  index,
}: {
  readonly title: string;
  readonly status: NodeStatus;
  readonly isCurrent: boolean;
  readonly index: number;
}) {
  return (
    <div
      className={[
        "border rounded-xl px-4 py-3 transition-all duration-300 backdrop-blur-sm",
        STATUS_COLORS[status],
        isCurrent ? "ring-1 ring-indigo-500 ring-offset-2 ring-offset-[#0A0A0B] scale-[1.02]" : "scale-100",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <span
          className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_DOT_COLORS[status]}`}
        />
        <span className="text-sm font-semibold">
          {index + 1}. {title}
        </span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 完了メッセージ（右パネル）
// -----------------------------------------------------------------------------
function CompletionMessage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
      <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30">
        <svg
          className="w-10 h-10 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-white tracking-wide">
        お疲れ様でした！
      </h2>
      <p className="text-gray-400 text-sm leading-relaxed max-w-md">
        あなたの理解度マップが完成しました。
        <br />
        左のノードリストが、自分の理解状態の地図として表示されています。
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// プログレスバー
// -----------------------------------------------------------------------------
function ProgressBar({
  answered,
  total,
}: {
  readonly answered: number;
  readonly total: number;
}) {
  const percentage = total > 0 ? (answered / total) * 100 : 0;

  return (
    <div className="bg-[#0A0A0B]/80 backdrop-blur-xl border-t border-white/10 px-6 py-4 relative z-20">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-300 font-bold tracking-wide">
            {total}問中{answered}問回答済み
          </span>
          <span className="text-sm text-indigo-300 font-bold">
            {Math.round(percentage)}%
          </span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden border border-white/5">
          <div
            className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(139,92,246,0.6)]"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Step 5 メインページ
// -----------------------------------------------------------------------------
function Step5Content() {
  const searchParams = useSearchParams();
  const level = (searchParams.get("level") ?? "complete-beginner") as ExperienceLevel;
  const useLocalLLM = searchParams.get("useLocalLLM") === "true";

  const scenario = scenarioData as unknown as ScenarioDefinition;
  const nodes = scenario.nodes.filter((n) => n.nodeType !== "feature" && n.nodeType !== "app");

  // マッピングデータ（sessionStorage から読み込み）
  const [codeSnippetMap, setCodeSnippetMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const mappings = loadMappings();
    const map = buildCodeSnippetMap(scenario, mappings);
    setCodeSnippetMap(map);
  }, [scenario]);

  // 状態管理
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>(
    () => {
      const initial: Record<string, NodeStatus> = {};
      for (const node of nodes) {
        initial[node.id] = "default";
      }
      return initial;
    },
  );
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastEvaluatedIndex, setLastEvaluatedIndex] = useState<number | null>(null);

  // 回答済みノード数
  const answeredCount = useMemo(
    () => Object.values(nodeStatuses).filter((s) => s !== "default").length,
    [nodeStatuses],
  );

  const isAllCompleted = answeredCount === nodes.length;

  // 現在のノード
  const currentNode = nodes[currentNodeIndex];
  const currentSnippet = currentNode ? (codeSnippetMap[currentNode.id] ?? "") : "";

  // 回答送信ハンドラ
  const handleSubmit = useCallback(
    async (answer: string) => {
      if (!currentNode || isEvaluating) return;

      setIsEvaluating(true);

      try {
        const response = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeId: currentNode.id,
            nodeTitle: currentNode.title,
            codeSnippet: currentSnippet,
            userAnswer: answer,
            experienceLevel: level,
            useLocalLLM,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const result = (await response.json()) as EvaluateResponse;

        // 結果を反映（不変更新）
        setNodeStatuses((prev) => ({
          ...prev,
          [result.nodeId]: result.status,
        }));
        setFeedbacks((prev) => ({
          ...prev,
          [result.nodeId]: result.feedback,
        }));
        setLastEvaluatedIndex(currentNodeIndex);

        // 少し間を置いてから次のノードへ
        setTimeout(() => {
          if (currentNodeIndex < nodes.length - 1) {
            setCurrentNodeIndex((prev) => prev + 1);
            setLastEvaluatedIndex(null);
          }
        }, 2000);
      } catch (error) {
        console.error("Evaluate API error:", error);
        // エラー時はred扱いにしてフィードバック表示
        setNodeStatuses((prev) => ({
          ...prev,
          [currentNode.id]: "red",
        }));
        setFeedbacks((prev) => ({
          ...prev,
          [currentNode.id]: "評価中にエラーが発生しました。もう一度お試しください。",
        }));
        setLastEvaluatedIndex(currentNodeIndex);
      } finally {
        setIsEvaluating(false);
      }
    },
    [currentNode, currentSnippet, currentNodeIndex, isEvaluating, level, nodes.length, useLocalLLM],
  );

  // 直前に評価したノードのフィードバックを表示
  const showFeedbackFor =
    lastEvaluatedIndex !== null ? nodes[lastEvaluatedIndex] : null;
  const feedbackStatus = showFeedbackFor
    ? (nodeStatuses[showFeedbackFor.id] as "green" | "yellow" | "red" | undefined)
    : undefined;
  const feedbackText = showFeedbackFor
    ? feedbacks[showFeedbackFor.id]
    : undefined;

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0B] text-slate-200">
      <StepIndicator currentStep={5} />

      {/* メインコンテンツ */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 背景のグラデーション */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
          <div className="absolute right-0 top-0 -z-10 m-auto h-[400px] w-[400px] rounded-full bg-purple-500 opacity-20 blur-[120px]" />
        </div>

        {/* 左パネル: ノードカードリスト */}
        <aside className="w-80 flex-shrink-0 bg-white/[0.02] backdrop-blur-md border-r border-white/10 overflow-y-auto p-5 relative z-10 custom-scrollbar">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
            理解度マップ
          </h2>
          <div className="flex flex-col gap-2">
            {nodes.map((node, index) => (
              <NodeCard
                key={node.id}
                title={node.title}
                status={nodeStatuses[node.id] ?? "default"}
                isCurrent={!isAllCompleted && index === currentNodeIndex}
                index={index}
              />
            ))}
          </div>
        </aside>

        {/* 右パネル: 回答エリア */}
        <main className="flex-1 overflow-y-auto p-6 relative z-10 custom-scrollbar">
          <div className="max-w-3xl mx-auto mt-4">
            {isAllCompleted ? (
              <CompletionMessage />
            ) : (
              <AnswerPanel
                nodeTitle={currentNode?.title ?? ""}
                codeSnippet={currentSnippet}
                onSubmit={handleSubmit}
                isEvaluating={isEvaluating}
                feedback={
                  feedbackStatus !== undefined && feedbackStatus !== "default" as string
                    ? feedbackText
                    : undefined
                }
                status={
                  feedbackStatus !== undefined && feedbackStatus !== "default" as string
                    ? (feedbackStatus as "green" | "yellow" | "red")
                    : undefined
                }
              />
            )}
          </div>
        </main>
      </div>

      {/* プログレスバー */}
      <ProgressBar answered={answeredCount} total={nodes.length} />
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
