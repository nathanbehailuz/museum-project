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
import styles from "./catalogGraph.module.css";

type Props = {
  nodes: CatalogGraphNode[];
  edges: CatalogGraphEdge[];
};

type CatalogNodeData = {
  slug: string;
  label: string;
  linked: boolean;
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

function CatalogNode({ data }: NodeProps<Node<CatalogNodeData>>) {
  const letter = (data.label[0] ?? "?").toUpperCase();
  return (
    <div
      className={data.linked ? styles.nodeLinked : styles.nodeDim}
      title={data.label}
    >
      <Handle type="target" id="t" position={Position.Top} className={styles.handle} />
      <Handle type="source" id="s" position={Position.Bottom} className={styles.handle} />
      <div className={styles.icon} aria-hidden="true">
        <span className={styles.glyph}>{letter}</span>
      </div>
      <span className={styles.label}>{data.label}</span>
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
  useEffect(() => {
    setMounted(true);
  }, []);

  const { nodes, edges } = useMemo(() => {
    const rfNodes: Node<CatalogNodeData>[] = catalogNodes.map((n) => ({
      id: n.slug,
      type: "catalog",
      position: layoutPosition(n.slug),
      data: {
        slug: n.slug,
        label: n.label,
        linked: n.linked,
      },
      draggable: false,
    }));

    const maxShared = Math.max(
      1,
      ...catalogEdges.map((e) => e.sharedWorkCount),
    );
    const rfEdges: Edge[] = catalogEdges.map((e) => {
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
          stroke: "rgba(212, 175, 55, 0.4)",
          strokeWidth: 0.75 + strength * 2,
        },
      };
    });

    return { nodes: rfNodes, edges: rfEdges };
  }, [catalogNodes, catalogEdges]);

  const onNodeClick: NodeMouseHandler<Node<CatalogNodeData>> = useCallback(
    (_event, node) => {
      router.push(subjectPath(node.data.slug, "journey"));
    },
    [router],
  );

  if (!catalogNodes.length) return null;

  const linkedCount = catalogNodes.filter((n) => n.linked).length;

  return (
    <section className={styles.wrap} aria-labelledby="catalog-graph-heading">
      <div className={styles.header}>
        <h2 id="catalog-graph-heading" className={styles.title}>
          Collection map
        </h2>
        <p className={styles.meta}>
          {catalogNodes.length.toLocaleString()} subjects ·{" "}
          {catalogEdges.length.toLocaleString()} links · {linkedCount.toLocaleString()}{" "}
          connected. Click any subject to open its journey (works load on
          demand).
        </p>
      </div>
      <div
        className={styles.canvas}
        role="img"
        aria-label="Catalog subject graph"
      >
        {mounted ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
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
            <Background color="rgba(242, 202, 80, 0.08)" gap={48} />
            <Controls showInteractive={false} />
          </ReactFlow>
        ) : (
          <p className={styles.loading}>Loading map…</p>
        )}
      </div>
    </section>
  );
}
