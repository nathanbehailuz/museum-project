"use client";

import { useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ArtworkCard } from "@/lib/aic/apiTypes";
import {
  parseSubjectSearchParams,
  serializeSubjectSearchParams,
  type WorksSort,
} from "@/lib/subjectUrlState";
import ArtworkImage from "./ArtworkImage";
import { useOpenArtwork } from "./SubjectShell";
import styles from "./museum.module.css";

type Props = {
  results: ArtworkCard[];
  page: number;
  pageSize: number;
  total: number;
};

function evidenceLabel(src: string | null | undefined) {
  if (src === "subject") return "Subject tag";
  if (src === "term") return "Catalog term";
  return null;
}

export default function WorksView({ results, page, pageSize, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = parseSubjectSearchParams(
    new URLSearchParams(searchParams.toString()),
  );
  const open = useOpenArtwork();

  const pushState = useCallback(
    (patch: Partial<typeof state>) => {
      const next = { ...state, ...patch };
      router.push(`${pathname}${serializeSubjectSearchParams(next)}`);
    },
    [pathname, router, state],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className={styles.worksToolbar}>
        <label className={styles.field}>
          Sort
          <select
            value={state.sort}
            onChange={(e) =>
              pushState({ sort: e.target.value as WorksSort, page: 1 })
            }
          >
            <option value="date">Date</option>
            <option value="artist">Artist</option>
            <option value="title">Title</option>
          </select>
        </label>
        <label className={styles.field}>
          Type
          <input
            type="search"
            placeholder="e.g. Painting"
            defaultValue={state.type ?? ""}
            onBlur={(e) =>
              pushState({ type: e.target.value.trim() || null, page: 1 })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                pushState({
                  type: (e.target as HTMLInputElement).value.trim() || null,
                  page: 1,
                });
              }
            }}
          />
        </label>
        <label className={styles.field}>
          Medium
          <input
            type="search"
            placeholder="e.g. Oil"
            defaultValue={state.medium ?? ""}
            onBlur={(e) =>
              pushState({ medium: e.target.value.trim() || null, page: 1 })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                pushState({
                  medium: (e.target as HTMLInputElement).value.trim() || null,
                  page: 1,
                });
              }
            }}
          />
        </label>
        <label className={styles.field}>
          Artist
          <input
            type="search"
            placeholder="Name"
            defaultValue={state.artist ?? ""}
            onBlur={(e) =>
              pushState({ artist: e.target.value.trim() || null, page: 1 })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                pushState({
                  artist: (e.target as HTMLInputElement).value.trim() || null,
                  page: 1,
                });
              }
            }}
          />
        </label>
        <label className={styles.field}>
          From
          <input
            type="number"
            defaultValue={state.from ?? ""}
            onBlur={(e) =>
              pushState({
                from: e.target.value ? Number(e.target.value) : null,
                page: 1,
              })
            }
          />
        </label>
        <label className={styles.field}>
          To
          <input
            type="number"
            defaultValue={state.to ?? ""}
            onBlur={(e) =>
              pushState({
                to: e.target.value ? Number(e.target.value) : null,
                page: 1,
              })
            }
          />
        </label>
      </div>

      {results.length === 0 ? (
        <p className={styles.muted}>No works match these filters.</p>
      ) : (
        <div className={styles.worksGrid}>
          {results.map((work) => (
            <WorkCell key={work.sourceId} work={work} open={open} />
          ))}
        </div>
      )}

      {total > 0 && (
        <div className={styles.pager}>
          <button
            type="button"
            className={styles.button}
            disabled={page <= 1}
            onClick={() => pushState({ page: page - 1 })}
          >
            Previous
          </button>
          <span className={styles.muted}>
            Page {page} of {totalPages} · {total} works
          </span>
          <button
            type="button"
            className={styles.button}
            disabled={page >= totalPages}
            onClick={() => pushState({ page: page + 1 })}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function WorkCell({
  work,
  open,
}: {
  work: ArtworkCard;
  open: (id: string, el?: HTMLElement | null) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const chip = evidenceLabel(work.evidenceSource);
  return (
    <button
      ref={ref}
      type="button"
      className={styles.workButton}
      onClick={() => open(work.sourceId, ref.current)}
    >
      <ArtworkImage
        src={work.imageUrl}
        alt={work.altText || work.title || "Artwork"}
        width={work.imageWidth}
        height={work.imageHeight}
      />
      <div className={styles.workCaption}>
        <strong>{work.title || "Untitled"}</strong>
        <span>
          {work.artistTitle || "Artist unknown"}
          {work.dateDisplay ? ` · ${work.dateDisplay}` : ""}
        </span>
        {chip && <span className={styles.evidence}>{chip}</span>}
      </div>
    </button>
  );
}
