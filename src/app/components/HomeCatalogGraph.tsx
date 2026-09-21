"use client";

import { useCallback, useMemo } from "react";
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
  imageUrl: string | null;
  ready: boolean;
};

const WIDTH = 3200;
const HEIGHT = 2200;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;

function hashUnit(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 10000) / 10000;
}

function layoutPosition(
  slug: string,
  ready: boolean,
  index: number,
  total: number,
): { x: number; y: number } {
  const u = hashUnit(slug);
  const v = hashUnit(`${slug}:y`);
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 + u * 0.4;
  const ring = ready ? 0.22 + u * 0.18 : 0.42 + v * 0.48;
  const radius = Math.min(WIDTH, HEIGHT) * 0.42 * ring;
  const jitterX = (u - 0.5) * (ready ? 40 : 90);
  const jitterY = (v - 0.5) * (ready ? 40 : 90);
  return {
    x: CX + Math.cos(angle) * radius + jitterX - (ready ? 22 : 14),
    y: CY + Math.sin(angle) * radius + jitterY - (ready ? 28 : 18),
  };
}

function CatalogNode({ data }: NodeProps<Node<CatalogNodeData>>) {
  const letter = (data.label[0] ?? "?").toUpperCase();
  return (
    <div
      className={data.ready ? styles.nodeReady : styles.nodeDim}
      title={data.label}
    >
      <Handle type="target" id="t" position={Position.Top} className={styles.handle} />
      <Handle type="source" id="s" position={Position.Bottom} className={styles.handle} />
      <div className={styles.icon}>
        {data.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.imageUrl} alt="" />
        ) : (
          <span className={styles.glyph} aria-hidden="true">
            {letter}
          </span>
        )}
      </div>
      <span className={styles.label}>{data.label}</span>
    </div>
  );
}

const nodeTypes = { catalog: CatalogNode };

export default function HomeCatalogGraph({ nodes: catalogNodes, edges: catalogEdges }: Props) {
  const router = useRouter();

  const { nodes, edges } = useMemo(() => {
    const sorted = [...catalogNodes].sort((a, b) =>
      a.slug.localeCompare(b.slug),
    );
    const readyFirst = [
      ...sorted.filter((n) => n.status === "journey_ready"),
      ...sorted.filter((n) => n.status !== "journey_ready"),
    ];
    const total = readyFirst.length;

    const rfNodes: Node<CatalogNodeData>[] = readyFirst.map((n, i) => {
      const ready = n.status === "journey_ready";
      const pos = layoutPosition(n.slug, ready, i, total);
      return {
        id: n.slug,
        type: "catalog",
        position: pos,
        data: {
          slug: n.slug,
          label: n.label,
          imageUrl: n.imageUrl,
          ready,
        },
        draggable: false,
      };
    });

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
          stroke: "rgba(212, 175, 55, 0.55)",
          strokeWidth: 1 + strength * 2.5,
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

  return (
    <section className={styles.wrap} aria-labelledby="catalog-graph-heading">
      <div className={styles.header}>
        <h2 id="catalog-graph-heading" className={styles.title}>
          Collection map
        </h2>
        <p className={styles.meta}>
          {catalogNodes.length.toLocaleString()} subjects from The Met catalog.
          Gold links connect journey-ready subjects that share tagged works.
        </p>
      </div>
      <div
        className={styles.canvas}
        role="img"
        aria-label="Catalog subject graph"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.08}
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
      </div>
    </section>
  );
}
