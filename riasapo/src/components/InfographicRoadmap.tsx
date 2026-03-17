"use client";

import { useMemo } from "react";
import type { ConceptNodeData, ConceptEdge } from "@/types";

// =============================================================================
// 概念アイコン
// =============================================================================

function ConceptIcon({ id, size = 18 }: { readonly id: string; readonly size?: number }) {
  const s = size;
  const c = "currentColor";
  switch (id) {
    case "variable":
      return (<svg width={s} height={s} viewBox="0 0 20 20" fill="none"><rect x="3" y="4" width="14" height="12" rx="2.5" stroke={c} strokeWidth="1.6" /><text x="10" y="14" textAnchor="middle" fontSize="9" fontWeight="bold" fontFamily="monospace" fill={c}>x</text></svg>);
    case "array":
      return (<svg width={s} height={s} viewBox="0 0 20 20" fill="none"><rect x="1" y="6" width="5" height="8" rx="1" stroke={c} strokeWidth="1.3" /><rect x="7.5" y="6" width="5" height="8" rx="1" stroke={c} strokeWidth="1.3" /><rect x="14" y="6" width="5" height="8" rx="1" stroke={c} strokeWidth="1.3" /></svg>);
    case "function":
      return (<svg width={s} height={s} viewBox="0 0 20 20" fill="none"><path d="M6 3C6 3 4 3 4 5.5V10H7M4 10V15.5C4 18 6 18 6 18" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" /><line x1="2.5" y1="10" x2="8" y2="10" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></svg>);
    case "conditional":
      return (<svg width={s} height={s} viewBox="0 0 20 20" fill="none"><path d="M10 2L18 10L10 18L2 10Z" stroke={c} strokeWidth="1.4" fill="none" /><text x="10" y="14" textAnchor="middle" fontSize="9" fontWeight="bold" fill={c}>?</text></svg>);
    case "loop":
      return (<svg width={s} height={s} viewBox="0 0 20 20" fill="none"><path d="M14 10A4 4 0 1 1 12.5 6.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" /><path d="M12 4L14.5 6.5L12 7" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>);
    case "event-handling":
      return (<svg width={s} height={s} viewBox="0 0 20 20" fill="none"><path d="M11.5 2L5 11H9.5L8.5 18L15 9H10.5L11.5 2Z" stroke={c} strokeWidth="1.3" strokeLinejoin="round" fill="none" /></svg>);
    case "state-management":
      return (<svg width={s} height={s} viewBox="0 0 20 20" fill="none"><ellipse cx="10" cy="5.5" rx="7" ry="3" stroke={c} strokeWidth="1.3" fill="none" /><path d="M3 5.5V9.5C3 11.16 5.69 12.5 10 12.5S17 11.16 17 9.5V5.5" stroke={c} strokeWidth="1.3" fill="none" /><path d="M3 9.5V13.5C3 15.16 5.69 16.5 10 16.5S17 15.16 17 13.5V9.5" stroke={c} strokeWidth="1.3" fill="none" /></svg>);
    default:
      return (<svg width={s} height={s} viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.4" fill="none" /></svg>);
  }
}

// =============================================================================
// データ計算
// =============================================================================

interface AppNode {
  readonly node: ConceptNodeData;
}

interface FeatureNode {
  readonly node: ConceptNodeData;
  readonly requiredConcepts: readonly ConceptNodeData[];
}

interface ConceptInfo {
  readonly node: ConceptNodeData;
  readonly usedByCount: number;
}

interface InfographicData {
  readonly app: AppNode;
  readonly features: readonly FeatureNode[];
  readonly concepts: readonly ConceptInfo[];
}

function buildInfographicData(
  nodes: readonly ConceptNodeData[],
  edges: readonly ConceptEdge[]
): InfographicData | null {
  const appNode = nodes.find((n) => n.nodeType === "app");
  if (!appNode) return null;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // featureノードとその必要概念を収集
  const featureNodes = nodes.filter((n) => n.nodeType === "feature");
  const features: FeatureNode[] = featureNodes.map((fn) => {
    const conceptIds = edges
      .filter((e) => e.source === fn.id)
      .map((e) => e.target);
    const requiredConcepts = conceptIds
      .map((id) => nodeMap.get(id))
      .filter((n): n is ConceptNodeData => n !== undefined && n.nodeType !== "feature" && n.nodeType !== "app");
    return { node: fn, requiredConcepts };
  });

  // 概念ノードと使用回数を集計
  const conceptUsageCount = new Map<string, number>();
  for (const f of features) {
    for (const c of f.requiredConcepts) {
      conceptUsageCount.set(c.id, (conceptUsageCount.get(c.id) ?? 0) + 1);
    }
  }

  const conceptNodes = nodes.filter(
    (n) => n.nodeType !== "feature" && n.nodeType !== "app"
  );
  const concepts: ConceptInfo[] = conceptNodes
    .map((n) => ({ node: n, usedByCount: conceptUsageCount.get(n.id) ?? 0 }))
    .sort((a, b) => b.usedByCount - a.usedByCount);

  return { app: { node: appNode }, features, concepts };
}

// =============================================================================
// Feature カード
// =============================================================================

function FeatureCard({
  feature,
  isSelected,
  onClick,
}: {
  readonly feature: FeatureNode;
  readonly isSelected: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border-2 transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 p-4"
      style={{
        backgroundColor: isSelected ? "#F5F3FF" : "#fff",
        borderColor: isSelected ? "#8B5CF6" : "#E5E7EB",
        boxShadow: isSelected
          ? "0 4px 16px rgba(139,92,246,0.15)"
          : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* タイトル */}
      <p className="text-sm font-bold text-gray-800 mb-1.5">{feature.node.title}</p>
      <p className="text-xs text-gray-500 leading-relaxed mb-3">{feature.node.subtitle}</p>

      {/* 必要な概念タグ */}
      <div className="flex flex-wrap gap-1.5">
        {feature.requiredConcepts.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-violet-50 text-violet-600"
          >
            <ConceptIcon id={c.id} size={12} />
            {c.title}
          </span>
        ))}
      </div>
    </button>
  );
}

// =============================================================================
// 概念ピル
// =============================================================================

function ConceptPill({
  concept,
  isSelected,
  onClick,
}: {
  readonly concept: ConceptInfo;
  readonly isSelected: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border-2 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 text-left"
      style={{
        backgroundColor: isSelected ? "#F0F9FF" : "#fff",
        borderColor: isSelected ? "#0EA5E9" : "#E5E7EB",
        boxShadow: isSelected
          ? "0 4px 12px rgba(14,165,233,0.12)"
          : "0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
        <ConceptIcon id={concept.node.id} size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-gray-800">{concept.node.title}</p>
        {concept.usedByCount > 0 && (
          <p className="text-[10px] text-gray-400">{concept.usedByCount}つの機能で使用</p>
        )}
      </div>
    </button>
  );
}

// =============================================================================
// セクション区切り
// =============================================================================

function SectionDivider({
  label,
  sublabel,
  color,
}: {
  readonly label: string;
  readonly sublabel?: string;
  readonly color: string;
}) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-gray-200" />
      <div className="text-center">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
          {label}
        </span>
        {sublabel && (
          <p className="text-[10px] text-gray-400 mt-0.5">{sublabel}</p>
        )}
      </div>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

// =============================================================================
// メインコンポーネント
// =============================================================================

interface InfographicRoadmapProps {
  readonly nodes: readonly ConceptNodeData[];
  readonly edges: readonly ConceptEdge[];
  readonly selectedNodeId?: string | null;
  readonly onNodeClick?: (nodeId: string) => void;
}

export default function InfographicRoadmap({
  nodes,
  edges,
  selectedNodeId,
  onNodeClick,
}: InfographicRoadmapProps) {
  const data = useMemo(() => buildInfographicData(nodes, edges), [nodes, edges]);

  if (!data) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* アプリ（ヒーロー） */}
      <button
        type="button"
        onClick={() => onNodeClick?.(data.app.node.id)}
        className="w-full text-left rounded-2xl px-6 py-5 text-white relative transition-all duration-200 cursor-pointer group"
        style={{
          background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
          boxShadow: selectedNodeId === data.app.node.id
            ? "0 0 0 3px rgba(139,92,246,0.5), 0 12px 36px rgba(79,70,229,0.35)"
            : "0 6px 24px rgba(79,70,229,0.2)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15 9H22L16.5 13.5L18 20L12 16L6 20L7.5 13.5L2 9H9L12 2Z" fill="white" fillOpacity="0.9" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold">{data.app.node.title}</p>
            <p className="text-sm text-white/75 mt-1 leading-relaxed">{data.app.node.subtitle}</p>
          </div>
        </div>
      </button>

      {/* 区切り: 機能 */}
      <SectionDivider
        label="この機能を理解するために"
        sublabel="各機能に必要なプログラミングの概念"
        color="#8B5CF6"
      />

      {/* 機能カード (2列グリッド) */}
      <div className="grid grid-cols-2 gap-3">
        {data.features.map((f) => (
          <FeatureCard
            key={f.node.id}
            feature={f}
            isSelected={selectedNodeId === f.node.id}
            onClick={() => onNodeClick?.(f.node.id)}
          />
        ))}
      </div>

      {/* 区切り: 概念 */}
      <SectionDivider
        label="学ぶべき概念"
        sublabel="上の機能で使われるプログラミングの基礎"
        color="#0EA5E9"
      />

      {/* 概念ピル (横スクロール or グリッド) */}
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {data.concepts.map((c) => (
          <ConceptPill
            key={c.node.id}
            concept={c}
            isSelected={selectedNodeId === c.node.id}
            onClick={() => onNodeClick?.(c.node.id)}
          />
        ))}
      </div>
    </div>
  );
}
