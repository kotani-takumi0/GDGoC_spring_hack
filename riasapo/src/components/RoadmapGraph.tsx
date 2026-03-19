"use client";

import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  MarkerType,
  BackgroundVariant,
  useReactFlow,
} from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";

import ConceptNode from "@/components/ConceptNode";
import type { ConceptNodeData, ConceptEdge } from "@/types";

interface RoadmapGraphProps {
  readonly nodes: readonly ConceptNodeData[];
  readonly edges: readonly ConceptEdge[];
  readonly selectedNodeId?: string | null;
  readonly onNodeHover?: (nodeId: string | null) => void;
  readonly onNodeClick?: (nodeId: string) => void;
}

// =============================================================================
// 深さ計算
// =============================================================================

function computeDepths(
  nodes: readonly ConceptNodeData[],
  edges: readonly ConceptEdge[]
): Map<string, number> {
  const depths = new Map<string, number>();
  const outEdges = new Map<string, string[]>();
  for (const edge of edges) {
    const list = outEdges.get(edge.source) ?? [];
    list.push(edge.target);
    outEdges.set(edge.source, list);
  }
  const targets = new Set(edges.map((e) => e.target));
  const roots = nodes.filter((n) => !targets.has(n.id));
  const queue = roots.map((r) => ({ id: r.id, depth: 0 }));

  // BFSで最大depth（最長パス）を使う
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    const current = depths.get(id) ?? -1;
    if (depth <= current) continue;
    depths.set(id, depth);
    for (const child of outEdges.get(id) ?? []) {
      queue.push({ id: child, depth: depth + 1 });
    }
  }

  // nodeTypeに基づく最低depth制約: app=0, feature=1, concept=2
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const [id, depth] of depths.entries()) {
    const node = nodeMap.get(id);
    if (!node) continue;
    const nt = node.nodeType;
    if (nt === 'feature' && depth < 1) depths.set(id, 1);
    if (nt !== 'app' && nt !== 'feature' && depth < 2) depths.set(id, 2);
  }

  return depths;
}

// =============================================================================
// エッジカラー
// =============================================================================

const TIER_EDGE_COLORS = ["#10B981", "#6366F1", "#D946EF", "#F59E0B"];

function getEdgeColor(depth: number): string {
  return TIER_EDGE_COLORS[Math.min(depth, TIER_EDGE_COLORS.length - 1)];
}

// =============================================================================
// ノードサイズ
// =============================================================================

function getNodeSize(nodeType: string | undefined) {
  if (nodeType === "app") return { width: 120, height: 80 };
  return { width: 120, height: 72 };
}

function getNodeRadius(nodeType: string | undefined): number {
  if (nodeType === "app") return 50;
  return 42;
}

// =============================================================================
// Force-Directed レイアウト
// =============================================================================

interface ForceNode extends SimulationNodeDatum {
  id: string;
  nodeType?: string;
  depth: number;
}

function computeForceLayout(
  conceptNodes: readonly ConceptNodeData[],
  conceptEdges: readonly ConceptEdge[],
  depthMap: Map<string, number>
): Map<string, { x: number; y: number }> {
  const simNodes: ForceNode[] = conceptNodes.map((n) => ({
    id: n.id,
    nodeType: n.nodeType,
    depth: depthMap.get(n.id) ?? 0,
    x: 0,
    y: 0,
  }));

  const simLinks: SimulationLinkDatum<ForceNode>[] = conceptEdges.map((e) => ({
    source: e.source,
    target: e.target,
  }));

  const simulation = forceSimulation(simNodes)
    .force(
      "link",
      forceLink<ForceNode, SimulationLinkDatum<ForceNode>>(simLinks)
        .id((d) => d.id)
        .distance(250)
        .strength(0.7)
    )
    .force("charge", forceManyBody().strength(-1200))
    .force("center", forceCenter(0, 0))
    .force(
      "collide",
      forceCollide<ForceNode>()
        .radius((d) => getNodeRadius(d.nodeType) + 50)
        .strength(1)
    )
    .force(
      "y",
      forceY<ForceNode>()
        .y((d) => d.depth * 280)
        .strength(0.8)
    )
    .force("x", forceX(0).strength(0.05))
    .stop();

  // シミュレーションを一気に実行
  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of simNodes) {
    positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
  }

  return positions;
}

// =============================================================================
// React Flow要素の構築
// =============================================================================

function buildFlowElements(
  conceptNodes: readonly ConceptNodeData[],
  conceptEdges: readonly ConceptEdge[],
  depthMap: Map<string, number>,
  positions: Map<string, { x: number; y: number }>,
  selectedNodeId?: string | null
) {
  const connectedToSelected = new Set<string>();
  // 選択されたConceptの「消費者」ノード（そのconceptをdependsOnしているfeature/appノード）
  const consumersOfSelected = new Set<string>();
  if (selectedNodeId) {
    connectedToSelected.add(selectedNodeId);
    for (const e of conceptEdges) {
      if (e.source === selectedNodeId) connectedToSelected.add(e.target);
      if (e.target === selectedNodeId) {
        connectedToSelected.add(e.source);
        // source → target の向き = sourceがtargetを使っている
        const sourceNode = conceptNodes.find((n) => n.id === e.source);
        if (sourceNode?.nodeType === "feature" || sourceNode?.nodeType === "app") {
          consumersOfSelected.add(e.source);
        }
      }
    }
  }

  const nodes: Node[] = conceptNodes.map((n) => {
    const pos = positions.get(n.id) ?? { x: 0, y: 0 };
    const depth = depthMap.get(n.id) ?? 1;
    const { width, height } = getNodeSize(n.nodeType);
    return {
      id: n.id,
      type: "concept",
      position: { x: pos.x - width / 2, y: pos.y - height / 2 },
      data: {
        title: n.title,
        subtitle: n.subtitle,
        status: n.status,
        nodeType: n.nodeType,
        depth,
        conceptId: n.id,
        isSelected: n.id === selectedNodeId,
        isConsumer: consumersOfSelected.has(n.id),
        dimmed: selectedNodeId != null && !connectedToSelected.has(n.id),
      },
    };
  });

  const edges: Edge[] = conceptEdges.map((e, i) => {
    const targetDepth = depthMap.get(e.target) ?? 1;
    const color = getEdgeColor(targetDepth);
    const isHighlighted =
      selectedNodeId != null &&
      (e.source === selectedNodeId || e.target === selectedNodeId);

    return {
      id: `edge-${i}`,
      source: e.source,
      target: e.target,
      type: "default",
      animated: isHighlighted,
      style: {
        stroke: color,
        strokeWidth: isHighlighted ? 3 : 1.5,
        opacity: selectedNodeId
          ? isHighlighted
            ? 0.9
            : 0.15
          : 0.4,
        filter: isHighlighted ? `drop-shadow(0 0 6px ${color})` : "none",
        transition: "all 0.3s ease",
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color,
        width: isHighlighted ? 20 : 14,
        height: isHighlighted ? 20 : 14,
      },
    };
  });

  return { nodes, edges };
}

// =============================================================================
// コンポーネント
// =============================================================================

const nodeTypes = { concept: ConceptNode } as const;

function RoadmapGraphInner({
  nodes: conceptNodes,
  edges: conceptEdges,
  selectedNodeId,
  onNodeHover,
  onNodeClick,
}: RoadmapGraphProps) {
  const depthMap = useMemo(
    () => computeDepths(conceptNodes, conceptEdges),
    [conceptNodes, conceptEdges]
  );

  const forcePositions = useMemo(
    () => computeForceLayout(conceptNodes, conceptEdges, depthMap),
    [conceptNodes, conceptEdges, depthMap]
  );

  const { nodes, edges } = useMemo(
    () =>
      buildFlowElements(
        conceptNodes,
        conceptEdges,
        depthMap,
        forcePositions,
        selectedNodeId
      ),
    [conceptNodes, conceptEdges, depthMap, forcePositions, selectedNodeId]
  );

  const handleNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => onNodeHover?.(node.id),
    [onNodeHover]
  );
  const handleNodeMouseLeave = useCallback(
    () => onNodeHover?.(null),
    [onNodeHover]
  );
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => onNodeClick?.(node.id),
    [onNodeClick]
  );

  return (
    <div className="w-full h-full relative" style={{ overflow: "hidden" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.05, maxZoom: 1.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll
        minZoom={0.15}
        maxZoom={1.5}
        colorMode="dark"
        className="dark-theme-flow"
      >
        <Background
          color="#334155"
          gap={28}
          size={1.5}
          variant={BackgroundVariant.Dots}
          style={{ opacity: 0.5 }}
        />
        <Controls
          showInteractive={false}
          style={{
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
          className="roadmap-controls"
        />
      </ReactFlow>

      <style jsx global>{`
        .roadmap-controls button {
          background: transparent !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: white !important;
        }
        .roadmap-controls button:last-child {
          border-bottom: none !important;
        }
        .roadmap-controls button:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        .roadmap-controls svg {
          fill: rgba(255, 255, 255, 0.8) !important;
        }
      `}</style>
    </div>
  );
}

export default function RoadmapGraph(props: RoadmapGraphProps) {
  return (
    <ReactFlowProvider>
      <RoadmapGraphInner {...props} />
    </ReactFlowProvider>
  );
}
