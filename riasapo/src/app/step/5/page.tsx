"use client";

import { Suspense, useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
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

interface GeneratedFile {
  readonly filename: string;
  readonly code: string;
  readonly description: string;
}

// =============================================================================
// AI質問生成
// =============================================================================

async function fetchQuestion(
  conceptTitle: string,
  code: string,
  experienceLevel: string
): Promise<string> {
  try {
    const res = await fetch('/api/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conceptTitle, code, experienceLevel }),
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data.question ?? '右のコードを見て、この概念について説明してみて。';
  } catch {
    return `右のコードを見て、「${conceptTitle}」に関係する部分を見つけて説明してみて。`;
  }
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
  const [generatedFiles, setGeneratedFiles] = useState<readonly GeneratedFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  useEffect(() => {
    const mappings = loadMappings();
    const map = buildCodeSnippetMap(scenario, mappings);
    setCodeSnippetMap(map);

    // Step 3で生成されたコードを読み込み
    try {
      const raw = sessionStorage.getItem("riasapo-generated-code");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.files && Array.isArray(parsed.files)) {
          setGeneratedFiles(parsed.files);
        }
      }
    } catch {
      // 読み込み失敗は無視
    }
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
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);

  const answeredCount = useMemo(
    () => Object.values(nodeStatuses).filter((s) => s !== "default").length,
    [nodeStatuses],
  );

  const isAllCompleted = answeredCount === nodes.length;
  const currentNode = nodes[currentNodeIndex];
  const currentSnippet = currentNode ? (codeSnippetMap[currentNode.id] ?? "") : "";

  // 概念が変わるたびにAIに質問を生成させる
  useEffect(() => {
    if (!currentNode || isAllCompleted) return;

    const allCode = generatedFiles.map((f) => `// --- ${f.filename} ---\n${f.code}`).join('\n\n');

    setIsLoadingQuestion(true);
    setCurrentQuestion("");

    fetchQuestion(currentNode.title, allCode, level).then((q) => {
      setCurrentQuestion(q);
      setIsLoadingQuestion(false);
    });
  }, [currentNodeIndex, currentNode, generatedFiles, level, isAllCompleted]);

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
                isLoadingQuestion={isLoadingQuestion}
                onSubmit={handleSubmit}
                isEvaluating={isEvaluating}
                feedback={lastFeedback?.text}
                status={lastFeedback?.status}
              />
            </main>

            {/* 右: 生成コードパネル */}
            <aside className="w-[42%] flex-shrink-0 bg-black/40 relative z-10 flex flex-col overflow-hidden">
              {/* ファイルタブ */}
              <div className="flex items-center border-b border-white/10 bg-white/[0.02] overflow-x-auto">
                {generatedFiles.map((file, i) => (
                  <button
                    key={file.filename}
                    type="button"
                    onClick={() => setActiveFileIndex(i)}
                    className={`px-4 py-2.5 text-[11px] font-mono whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                      i === activeFileIndex
                        ? "text-indigo-400 border-indigo-400 bg-white/[0.04]"
                        : "text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/[0.02]"
                    }`}
                  >
                    {file.filename}
                  </button>
                ))}
                {generatedFiles.length === 0 && (
                  <span className="px-4 py-2.5 text-[11px] text-gray-600">コードなし</span>
                )}
              </div>

              {/* コード表示（シンタックスハイライト） */}
              <div className="flex-1 overflow-auto custom-scrollbar">
                {generatedFiles[activeFileIndex] ? (
                  <SyntaxHighlighter
                    language={generatedFiles[activeFileIndex].filename.endsWith('.html') ? 'html' : 'typescript'}
                    style={oneDark}
                    showLineNumbers
                    customStyle={{
                      margin: 0,
                      padding: '16px',
                      background: 'transparent',
                      fontSize: '12px',
                      lineHeight: '1.6',
                    }}
                    lineNumberStyle={{
                      color: '#4a5568',
                      fontSize: '10px',
                      minWidth: '2.5em',
                    }}
                  >
                    {generatedFiles[activeFileIndex].code}
                  </SyntaxHighlighter>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-600 text-xs">Step 3でコードを生成してください</p>
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
