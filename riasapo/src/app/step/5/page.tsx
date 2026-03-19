"use client";

import { Suspense, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import StepIndicator from "@/components/StepIndicator";
import AnswerPanel from "@/components/AnswerPanel";
import { useAuth } from "@/components/AuthProvider";
import scenarioData from "@/data/scenarios/todo-app.json";
import { DEMO_QUESTIONS, DEMO_CONVERSATIONS } from "@/data/demo-questions";
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

interface GeneratedFile {
  readonly filename: string;
  readonly code: string;
  readonly description: string;
}

interface PreparedQuestion {
  readonly conceptId: string;
  readonly question: string;
  readonly modelAnswer: string;
}

// =============================================================================
// ユーティリティ
// =============================================================================

function extractCodeReferences(question: string): readonly string[] {
  const matches = question.match(/`([^`]+)`/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1)).filter((s) => s.length > 3);
}

function findHighlightLines(code: string, snippets: readonly string[]): Set<number> {
  const lines = code.split('\n');
  const result = new Set<number>();
  for (const snippet of snippets) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(snippet)) result.add(i + 1);
    }
  }
  return result;
}

async function fetchAllQuestions(
  concepts: readonly { id: string; title: string }[],
  code: string,
  experienceLevel: string
): Promise<readonly PreparedQuestion[]> {
  try {
    const res = await fetch('/api/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concepts, code, experienceLevel }),
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data.questions ?? [];
  } catch {
    return concepts.map((c) => ({
      conceptId: c.id,
      question: `右のコードを見て、「${c.title}」に関係する部分を見つけて説明してみて。`,
      modelAnswer: '',
    }));
  }
}

function loadMappings(): readonly StoredMapping[] | null {
  try {
    const raw = sessionStorage.getItem("riasapo-mappings");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.mappings && Array.isArray(parsed.mappings) && parsed.mappings.length > 0) return parsed.mappings;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as StoredMapping[];
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
  for (const fb of scenario.fallbackMappings) snippetMap[fb.nodeId] = fb.codeExample;
  if (mappings) for (const m of mappings) snippetMap[m.nodeId] = m.codeSnippet;
  return snippetMap;
}

// =============================================================================
// ステータス設定
// =============================================================================

type NodeStatus = "default" | "discussed";

const STATUS_CONFIG: Record<NodeStatus, { dot: string; label: string }> = {
  default: { dot: "bg-gray-600", label: "" },
  discussed: { dot: "bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]", label: "対話済み" },
};

// =============================================================================
// メインページ
// =============================================================================

function Step5Content() {
  const searchParams = useSearchParams();
  const { state: authState } = useAuth();
  const level = (searchParams.get("level") ?? "complete-beginner") as ExperienceLevel;
  const mode = searchParams.get("mode") ?? "demo";

  const scenario = scenarioData as unknown as ScenarioDefinition;
  const nodes = scenario.nodes.filter((n) => n.nodeType !== "feature" && n.nodeType !== "app");

  const [codeSnippetMap, setCodeSnippetMap] = useState<Record<string, string>>({});
  const [generatedFiles, setGeneratedFiles] = useState<readonly GeneratedFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  useEffect(() => {
    const mappings = loadMappings();
    setCodeSnippetMap(buildCodeSnippetMap(scenario, mappings));
    try {
      const raw = sessionStorage.getItem("riasapo-generated-code");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.files && Array.isArray(parsed.files)) setGeneratedFiles(parsed.files);
      }
    } catch { /* ignore */ }
  }, [scenario]);

  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>(() => {
    const initial: Record<string, NodeStatus> = {};
    for (const node of nodes) initial[node.id] = "default";
    return initial;
  });
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [viewingNodeIndex, setViewingNodeIndex] = useState<number | null>(null);
  const [isChatting, setIsChatting] = useState(false);
  const [preparedQuestions, setPreparedQuestions] = useState<readonly PreparedQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [highlightLines, setHighlightLines] = useState<Set<number>>(new Set());

  // 会話履歴（chat API用）
  const chatHistoryRef = useRef<Map<string, { role: 'senpai' | 'user'; text: string }[]>>(new Map());

  const discussedCount = useMemo(
    () => Object.values(nodeStatuses).filter((s) => s !== "default").length,
    [nodeStatuses],
  );

  const isAllCompleted = discussedCount === nodes.length;
  const isViewingPast = viewingNodeIndex !== null && viewingNodeIndex !== currentNodeIndex;
  const displayNodeIndex = viewingNodeIndex ?? currentNodeIndex;
  const currentNode = nodes[currentNodeIndex];
  const displayNode = nodes[displayNodeIndex];

  // 質問生成
  const generatedConceptsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentNode || isAllCompleted) return;
    if (generatedConceptsRef.current.has(currentNode.id)) return;
    generatedConceptsRef.current.add(currentNode.id);

    if (mode === "demo") {
      const demoQ = DEMO_QUESTIONS.find((q) => q.conceptId === currentNode.id);
      if (demoQ) {
        setPreparedQuestions((prev) => [...prev, {
          conceptId: demoQ.conceptId,
          question: demoQ.question,
          modelAnswer: demoQ.modelAnswer,
        }]);
      }
      return;
    }

    if (generatedFiles.length === 0) return;
    const allCode = generatedFiles.map((f) => `// --- ${f.filename} ---\n${f.code}`).join('\n\n');
    setIsLoadingQuestions(true);
    fetchAllQuestions([{ id: currentNode.id, title: currentNode.title }], allCode, level).then((qs) => {
      if (qs.length > 0) setPreparedQuestions((prev) => [...prev, ...qs]);
      setIsLoadingQuestions(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeIndex, currentNode, generatedFiles, level, isAllCompleted]);

  const displayPrepared = displayNode
    ? preparedQuestions.find((q) => q.conceptId === displayNode.id)
    : null;
  const currentQuestion = displayPrepared?.question ?? "";

  // ハイライト更新
  useEffect(() => {
    if (!currentQuestion || generatedFiles.length === 0) {
      setHighlightLines(new Set());
      return;
    }
    const refs = extractCodeReferences(currentQuestion);
    for (let fi = 0; fi < generatedFiles.length; fi++) {
      const lines = findHighlightLines(generatedFiles[fi].code, refs);
      if (lines.size > 0) {
        setActiveFileIndex(fi);
        setHighlightLines(lines);
        return;
      }
    }
    setHighlightLines(new Set());
  }, [currentQuestion, generatedFiles]);

  // 対話送信ハンドラ
  const handleSendMessage = useCallback(
    async (userMessage: string): Promise<string> => {
      if (!displayNode) return "エラーが発生しました";

      setIsChatting(true);

      // 会話履歴を更新
      const nodeId = displayNode.id;
      const history = chatHistoryRef.current.get(nodeId) ?? [];
      history.push({ role: 'user', text: userMessage });

      const allCode = generatedFiles.map((f) => `// --- ${f.filename} ---\n${f.code}`).join('\n\n');

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conceptTitle: displayNode.title,
            code: allCode,
            experienceLevel: level,
            history,
            userMessage,
          }),
        });

        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        const reply = data.reply ?? "うーん、ちょっと考えさせて...";

        history.push({ role: 'senpai', text: reply });
        chatHistoryRef.current.set(nodeId, history);

        return reply;
      } catch {
        return "ごめん、通信エラーが出ちゃった。もう一回話しかけてみて。";
      } finally {
        setIsChatting(false);
      }
    },
    [displayNode, generatedFiles, level],
  );

  // 次の概念へ
  const handleNext = useCallback(() => {
    if (currentNode) {
      setNodeStatuses((prev) => ({ ...prev, [currentNode.id]: "discussed" }));
    }
    if (currentNodeIndex < nodes.length - 1) {
      setCurrentNodeIndex((prev) => prev + 1);
      setViewingNodeIndex(null);
    } else {
      // 最後の概念 → 全完了
      setNodeStatuses((prev) => ({ ...prev, [currentNode.id]: "discussed" }));
    }
  }, [currentNode, currentNodeIndex, nodes.length]);

  // ドキュメント生成
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  const handleGenerateDoc = useCallback(async () => {
    setIsGeneratingDoc(true);
    setDocError(null);

    // デモモード: 事前定義の対話データを使用
    // AIモード: 実際の対話履歴を使用
    const conversations = mode === "demo"
      ? DEMO_CONVERSATIONS.map((c) => ({ conceptTitle: c.conceptTitle, messages: [...c.messages] }))
      : nodes.map((node) => ({
          conceptTitle: node.title,
          messages: chatHistoryRef.current.get(node.id) ?? [],
        })).filter((c) => c.messages.length > 0);

    const allCode = generatedFiles.map((f) => `// --- ${f.filename} ---\n${f.code}`).join('\n\n');

    try {
      const res = await fetch('/api/generate-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioTitle: scenario.title,
          experienceLevel: level,
          conversations,
          code: allCode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'ドキュメント生成に失敗しました');
      }

      const data = await res.json();
      setDocUrl(data.docUrl);
    } catch (e) {
      setDocError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setIsGeneratingDoc(false);
    }
  }, [nodes, generatedFiles, scenario.title, level]);

  const percentage = nodes.length > 0 ? (discussedCount / nodes.length) * 100 : 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#0A0A0B] text-slate-200">
      <StepIndicator currentStep={5} />

      <div className="flex-1 min-h-0 flex overflow-hidden relative">
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
              <h2 className="text-xs font-bold text-white">先輩と対話</h2>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              各概念について先輩と対話しよう。<br />
              納得できたら「次へ」で進もう。
            </p>
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>{discussedCount}/{nodes.length}</span>
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
              const isViewing = i === displayNodeIndex;
              const canClick = st !== "default";
              return (
                <div
                  key={node.id}
                  onClick={() => canClick ? setViewingNodeIndex(i) : undefined}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-all ${
                    canClick ? "cursor-pointer hover:bg-white/[0.05]" : ""
                  } ${
                    isViewing
                      ? "bg-indigo-500/15 border border-indigo-500/30 text-white font-medium"
                      : isCurrent
                      ? "bg-indigo-500/10 border border-indigo-500/20 text-white"
                      : st !== "default"
                      ? "text-gray-400"
                      : "text-gray-600"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_CONFIG[st].dot}`} />
                  <span className="truncate flex-1">{node.title}</span>
                  {st !== "default" && (
                    <span className="text-[8px] font-bold text-indigo-400">{STATUS_CONFIG[st].label}</span>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {isAllCompleted ? (
          <main className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-4 relative z-10">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30 text-3xl">
              🎉
            </div>
            <h2 className="text-2xl font-bold text-white">お疲れ！全部話せたね</h2>
            <p className="text-gray-400 text-sm leading-relaxed max-w-md">
              全ての概念について対話が完了しました。<br />
              左のリストをクリックすると、過去の対話を振り返れるよ。
            </p>

            {/* ドキュメント生成 */}
            <div className="mt-4 w-full max-w-md">
              {docUrl ? (
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold text-sm hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all text-center"
                >
                  📄 Google Docsで学習ノートを開く
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateDoc}
                  disabled={isGeneratingDoc}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isGeneratingDoc ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      あなた専用の学習ノートを作成中...
                    </span>
                  ) : (
                    "📝 対話内容から学習ノートを生成する"
                  )}
                </button>
              )}
              {docError && (
                <p className="mt-2 text-xs text-red-400">{docError}</p>
              )}
              <p className="mt-2 text-[11px] text-gray-500">
                対話の内容をもとに、あなた専用の技術ドキュメントをGoogle Docsに生成します
              </p>
            </div>
          </main>
        ) : (
          <>
            {/* 中央: チャット */}
            <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative z-10 border-r border-white/10">
              <AnswerPanel
                nodeTitle={displayNode?.title ?? ""}
                questionText={currentQuestion}
                isLoadingQuestion={!isViewingPast && (isLoadingQuestions || (!currentQuestion && !isAllCompleted))}
                readOnly={isViewingPast}
                onSendMessage={handleSendMessage}
                onNext={handleNext}
                onBack={() => setViewingNodeIndex(null)}
                isLast={currentNodeIndex === nodes.length - 1}
                isChatting={isChatting}
              />
            </main>

            {/* 右: コードパネル */}
            <aside className="w-[42%] flex-shrink-0 bg-black/40 relative z-10 flex flex-col overflow-hidden">
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

              <div className="flex-1 overflow-auto custom-scrollbar">
                {generatedFiles[activeFileIndex] ? (
                  <SyntaxHighlighter
                    language={generatedFiles[activeFileIndex].filename.endsWith('.html') ? 'html' : 'typescript'}
                    style={oneDark}
                    showLineNumbers
                    wrapLines
                    lineProps={(lineNumber: number) => {
                      const isHighlighted = highlightLines.has(lineNumber);
                      return {
                        style: {
                          backgroundColor: isHighlighted ? 'rgba(99, 102, 241, 0.15)' : undefined,
                          borderLeft: isHighlighted ? '3px solid #6366f1' : '3px solid transparent',
                          display: 'block',
                          paddingLeft: isHighlighted ? '8px' : '11px',
                        },
                      };
                    }}
                    customStyle={{ margin: 0, padding: '16px 0', background: 'transparent', fontSize: '12px', lineHeight: '1.6' }}
                    lineNumberStyle={{ color: '#4a5568', fontSize: '10px', minWidth: '2.5em' }}
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
