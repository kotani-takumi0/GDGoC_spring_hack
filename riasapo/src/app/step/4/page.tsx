"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StepIndicator from "@/components/StepIndicator";
import CodePanel from "@/components/CodePanel";
import RoadmapGraph from "@/components/RoadmapGraph";
import PreviewSandbox from "@/components/PreviewSandbox";
import CodeExecutionPanel from "@/components/CodeExecutionPanel";
import { useSessionSync } from "@/components/SessionSyncProvider";
import type { HighlightRange } from "@/components/CodePanel";
import type { ConceptNodeData, ConceptEdge, ScenarioDefinition } from "@/types";

// =============================================================================
// Step 4 - 概念 <-> コード マッピング表示
// =============================================================================

// -----------------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------------

interface MappingItem {
  readonly nodeId: string;
  readonly codeSnippet: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly explanation: string;
}

interface StoredFile {
  readonly filename: string;
  readonly code: string;
  readonly description: string;
}

interface StoredCode {
  readonly files: readonly StoredFile[];
  readonly language: string;
  readonly explanation: string;
}

// ノードごとのカラーパレット（最大10色）
const NODE_COLORS = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
  "#14B8A6", // teal
  "#6366F1", // indigo
] as const;

// -----------------------------------------------------------------------------
// ヘルパー関数
// -----------------------------------------------------------------------------

/**
 * ノードIDにカラーを割り当てる。
 */
function getNodeColor(nodeId: string, allNodeIds: readonly string[]): string {
  const index = allNodeIds.indexOf(nodeId);
  return NODE_COLORS[index % NODE_COLORS.length];
}

/**
 * sessionStorage から生成済みコードを取得する。
 */
function loadStoredCode(): StoredCode | null {
  try {
    const raw = sessionStorage.getItem("riasapo-generated-code");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // 複数ファイル形式
    if (parsed.files && Array.isArray(parsed.files)) {
      return parsed as StoredCode;
    }
    // 旧形式（単一ファイル）の互換
    if (parsed.code) {
      return {
        files: [{ filename: parsed.filename ?? "main.ts", code: parsed.code, description: "" }],
        language: parsed.language ?? "typescript",
        explanation: "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * sessionStorage からシナリオデータを取得する（Step 2で保存されている場合）。
 */
function loadStoredScenario(): ScenarioDefinition | null {
  try {
    const raw = sessionStorage.getItem("riasapo-scenario");
    if (!raw) return null;
    return JSON.parse(raw) as ScenarioDefinition;
  } catch {
    return null;
  }
}

/**
 * マッピングデータを sessionStorage に保存する（Step 5で使用）。
 */
function saveMappingsToStorage(mappings: readonly MappingItem[]): void {
  try {
    sessionStorage.setItem("riasapo-mappings", JSON.stringify(mappings));
  } catch {
    // sessionStorage が使えない環境では何もしない
  }
}

/**
 * HEXカラーをRGBAに変換する。
 */
function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getNodeKindLabel(nodeType?: ConceptNodeData["nodeType"]): string {
  if (nodeType === "app") return "App";
  if (nodeType === "feature") return "Feature";
  return "Concept";
}

function getNodeKindColor(nodeType?: ConceptNodeData["nodeType"]): string {
  if (nodeType === "app") return "#10B981";
  if (nodeType === "feature") return "#6366F1";
  return "#D946EF";
}

// -----------------------------------------------------------------------------
// ローディング / エラー表示
// -----------------------------------------------------------------------------

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#0A0A0B]">
      <div className="text-center space-y-4">
        <div className="inline-block w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-gray-400 text-sm font-medium">
          コードと概念のマッピングを分析中...
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { readonly message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#0A0A0B]">
      <div className="text-center space-y-3 max-w-md px-4">
        <p className="text-red-400 font-bold">エラーが発生しました</p>
        <p className="text-gray-400 text-sm">{message}</p>
      </div>
    </div>
  );
}

function SelectedNodeSummary({
  node,
  relatedNodes,
  mapping,
}: {
  readonly node: ConceptNodeData;
  readonly relatedNodes: readonly ConceptNodeData[];
  readonly mapping: MappingItem | null;
}) {
  const nodeKind = getNodeKindLabel(node.nodeType);
  const accent = getNodeKindColor(node.nodeType);
  const relationLabel =
    node.nodeType === "app"
      ? "含まれている機能"
      : node.nodeType === "feature"
        ? "この機能で使う Concepts"
        : "この Concept が使われている場所";
  const emptyMessage =
    node.nodeType === "app"
      ? "このアプリに紐づく機能ノードはまだありません。"
      : node.nodeType === "feature"
        ? "この機能に紐づく Concept ノードはまだありません。"
        : "この Concept を使う機能ノードはまだありません。";

  return (
    <div className="mx-5 mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{
              color: accent,
              borderColor: hexToRgba(accent, 0.35),
              backgroundColor: hexToRgba(accent, 0.12),
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: accent }}
            />
            {nodeKind}
          </div>
          <h3 className="mt-3 text-sm font-bold text-white">{node.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {node.subtitle}
          </p>
        </div>
        <div
          className="shrink-0 rounded-xl border px-3 py-2 text-right"
          style={{
            borderColor: hexToRgba(accent, 0.25),
            backgroundColor: hexToRgba(accent, 0.08),
          }}
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Related
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {relatedNodes.length}
          </p>
        </div>
      </div>

      {mapping?.explanation && (
        <div className="mt-4 rounded-xl border border-white/8 bg-black/25 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            コード内での役割
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            {mapping.explanation}
          </p>
        </div>
      )}

      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          {relationLabel}
        </p>
        {relatedNodes.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {relatedNodes.map((relatedNode) => {
              const relatedAccent = getNodeKindColor(relatedNode.nodeType);
              return (
                <span
                  key={relatedNode.id}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium text-slate-200"
                  style={{
                    borderColor: hexToRgba(relatedAccent, 0.3),
                    backgroundColor: hexToRgba(relatedAccent, 0.12),
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: relatedAccent }}
                  />
                  {relatedNode.title}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {emptyMessage}
          </p>
        )}
      </div>

      {/* Code Execution: conceptノードのみ表示 */}
      {node.nodeType !== 'app' && node.nodeType !== 'feature' && mapping?.codeSnippet && (
        <div className="mt-4 border-t border-white/5 pt-3">
          <CodeExecutionPanel
            conceptTitle={node.title}
            codeSnippet={mapping.codeSnippet}
            explanation={mapping.explanation ?? node.subtitle}
          />
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// メインページコンポーネント
// -----------------------------------------------------------------------------

function Step4Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { saveToSession } = useSessionSync();

  const scenarioId = searchParams.get("scenario") ?? "";
  const level = searchParams.get("level") ?? "";
  const mode = searchParams.get("mode") ?? "demo";

  // 状態
  const [storedCode, setStoredCode] = useState<StoredCode | null>(null);
  const [nodes, setNodes] = useState<readonly ConceptNodeData[]>([]);
  const [allNodes, setAllNodes] = useState<readonly ConceptNodeData[]>([]);
  const [allEdges, setAllEdges] = useState<readonly ConceptEdge[]>([]);
  const [mappings, setMappings] = useState<readonly MappingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  // ノードIDリストとカラーマップ
  const nodeIds = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const nodeColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const id of nodeIds) {
      map.set(id, getNodeColor(id, nodeIds));
    }
    return map;
  }, [nodeIds]);

  const allNodeMap = useMemo(
    () => new Map(allNodes.map((node) => [node.id, node])),
    [allNodes]
  );

  // ハイライト範囲の計算（概念名ラベル付き）
  const highlightRanges = useMemo<readonly HighlightRange[]>(() => {
    return mappings
      .filter((m) => m.startLine > 0 && m.endLine > 0)
      .map((m) => ({
        nodeId: m.nodeId,
        startLine: m.startLine,
        endLine: m.endLine,
        color: nodeColors.get(m.nodeId) ?? "#3B82F6",
        label: nodes.find((n) => n.id === m.nodeId)?.title ?? m.nodeId,
      }));
  }, [mappings, nodeColors, nodes]);

  // ホバー中またはアクティブなハイライト範囲
  const activeHighlightRange = useMemo<HighlightRange | undefined>(() => {
    const targetId = activeNodeId ?? hoveredNodeId;
    if (!targetId) return undefined;
    return highlightRanges.find((r) => r.nodeId === targetId);
  }, [activeNodeId, hoveredNodeId, highlightRanges]);

  const selectedGraphNode = useMemo(() => {
    if (!activeNodeId) return null;
    return allNodeMap.get(activeNodeId) ?? null;
  }, [activeNodeId, allNodeMap]);

  const selectedNodeMapping = useMemo(() => {
    if (!selectedGraphNode) return null;
    return mappings.find((mapping) => mapping.nodeId === selectedGraphNode.id) ?? null;
  }, [mappings, selectedGraphNode]);

  const selectedRelatedNodes = useMemo<readonly ConceptNodeData[]>(() => {
    if (!selectedGraphNode) return [];

    const relatedIds =
      selectedGraphNode.nodeType === "app" || selectedGraphNode.nodeType === "feature"
        ? allEdges
          .filter((edge) => edge.source === selectedGraphNode.id)
          .map((edge) => edge.target)
        : allEdges
          .filter((edge) => edge.target === selectedGraphNode.id)
          .map((edge) => edge.source);

    return Array.from(new Set(relatedIds))
      .map((id) => allNodeMap.get(id))
      .filter((node): node is ConceptNodeData => node !== undefined);
  }, [allEdges, allNodeMap, selectedGraphNode]);

  // 初期化: sessionStorage からデータ読み込み + API呼び出し
  useEffect(() => {
    async function init() {
      // コード取得
      const code = loadStoredCode();
      if (!code) {
        setError("生成されたコードが見つかりません。Step 3からやり直してください。");
        setIsLoading(false);
        return;
      }
      setStoredCode(code);

      // シナリオからノードデータを構築
      const scenario = loadStoredScenario();
      let nodeList: ConceptNodeData[];

      // ロードマップ用: 全ノード+エッジを取得
      function loadAllFromScenario(s: ScenarioDefinition) {
        setAllNodes(s.nodes.map((n) => ({
          id: n.id,
          title: n.title,
          subtitle: n.defaultSubtitle,
          status: "default" as const,
          nodeType: n.nodeType,
        })));
        setAllEdges(s.edges);
      }

      if (scenario) {
        loadAllFromScenario(scenario);
        nodeList = scenario.nodes
          .filter((n) => n.nodeType !== "feature" && n.nodeType !== "app")
          .map((n) => ({
            id: n.id,
            title: n.title,
            subtitle: n.defaultSubtitle,
            status: "default" as const,
          }));
      } else {
        // シナリオが sessionStorage にない場合、JSON から直接取得を試みる
        try {
          const mod = await import(`@/data/scenarios/${scenarioId}.json`);
          const scenarioData = mod.default as ScenarioDefinition;
          loadAllFromScenario(scenarioData);
          nodeList = scenarioData.nodes
            .filter((n) => n.nodeType !== "feature" && n.nodeType !== "app")
            .map((n) => ({
              id: n.id,
              title: n.title,
              subtitle: n.defaultSubtitle,
              status: "default" as const,
            }));
        } catch {
          setError(
            `シナリオ「${scenarioId}」のデータを読み込めません。Step 1からやり直してください。`
          );
          setIsLoading(false);
          return;
        }
      }

      setNodes(nodeList);

      // マッピングAPI呼び出し
      try {
        const response = await fetch("/api/mapping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarioId,
            code: code.files.map((f) => `// === ${f.filename} ===\n${f.code}`).join("\n\n"),
            nodes: nodeList.map((n) => ({ id: n.id, title: n.title })),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage =
            errorData && typeof errorData === "object" && "error" in errorData
              ? String(errorData.error)
              : `APIエラー (${response.status})`;
          setError(errorMessage);
          setIsLoading(false);
          return;
        }

        const data = (await response.json()) as { mappings: MappingItem[] };
        setMappings(data.mappings);
        saveMappingsToStorage(data.mappings);
        saveToSession("riasapo-mappings", data.mappings);
      } catch (e) {
        setError(
          e instanceof Error
            ? `マッピング取得に失敗しました: ${e.message}`
            : "マッピング取得に失敗しました"
        );
      }

      setIsLoading(false);
    }

    init();
  }, [scenarioId]);

  // ノードクリックハンドラ
  const handleNodeClick = useCallback((nodeId: string) => {
    setActiveNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  // ノードホバーハンドラ
  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);
  }, []);

  // 次のステップへ遷移
  const handleNext = useCallback(() => {
    router.push(`/step/5?scenario=${scenarioId}&level=${level}&mode=${mode}`);
  }, [router, scenarioId, level, mode]);

  // ローディング中
  if (isLoading) {
    return (
      <>
        <StepIndicator currentStep={4} />
        <LoadingState />
      </>
    );
  }

  // エラー
  if (error) {
    return (
      <>
        <StepIndicator currentStep={4} />
        <ErrorState message={error} />
      </>
    );
  }

  return (
    <>
      <StepIndicator currentStep={4} />

      {/* メインコンテンツ: 左右2パネル */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0A0A0B]">
        <div className="flex-1 flex min-h-0 relative">
          {/* 左パネル: ロードマップグラフ (40%) */}
          <div className="w-2/5 border-r border-white/5 overflow-hidden flex flex-col relative z-10">
            <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02] flex-shrink-0">
              <h2 className="text-sm font-bold text-white tracking-wide">
                概念ロードマップ
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                ノードをクリック → 対応するコードをハイライト
              </p>
            </div>
            {selectedGraphNode && (
              <SelectedNodeSummary
                node={selectedGraphNode}
                relatedNodes={selectedRelatedNodes}
                mapping={selectedNodeMapping}
              />
            )}
            <div className="flex-1 min-h-0">
              <RoadmapGraph
                nodes={allNodes}
                edges={allEdges}
                selectedNodeId={activeNodeId}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
              />
            </div>
          </div>

          {/* 右パネル: プレビュー & コード (60%) */}
          <div className="w-3/5 overflow-hidden flex flex-col bg-black/40 relative z-10">
            {/* 上半分: プレビュー (40%) */}
            <div className="h-2/5 flex flex-col border-b border-white/10 relative overflow-hidden bg-[#0A0A0B]">
              <PreviewSandbox files={storedCode?.files ?? []} />
            </div>

            {/* 下半分: コード (60%) */}
            <div className="h-3/5 flex flex-col overflow-hidden relative">
              {/* ファイルタブ */}
              <div className="flex items-center border-b border-white/5 bg-white/[0.02] z-10 overflow-x-auto">
                {(storedCode?.files ?? []).map((file, i) => (
                  <button
                    key={file.filename}
                    type="button"
                    onClick={() => setActiveFileIndex(i)}
                    className={`px-4 py-3 text-xs font-mono whitespace-nowrap border-b-2 transition-colors cursor-pointer ${i === activeFileIndex
                      ? "border-indigo-500 text-white bg-white/[0.04]"
                      : "border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]"
                      }`}
                  >
                    {file.filename}
                  </button>
                ))}
                {activeNodeId && (
                  <div className="ml-auto flex items-center gap-2 px-4">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          nodeColors.get(activeNodeId) ??
                          getNodeKindColor(selectedGraphNode?.nodeType),
                      }}
                    />
                    <span className="text-xs text-gray-500">
                      {selectedGraphNode?.title ?? activeNodeId}
                    </span>
                  </div>
                )}
              </div>
              {/* ファイル説明 */}
              {(storedCode?.files ?? [])[activeFileIndex]?.description && (
                <div className="px-4 py-2 border-b border-white/5 bg-white/[0.01]">
                  <p className="text-xs text-gray-500">
                    {(storedCode?.files ?? [])[activeFileIndex]?.description}
                  </p>
                </div>
              )}
              {/* コードエディタ本体 */}
              <div className="flex-1 overflow-hidden">
                <CodePanel
                  code={(storedCode?.files ?? [])[activeFileIndex]?.code ?? ""}
                  language={(() => {
                    const fn = (storedCode?.files ?? [])[activeFileIndex]?.filename ?? "";
                    if (fn.endsWith(".html")) return "markup";
                    if (fn.endsWith(".css")) return "css";
                    if (fn.endsWith(".js")) return "javascript";
                    return "typescript";
                  })()}
                  highlightRanges={[...highlightRanges]}
                  activeRange={activeHighlightRange}
                />
              </div>
            </div>
          </div>
        </div>

        {/* フッター: 次へボタン */}
        <div className="border-t border-white/5 bg-[#0A0A0B] px-6 py-5 flex justify-center relative z-20">
          <button
            type="button"
            onClick={handleNext}
            className="px-10 py-3.5 rounded-xl text-lg font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:scale-[1.02] cursor-pointer transition-all duration-300"
          >
            理解度チェックに進む
          </button>
        </div>
      </main>
    </>
  );
}

export default function Step4Page() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>}>
      <Step4Content />
    </Suspense>
  );
}
