"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ReactFlow,
  Controls,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ArtworkCard, ConnectionEdgeCard } from "@/lib/aic/apiTypes";
import { subjectPath } from "@/lib/subjectUrlState";
import ArtworkImage from "./ArtworkImage";
import { useOpenArtwork } from "./SubjectShell";
import styles from "./constellation.module.css";
import museum from "./museum.module.css";

type Props = {
  subjectSlug: string;
  subjectLabel: string;
  hubSample: ArtworkCard | null;
  connections: ConnectionEdgeCard[];
  related: string | null;
  intersection: ArtworkCard[];
  note: string;
};

type SubjectNodeData = {
  slug: string;
  label: string;
  imageUrl: string | null;
  imageAlt: string;
  imageWidth: number | null;
  imageHeight: number | null;
  sharedWorkCount: number | null;
  hub: boolean;
  onSelect?: (slug: string) => void;
};

const nodeTypes = { subject: SubjectGraphNode };

function SubjectGraphNode({ data }: NodeProps<Node<SubjectNodeData>>) {
  return (
    <div
      className={data.hub ? styles.graphNodeHub : styles.graphNode}
      role={data.hub ? undefined : "button"}
      tabIndex={data.hub ? undefined : 0}
      aria-label={
        data.hub
          ? undefined
          : `${data.label}, ${data.sharedWorkCount ?? 0} shared works`
      }
      onClick={() => {
        if (!data.hub) data.onSelect?.(data.slug);
      }}
      onKeyDown={(event) => {
        if (data.hub) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          data.onSelect?.(data.slug);
        }
      }}
    >
      <Handle
        type="target"
        id="t"
        position={Position.Top}
        className={styles.graphHandle}
      />
      <Handle
        type="source"
        id="s"
        position={Position.Bottom}
        className={styles.graphHandle}
      />
      <div className={data.hub ? styles.satCardHub : styles.satCard}>
        <ArtworkImage
          src={data.imageUrl}
          alt={data.imageAlt}
          width={data.imageWidth}
          height={data.imageHeight}
        />
      </div>
      <span className={styles.satTitle}>{data.label}</span>
      <span className={styles.satMeta}>
        {data.hub
          ? "Current subject"
          : `${data.sharedWorkCount ?? 0} shared works`}
      </span>
    </div>
  );
}

function buildGraph(
  subjectSlug: string,
  subjectLabel: string,
  hubSample: ArtworkCard | null,
  connections: ConnectionEdgeCard[],
  related: string | null,
  onSelect: (slug: string) => void,
): { nodes: Node<SubjectNodeData>[]; edges: Edge[] } {
  const spokes = connections.slice(0, 8);
  const maxShared = Math.max(1, ...spokes.map((c) => c.sharedWorkCount));
  const cx = 420;
  const cy = 300;
  const radius = 220;

  const nodes: Node<SubjectNodeData>[] = [
    {
      id: subjectSlug,
      type: "subject",
      position: { x: cx - 56, y: cy - 72 },
      data: {
        slug: subjectSlug,
        label: subjectLabel,
        imageUrl: hubSample?.imageUrl ?? null,
        imageAlt: hubSample?.altText || hubSample?.title || subjectLabel,
        imageWidth: hubSample?.imageWidth ?? null,
        imageHeight: hubSample?.imageHeight ?? null,
        sharedWorkCount: null,
        hub: true,
        onSelect,
      },
      draggable: false,
      selectable: false,
    },
  ];

  const edges: Edge[] = [];

  spokes.forEach((c, i) => {
    const angle = (i / Math.max(spokes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + radius * Math.cos(angle) - 56;
    const y = cy + radius * Math.sin(angle) - 72;
    const strength = c.sharedWorkCount / maxShared;
    nodes.push({
      id: c.targetSlug,
      type: "subject",
      position: { x, y },
      data: {
        slug: c.targetSlug,
        label: c.targetLabel,
        imageUrl: c.samples[0]?.imageUrl ?? null,
        imageAlt: c.samples[0]?.altText || c.samples[0]?.title || c.targetLabel,
        imageWidth: c.samples[0]?.imageWidth ?? null,
        imageHeight: c.samples[0]?.imageHeight ?? null,
        sharedWorkCount: c.sharedWorkCount,
        hub: false,
        onSelect,
      },
      selected: related === c.targetSlug,
    });
    edges.push({
      id: `${subjectSlug}->${c.targetSlug}`,
      source: subjectSlug,
      target: c.targetSlug,
      sourceHandle: "s",
      targetHandle: "t",
      type: "straight",
      animated: false,
      style: {
        stroke: "rgba(212, 175, 55, 0.85)",
        strokeWidth: 1.25 + strength * 4,
      },
    });
  });

  return { nodes, edges };
}

export default function ConnectionsView({
  subjectSlug,
  subjectLabel,
  hubSample,
  connections,
  related,
  intersection,
  note,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = useOpenArtwork();

  const selectRelated = useCallback(
    (slug: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (related === slug) params.delete("related");
      else params.set("related", slug);
      params.delete("artwork");
      const q = params.toString();
      router.push(`${pathname}${q ? `?${q}` : ""}`);
    },
    [pathname, related, router, searchParams],
  );

  const { nodes, edges } = useMemo(
    () =>
      buildGraph(
        subjectSlug,
        subjectLabel,
        hubSample,
        connections,
        related,
        selectRelated,
      ),
    [subjectSlug, subjectLabel, hubSample, connections, related, selectRelated],
  );

  useEffect(() => {
    if (!related) return;
    document
      .getElementById("shared-works")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [related]);

  const active = connections.find((c) => c.targetSlug === related);
  const strip = related
    ? intersection.length
      ? intersection
      : (active?.samples ?? [])
    : [];

  if (!connections.length) {
    return (
      <div className={styles.hubWrap}>
        <div className={styles.ambient} aria-hidden="true">
          <div className={styles.ambientGlowA} />
          <div className={styles.dotGrid} />
        </div>
        <p className={styles.empty}>
          No connections computed for this subject yet.
        </p>
        <p className={museum.note} style={{ textAlign: "center" }}>
          {note}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.hubWrap}>
      <div className={styles.ambient} aria-hidden="true">
        <div className={styles.ambientGlowA} />
        <div className={styles.ambientGlowB} />
        <div className={styles.dotGrid} />
      </div>

      <div className={styles.banner}>
        <div className={styles.bannerMeta}>
          <div className={styles.stamp}>
            <span className={styles.stampLabel}>Constellation · lens</span>
            <span className={styles.stampValue}>{subjectLabel}</span>
          </div>
          <span className={styles.statChip}>
            {connections.length} related subjects
          </span>
        </div>
        <p className={museum.note} style={{ margin: 0, maxWidth: "22rem" }}>
          {note}
        </p>
      </div>

      <div className={styles.graphCanvas} role="img" aria-label={`${subjectLabel} connection graph`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.35}
          maxZoom={1.8}
          nodesConnectable={false}
          nodesDraggable
          edgesFocusable={false}
          panOnDrag
          zoomOnScroll
          colorMode="dark"
        >
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {related && strip.length > 0 && active && (
        <section
          id="shared-works"
          className={`${styles.intersection} ${styles.intersectionActive}`}
          aria-label="Shared works"
        >
          <h2 className={museum.chapterLabel}>
            {active.sharedWorkCount} works are tagged with both {subjectLabel}{" "}
            and {active.targetLabel}
          </h2>
          <div className={museum.strip}>
            {strip.map((work) => (
              <StripCell key={work.sourceId} work={work} open={open} />
            ))}
          </div>
          <div className={museum.ctaRow}>
            <Link
              href={subjectPath(active.targetSlug, "journey")}
              className={`${museum.button} ${museum.buttonPrimary}`}
            >
              Open {active.targetLabel} Journey
            </Link>
            <Link
              href={subjectPath(subjectSlug, "journey")}
              className={museum.button}
            >
              Back to {subjectLabel} Journey
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function StripCell({
  work,
  open,
}: {
  work: ArtworkCard;
  open: (id: string, el?: HTMLElement | null) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      className={museum.workButton}
      onClick={() => open(work.sourceId, ref.current)}
    >
      <ArtworkImage
        src={work.imageUrl}
        alt={work.altText || work.title || "Artwork"}
        width={work.imageWidth}
        height={work.imageHeight}
      />
      <div className={museum.workCaption}>
        <strong>{work.title || "Untitled"}</strong>
      </div>
    </button>
  );
}
