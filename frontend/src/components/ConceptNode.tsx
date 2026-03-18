"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import {
  Variable,
  ListTree,
  FunctionSquare,
  Split,
  Repeat,
  MousePointer2,
  Database,
  Box,
  Layers,
  Sparkles,
} from "lucide-react";

type ConceptNodeDataProps = {
  title: string;
  subtitle: string;
  status: "default" | "green" | "yellow" | "red";
  codeSnippet?: string;
  nodeType?: "app" | "feature" | "concept";
  depth?: number;
  isSelected?: boolean;
  conceptId?: string;
  [key: string]: unknown;
};

type ConceptFlowNode = Node<ConceptNodeDataProps, "concept">;

const TIER_COLORS: Record<string, string> = {
  app: "#10B981",
  feature: "#6366F1",
  concept: "#D946EF",
  basic: "#F59E0B",
};

function getColor(nodeType?: string, depth?: number): string {
  if (nodeType === "app") return TIER_COLORS.app;
  if (nodeType === "feature") return TIER_COLORS.feature;
  if ((depth ?? 99) >= 3) return TIER_COLORS.basic;
  return TIER_COLORS.concept;
}

function NodeIcon({
  id,
  nodeType,
  color,
  size,
}: {
  readonly id: string;
  readonly nodeType?: string;
  readonly color: string;
  readonly size: number;
}) {
  if (nodeType === "app") return <Sparkles size={size} color={color} strokeWidth={2} />;
  if (nodeType === "feature") return <Layers size={size} color={color} strokeWidth={2} />;
  switch (id) {
    case "variable": return <Variable size={size} color={color} strokeWidth={2} />;
    case "array": return <ListTree size={size} color={color} strokeWidth={2} />;
    case "function": return <FunctionSquare size={size} color={color} strokeWidth={2} />;
    case "conditional": return <Split size={size} color={color} strokeWidth={2} />;
    case "loop": return <Repeat size={size} color={color} strokeWidth={2} />;
    case "event-handling": return <MousePointer2 size={size} color={color} strokeWidth={2} />;
    case "state-management": return <Database size={size} color={color} strokeWidth={2} />;
    default: return <Box size={size} color={color} strokeWidth={2} />;
  }
}

function DotNode({ data }: NodeProps<ConceptFlowNode>) {
  const isSelected = data.isSelected;
  const color = getColor(data.nodeType, data.depth);
  const isApp = data.nodeType === "app";
  const dotSize = isApp ? 56 : 44;
  const iconSize = isApp ? 24 : 18;

  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer group">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-0 !h-0 !border-0 !bg-transparent"
      />

      {/* グロー */}
      <div
        className="absolute rounded-full transition-all duration-300"
        style={{
          width: dotSize + 16,
          height: dotSize + 16,
          top: -8,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: color,
          opacity: isSelected ? 0.35 : 0,
          filter: "blur(12px)",
        }}
      />

      {/* ドット本体 */}
      <div
        className="relative rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110"
        style={{
          width: dotSize,
          height: dotSize,
          backgroundColor: isSelected ? color : "rgba(20,20,28,0.9)",
          border: `2px solid ${isSelected ? color : `${color}60`}`,
          boxShadow: isSelected
            ? `0 0 20px ${color}80, 0 0 40px ${color}30`
            : `0 0 8px ${color}20`,
        }}
      >
        <NodeIcon
          id={data.conceptId ?? ""}
          nodeType={data.nodeType}
          color={isSelected ? "#fff" : color}
          size={iconSize}
        />
      </div>

      {/* ラベル */}
      <div
        className="text-center transition-all duration-200 max-w-[120px]"
        style={{ opacity: isSelected ? 1 : 0.8 }}
      >
        <p
          className="text-xs font-bold leading-tight whitespace-nowrap"
          style={{ color: isSelected ? color : "#e2e8f0" }}
        >
          {data.title}
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-0 !h-0 !border-0 !bg-transparent"
      />
    </div>
  );
}

function ConceptNode(props: NodeProps<ConceptFlowNode>) {
  return <DotNode {...props} />;
}

export default memo(ConceptNode);
