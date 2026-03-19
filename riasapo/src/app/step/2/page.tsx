"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Layers, BookOpen, Fingerprint, ChevronRight } from "lucide-react";
import ConceptQA from "@/components/ConceptQA";
import StumbleWarning from "@/components/StumbleWarning";

import StepIndicator from "@/components/StepIndicator";
import RoadmapGraph from "@/components/RoadmapGraph";
import type {
  ScenarioDefinition,
  ConceptNodeData,
  ConceptNodeDefinition,
  ConceptEdge,
} from "@/types";

import todoAppScenario from "@/data/scenarios/todo-app.json";

const SCENARIO_MAP: Record<string, ScenarioDefinition> = {
  "todo-app": todoAppScenario as ScenarioDefinition,
};

// =============================================================================
// パーソナライズAPI
// =============================================================================

interface PersonalizedNode {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
}

interface PersonalizeResponse {
  readonly nodes: readonly PersonalizedNode[];
}

// =============================================================================
// 依存関係ヘルパー
// =============================================================================

function getPrerequisites(
  nodeId: string,
  edges: readonly ConceptEdge[],
  allNodes: readonly ConceptNodeDefinition[]
): readonly ConceptNodeDefinition[] {
  return edges
    .filter((e) => e.source === nodeId)
    .map((e) => allNodes.find((n) => n.id === e.target))
    .filter((n): n is ConceptNodeDefinition => n !== undefined);
}

function getDependents(
  nodeId: string,
  edges: readonly ConceptEdge[],
  allNodes: readonly ConceptNodeDefinition[]
): readonly ConceptNodeDefinition[] {
  return edges
    .filter((e) => e.target === nodeId)
    .map((e) => allNodes.find((n) => n.id === e.source))
    .filter((n): n is ConceptNodeDefinition => n !== undefined);
}

// =============================================================================
// 凡例
// =============================================================================

const TIER_LEGEND = [
  { label: "App", color: "#10B981" },
  { label: "Features", color: "#6366F1" },
  { label: "Concepts", color: "#D946EF" },
  { label: "Basics", color: "#F59E0B" },
] as const;

// =============================================================================
// 詳細パネル - デフォルト
// =============================================================================

function DefaultPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center h-full text-center px-8"
    >
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-indigo-500/20 rounded-3xl blur-2xl animate-pulse" />
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 border border-white/10 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.1)] relative overflow-hidden backdrop-blur-md">
          <Fingerprint className="w-10 h-10 text-indigo-400 opacity-80" strokeWidth={1} />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      </div>
      <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400 mb-3">
        Explore Your Roadmap
      </h3>
      <p className="text-sm text-gray-400 leading-relaxed max-w-[240px]">
        Interact with any node on the graph to reveal detailed insights, prerequisites, and learning paths mapped just for you.
      </p>

      <div className="mt-12 w-full max-w-[200px] bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 backdrop-blur-sm">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5" /> Legend
        </p>
        <div className="space-y-3">
          {TIER_LEGEND.map((t) => (
            <div key={t.label} className="flex items-center gap-3">
              <div
                className="w-2.5 h-2.5 rounded-full shadow-lg"
                style={{ backgroundColor: t.color, boxShadow: `0 0 10px ${t.color}80` }}
              />
              <span className="text-xs font-medium text-gray-300">{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// 詳細パネル - ノード選択時
// =============================================================================

function NodeDetail({
  node,
  scenario,
  edges,
  onSelectNode,
  experienceLevel,
}: {
  readonly node: ConceptNodeData;
  readonly scenario: ScenarioDefinition;
  readonly edges: readonly ConceptEdge[];
  readonly onSelectNode: (nodeId: string) => void;
  readonly experienceLevel: string;
}) {
  const isFeature = node.nodeType === "feature";
  const isApp = node.nodeType === "app";
  const prerequisites = getPrerequisites(node.id, edges, scenario.nodes);
  const dependents = getDependents(node.id, edges, scenario.nodes);

  const gradient = isApp
    ? "from-emerald-400 to-teal-500"
    : isFeature
      ? "from-indigo-400 to-purple-500"
      : "from-fuchsia-400 to-pink-500";

  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, type: "spring", bounce: 0.2 }}
      className="px-6 py-8"
    >
      <div className="flex flex-col mb-8">
        <div className="flex items-start gap-4 mb-4">
          <div className="relative flex-shrink-0">
            <div className={`absolute inset-0 bg-gradient-to-tr ${gradient} rounded-2xl blur-lg opacity-40`} />
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${gradient} flex items-center justify-center shadow-xl relative z-10 border border-white/20`}>
              {isApp ? (
                <Sparkles className="w-7 h-7 text-white" />
              ) : isFeature ? (
                <Layers className="w-6 h-6 text-white" />
              ) : (
                <BookOpen className="w-6 h-6 text-white" />
              )}
            </div>
          </div>
          <div className="min-w-0 pt-1">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-gray-300 uppercase tracking-wider mb-2"
            >
              {isApp ? "Application" : isFeature ? "Feature" : "Concept"}
            </motion.div>
            <h3 className="text-xl font-bold text-white leading-tight mb-1">{node.title}</h3>
          </div>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">{node.subtitle}</p>
      </div>

      <div className="space-y-6">
        {prerequisites.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
              Prerequisites
            </h4>
            <div className="space-y-2">
              {prerequisites.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectNode(p.id)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] hover:border-white/[0.1] transition-all group overflow-hidden relative"
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-pink-500/0 group-hover:bg-pink-500/100 transition-colors" />
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-pink-400 transition-colors flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors truncate">{p.title}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {dependents.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Unlocks
            </h4>
            <div className="space-y-2">
              {dependents.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectNode(d.id)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] hover:border-white/[0.1] transition-all group overflow-hidden relative"
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-indigo-500/0 group-hover:bg-indigo-500/100 transition-colors" />
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors truncate">{d.title}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {prerequisites.length === 0 && !isFeature && !isApp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="px-4 py-4 rounded-xl bg-amber-500/10 border border-amber-500/20 relative overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-amber-500/20 rounded-full blur-xl" />
            <div className="flex gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200/90 leading-relaxed font-medium">
                This is a foundational concept. It is the perfect place to start your journey!
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* つまずき警告 */}
      <StumbleWarning nodeId={node.id} experienceLevel={experienceLevel} />

      {/* AI Q&A */}
      <ConceptQA
        nodeId={node.id}
        nodeTitle={node.title}
        nodeSubtitle={node.subtitle}
        scenarioTitle={scenario.title}
        experienceLevel={experienceLevel}
      />
    </motion.div>
  );
}

// =============================================================================
// ローディング
// =============================================================================

function LoadingSkeleton() {
  return (
    <div className="absolute inset-0 bg-[#0A0A0B] flex flex-col items-center justify-center z-50">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse rounded-full" />
        <div className="w-20 h-20 relative flex items-center justify-center">
          <svg className="animate-spin text-indigo-500 w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <Sparkles className="absolute text-white w-6 h-6 animate-pulse" />
        </div>
      </div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 text-sm font-medium text-gray-300 tracking-wide"
      >
        Generating your custom roadmap...
      </motion.p>
    </div>
  );
}

// =============================================================================
// メインコンテンツ
// =============================================================================

function Step2Content() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const scenarioId = searchParams.get("scenario") ?? "todo-app";
  const level = searchParams.get("level") ?? "complete-beginner";
  const mode = searchParams.get("mode") ?? "demo";

  const [conceptNodes, setConceptNodes] = useState<readonly ConceptNodeData[]>([]);
  const [edges, setEdges] = useState<readonly ConceptEdge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const scenario = SCENARIO_MAP[scenarioId];

  useEffect(() => {
    if (!scenario) {
      setIsLoading(false);
      return;
    }
    setEdges(scenario.edges);

    async function fetchPersonalized() {
      // Simulate networking animation delay to show off the cool loader
      const minLoaderTime = new Promise(resolve => setTimeout(resolve, 800));

      try {
        const responsePromise = fetch("/api/personalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenarioId, experienceLevel: level }),
        });

        const [response] = await Promise.all([responsePromise, minLoaderTime]);

        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data: PersonalizeResponse = await response.json();

        setConceptNodes(
          data.nodes.map((node) => {
            const def = scenario.nodes.find((n) => n.id === node.id);
            return {
              id: node.id,
              title: node.title,
              subtitle: node.subtitle,
              status: "default" as const,
              nodeType: def?.nodeType,
            };
          })
        );
      } catch {
        await minLoaderTime;
        setConceptNodes(
          scenario.nodes.map((node) => ({
            id: node.id,
            title: node.title,
            subtitle: node.defaultSubtitle,
            status: "default" as const,
            nodeType: node.nodeType,
          }))
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchPersonalized();
  }, [scenarioId, level, scenario]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const handleNext = useCallback(() => {
    router.push(`/step/3?scenario=${scenarioId}&level=${level}&mode=${mode}`);
  }, [router, scenarioId, level, mode]);

  const selectedNode = conceptNodes.find((n) => n.id === selectedNodeId) ?? null;

  if (!scenario) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-[#0A0A0B]">
        <div className="bg-red-500/10 border border-red-500/20 px-6 py-4 rounded-xl">
          <p className="text-red-400 font-medium">Scenario not found: {scenarioId}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col min-h-0 bg-[#0A0A0B] text-slate-200 selection:bg-indigo-500/30">
      <AnimatePresence>
        {isLoading && <LoadingSkeleton />}
      </AnimatePresence>

      <div className="flex-1 flex min-h-0 relative">
        {/* 背景のグラデーション・グリッド装飾 */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
          <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-indigo-500 opacity-20 blur-[100px]" />
        </div>

        {/* グラフエリア */}
        <div className="flex-1 min-h-0 relative z-10 w-full">
          {!isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0"
            >
              <RoadmapGraph
                nodes={conceptNodes}
                edges={edges}
                selectedNodeId={selectedNodeId}
                onNodeClick={handleNodeClick}
              />
            </motion.div>
          )}

          {/* ヘッダーのフローティングカード */}
          <div className="absolute top-6 left-6 z-20 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-2xl flex items-start gap-4 pointer-events-auto"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide">
                  {scenario.title}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-white/10 text-gray-300">
                    Your Tailored Roadmap
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* 詳細パネル（サイドバー） */}
        <aside className="w-[360px] flex-shrink-0 bg-black/60 backdrop-blur-2xl border-l border-white/5 flex flex-col z-20 relative shadow-2xl">
          <div className="absolute inset-y-0 -left-px w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              {selectedNode ? (
                <NodeDetail
                  key={selectedNode.id}
                  node={selectedNode}
                  scenario={scenario}
                  edges={edges}
                  onSelectNode={handleNodeClick}
                  experienceLevel={level}
                />
              ) : (
                <DefaultPanel key="default" />
              )}
            </AnimatePresence>
          </div>

          <motion.div
            className="flex-shrink-0 p-6 border-t border-white/5 bg-black/40"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <button
              type="button"
              onClick={handleNext}
              disabled={isLoading}
              className="group relative w-full h-14 rounded-xl font-bold text-white overflow-hidden transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] transition-opacity" />
              <div className="relative flex items-center justify-center gap-2 h-full">
                <span>Start Implementation</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </motion.div>
        </aside>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </main>
  );
}

// =============================================================================
// エクスポート
// =============================================================================

export default function Step2Page() {
  return (
    <div className="flex flex-col h-screen bg-[#0A0A0B]">
      <StepIndicator currentStep={2} />
      <Suspense
        fallback={
          <main className="flex-1 flex items-center justify-center bg-[#0A0A0B]">
            <LoadingSkeleton />
          </main>
        }
      >
        <Step2Content />
      </Suspense>
    </div>
  );
}
