"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Controls,
  Background,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { CatalogGraphEdge, CatalogGraphNode } from "@/lib/aic/apiTypes";
import { subjectPath } from "@/lib/subjectUrlState";
import { MapCanvasSkeleton } from "./MuseumSkeletons";
import styles from "./catalogGraph.module.css";

type Props = {
  nodes: CatalogGraphNode[];
  edges: CatalogGraphEdge[];
};

type FocusMode = "rest" | "focus" | "neighbor" | "dim";

type CatalogNodeData = {
  slug: string;
  label: string;
  linked: boolean;
  catalogWorkCount: number;
  size: number;
  mode: FocusMode;
  showLabel: boolean;
};

const WIDTH = 3600;
const HEIGHT = 2400;
const PAD = 80;

function hashUnit(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 10000) / 10000;
}

/** Filled scatter — no doughnut / hollow center. */
function layoutPosition(slug: string): { x: number; y: number } {
  const u = hashUnit(slug);
  const v = hashUnit(`${slug}:y`);
  return {
    x: Math.round(PAD + u * (WIDTH - 2 * PAD) - 14),
    y: Math.round(PAD + v * (HEIGHT - 2 * PAD) - 18),
  };
}

function nodeSize(catalogWorkCount: number, maxCatalog: number): number {
  const t =
    Math.log10(Math.max(catalogWorkCount, 8)) /
    Math.log10(Math.max(maxCatalog, 8));
  return Math.round(18 + t * 22); // 18–40px
}

function CatalogNode({ data }: NodeProps<Node<CatalogNodeData>>) {
  const letter = (data.label[0] ?? "?").toUpperCase();
  const modeClass =
    data.mode === "focus"
      ? styles.nodeFocus
      : data.mode === "neighbor"
        ? styles.nodeNeighbor
        : data.mode === "dim"
          ? styles.nodeDimmed
          : data.linked
            ? styles.nodeLinked
            : styles.nodeRest;

  return (
    <div
      className={`${styles.node} ${modeClass}`}
      title={`${data.label} · ${data.catalogWorkCount.toLocaleString()} tagged works`}
      style={{ ["--node-size" as string]: `${data.size}px` }}
    >
      <Handle type="target" id="t" position={Position.Top} className={styles.handle} />
      <Handle type="source" id="s" position={Position.Bottom} className={styles.handle} />
      <div className={styles.icon} aria-hidden="true">
        <span className={styles.glyph}>{letter}</span>
      </div>
      {data.showLabel && <span className={styles.label}>{data.label}</span>}
    </div>
  );
}

const nodeTypes = { catalog: CatalogNode };

export default function HomeCatalogGraph({
  nodes: catalogNodes,
  edges: catalogEdges,
}: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [focusSlug, setFocusSlug] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const maxCatalog = useMemo(
    () => Math.max(8, ...catalogNodes.map((n) => n.catalogWorkCount)),
    [catalogNodes],
  );

  const neighborsOf = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const e of catalogEdges) {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source)!.add(e.target);
      map.get(e.target)!.add(e.source);
    }
    return map;
  }, [catalogEdges]);

  const focusNeighbors = useMemo(() => {
    if (!focusSlug) return null;
    return neighborsOf.get(focusSlug) ?? new Set<string>();
  }, [focusSlug, neighborsOf]);

  const { nodes, edges } = useMemo(() => {
    const rfNodes: Node<CatalogNodeData>[] = catalogNodes.map((n) => {
      let mode: FocusMode = "rest";
      if (focusSlug) {
        if (n.slug === focusSlug) mode = "focus";
        else if (focusNeighbors?.has(n.slug)) mode = "neighbor";
        else mode = "dim";
      }
      const size = nodeSize(n.catalogWorkCount, maxCatalog);
      const showLabel =
        mode === "focus" ||
        mode === "neighbor" ||
        (!focusSlug && n.catalogWorkCount >= maxCatalog * 0.35);

      return {
        id: n.slug,
        type: "catalog",
        position: layoutPosition(n.slug),
        zIndex: mode === "focus" ? 3 : mode === "neighbor" ? 2 : 1,
        data: {
          slug: n.slug,
          label: n.label,
          linked: n.linked,
          catalogWorkCount: n.catalogWorkCount,
          size,
          mode,
          showLabel,
        },
        draggable: false,
      };
    });

    if (!focusSlug) {
      return { nodes: rfNodes, edges: [] as Edge[] };
    }

    const maxShared = Math.max(
      1,
      ...catalogEdges
        .filter((e) => e.source === focusSlug || e.target === focusSlug)
        .map((e) => e.sharedWorkCount),
    );

    const rfEdges: Edge[] = catalogEdges
      .filter((e) => e.source === focusSlug || e.target === focusSlug)
      .map((e) => {
        const strength = e.sharedWorkCount / maxShared;
        return {
          id: `${e.source}->${e.target}`,
          source: e.source,
          target: e.target,
          sourceHandle: "s",
          targetHandle: "t",
          type: "straight",
          animated: false,
          style: {
            stroke: `rgba(212, 175, 55, ${0.35 + strength * 0.5})`,
            strokeWidth: 1.25 + strength * 2.5,
          },
        };
      });

    return { nodes: rfNodes, edges: rfEdges };
  }, [catalogNodes, catalogEdges, focusSlug, focusNeighbors, maxCatalog]);

  const onNodeMouseEnter: NodeMouseHandler<Node<CatalogNodeData>> = useCallback(
    (_event, node) => {
      setFocusSlug(node.id);
    },
    [],
  );

  const onPaneMouseLeave = useCallback(() => {
    setFocusSlug(null);
  }, []);

  const onNodeClick: NodeMouseHandler<Node<CatalogNodeData>> = useCallback(
    (_event, node) => {
      router.push(subjectPath(node.data.slug, "journey"));
    },
    [router],
  );

  if (!catalogNodes.length) return null;

  const linkedCount = catalogNodes.filter((n) => n.linked).length;
  const focusLabel = focusSlug
    ? catalogNodes.find((n) => n.slug === focusSlug)?.label
    : null;
  const spokeCount = focusNeighbors?.size ?? 0;

  return (
    <section className={styles.wrap} aria-labelledby="catalog-graph-heading">
      <div className={styles.header}>
        <h2 id="catalog-graph-heading" className={styles.title}>
          Collection map
        </h2>
        <p className={styles.meta}>
          {focusLabel ? (
            <>
              <strong>{focusLabel}</strong> · {spokeCount} related subjects.
              Click to open its journey.
            </>
          ) : (
            <>
              {catalogNodes.length.toLocaleString()} subjects ·{" "}
              {linkedCount.toLocaleString()} connected. Hover a subject to see
              its links; click to open its journey.
            </>
          )}
        </p>
      </div>
      <div
        className={styles.canvas}
        role="img"
        aria-label="Catalog subject graph"
        onMouseLeave={onPaneMouseLeave}
      >
        {mounted ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={onNodeMouseEnter}
            fitView
            fitViewOptions={{ padding: 0.08 }}
            minZoom={0.06}
            maxZoom={2.5}
            onlyRenderVisibleElements
            nodesConnectable={false}
            nodesDraggable={false}
            edgesFocusable={false}
            panOnDrag
            zoomOnScroll
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="rgba(242, 202, 80, 0.06)" gap={48} />
            <Controls showInteractive={false} />
          </ReactFlow>
        ) : (
          <MapCanvasSkeleton />
        )}
      </div>
    </section>
  );
}
