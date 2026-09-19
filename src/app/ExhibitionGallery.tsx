"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import Image from "next/image";
import type { Artwork } from "@/lib/types";
import { getPublishedSubjects } from "@/lib/subjects";
import {
  buildShareUrl,
  commitTitle,
  MAX_TITLE_LENGTH,
  parseExhibitionSearchParams,
  serializeExhibitionState,
  type ExhibitionUrlState,
} from "@/lib/urlState";
import InspectionModal from "./InspectionModal";
import styles from "./gallery.module.css";

type Status =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "invalid_url"
  | "partial";

type Slot =
  | { kind: "ok"; artwork: Artwork }
  | { kind: "unavailable"; id: number; reason: string }
  | { kind: "empty" };

type ArtworksApiResponse =
  | {
      ok: true;
      slots: Array<
        | { id: number; status: "ok"; artwork: Artwork }
        | { id: number; status: "unavailable"; reason: string }
      >;
    }
  | { ok: false; error: string; message: string };

type ReplacementApiResponse =
  | { ok: true; artwork: Artwork }
  | { ok: false; error: string; message: string };

const publishedSubjects = getPublishedSubjects();

function labelOrFallback(value: string | null, fallback: string) {
  return value && value.trim() ? value : fallback;
}

function ArtworkSkeleton({ index }: { index: number }) {
  return (
    <article className={styles.slot} aria-hidden="true">
      <div className={`${styles.frame} ${styles.skeletonFrame}`}>
        <div className={styles.skeletonImage} data-index={index} />
      </div>
      <div className={styles.meta}>
        <div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonSub}`} />
      </div>
    </article>
  );
}

function writeUrl(state: ExhibitionUrlState, mode: "push" | "replace") {
  const next = serializeExhibitionState(state);
  const url = `${window.location.pathname}${next}`;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

export default function ExhibitionGallery() {
  const [status, setStatus] = useState<Status>("loading");
  const [subject, setSubject] = useState("windows");
  const [title, setTitle] = useState("Windows");
  const [titleDraft, setTitleDraft] = useState("Windows");
  const [slots, setSlots] = useState<Slot[]>([
    { kind: "empty" },
    { kind: "empty" },
    { kind: "empty" },
  ]);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingReplace, setPendingReplace] = useState<number | null>(null);
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [clipboardFallback, setClipboardFallback] = useState<string | null>(
    null,
  );
  const [loadToken, setLoadToken] = useState(0);

  const openerRefs = useRef<Array<HTMLButtonElement | null>>([null, null, null]);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const currentIds = (): number[] =>
    slots.map((slot) => {
      if (slot.kind === "ok") return slot.artwork.id;
      if (slot.kind === "unavailable") return slot.id;
      return 0;
    });

  const syncUrl = useCallback(
    (next: ExhibitionUrlState, mode: "push" | "replace") => {
      writeUrl(next, mode);
    },
    [],
  );

  const applySlotsFromApi = useCallback(
    (
      apiSlots: Extract<ArtworksApiResponse, { ok: true }>["slots"],
      nextSubject: string,
      nextTitle: string,
    ) => {
      const mapped: Slot[] = apiSlots.map((slot) => {
        if (slot.status === "ok") return { kind: "ok", artwork: slot.artwork };
        return {
          kind: "unavailable",
          id: slot.id,
          reason: slot.reason,
        };
      });
      while (mapped.length < 3) mapped.push({ kind: "empty" });
      setSlots(mapped.slice(0, 3));
      setSubject(nextSubject);
      setTitle(nextTitle);
      setTitleDraft(nextTitle);

      const okCount = mapped.filter((s) => s.kind === "ok").length;
      if (okCount === 0) {
        setStatus("empty");
        setMessage("Not enough eligible artworks are available.");
      } else if (okCount < 3) {
        setStatus("partial");
        setMessage(
          "Some shared artworks are unavailable. Replace a missing slot or reset the exhibition.",
        );
      } else {
        setStatus("ready");
        setMessage(null);
      }
    },
    [],
  );

  const loadFromState = useCallback(
    async (state: ExhibitionUrlState, signal: AbortSignal) => {
      setStatus("loading");
      setMessage(null);
      setClipboardFallback(null);
      setShareNotice(null);
      setInspectIndex(null);
      setPendingReplace(null);

      try {
        const res = await fetch(`/api/artworks?ids=${state.ids.join(",")}`, {
          signal,
          cache: "no-store",
        });
        const data = (await res.json()) as ArtworksApiResponse;
        if (signal.aborted) return;

        if (!data.ok) {
          setStatus("error");
          setMessage(data.message);
          return;
        }

        applySlotsFromApi(data.slots, state.subject, state.title);
      } catch (err) {
        if (signal.aborted) return;
        setStatus("error");
        setMessage(
          err instanceof Error && err.name === "AbortError"
            ? "The request was cancelled."
            : "Could not load the exhibition. Please try again.",
        );
      }
    },
    [applySlotsFromApi],
  );

  const loadDefaultSubject = useCallback(
    async (slug: string, signal: AbortSignal, historyMode: "push" | "replace") => {
      setStatus("loading");
      setMessage(null);
      setInspectIndex(null);
      setPendingReplace(null);

      try {
        const res = await fetch(
          `/api/exhibitions?subject=${encodeURIComponent(slug)}`,
          { signal, cache: "no-store" },
        );
        const data = (await res.json()) as
          | {
              ok: true;
              subject: string;
              title: string;
              artworks: Artwork[];
            }
          | { ok: false; error: string; message: string };

        if (signal.aborted) return;

        if (!data.ok) {
          setStatus(data.error === "insufficient_content" ? "empty" : "error");
          setMessage(data.message);
          return;
        }

        const ids = data.artworks.map((a) => a.id) as [number, number, number];
        const state: ExhibitionUrlState = {
          subject: data.subject,
          ids,
          title: data.title,
        };
        applySlotsFromApi(
          data.artworks.map((artwork) => ({
            id: artwork.id,
            status: "ok" as const,
            artwork,
          })),
          data.subject,
          data.title,
        );
        syncUrl(state, historyMode);
      } catch (err) {
        if (signal.aborted) return;
        setStatus("error");
        setMessage(
          err instanceof Error && err.name === "AbortError"
            ? "The request was cancelled."
            : "Could not load the exhibition. Please try again.",
        );
      }
    },
    [applySlotsFromApi, syncUrl],
  );

  // Initial load + reload token
  useEffect(() => {
    const controller = new AbortController();
    const parsed = parseExhibitionSearchParams(
      new URLSearchParams(window.location.search),
    );

    if (!parsed.ok) {
      setStatus("invalid_url");
      setMessage(parsed.message);
      return () => controller.abort();
    }

    setSubject(parsed.state.subject);
    setTitle(parsed.state.title);
    setTitleDraft(parsed.state.title);

    // Normalize bare `/` into explicit query for shareability when defaults used
    if (!window.location.search) {
      writeUrl(parsed.state, "replace");
    }

    void loadFromState(parsed.state, controller.signal);
    return () => controller.abort();
  }, [loadFromState, loadToken]);

  // popstate
  useEffect(() => {
    const onPop = () => {
      setLoadToken((t) => t + 1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const exhibitionState = (): ExhibitionUrlState | null => {
    const ids = currentIds();
    if (ids.some((id) => id <= 0) || ids.length !== 3) return null;
    if (new Set(ids).size !== 3) return null;
    return {
      subject,
      ids: ids as [number, number, number],
      title,
    };
  };

  const onSubjectChange = (slug: string) => {
    if (slug === subject && status === "ready") return;
    const controller = new AbortController();
    void loadDefaultSubject(slug, controller.signal, "push");
  };

  const onTitleBlur = () => {
    const subjectMeta = publishedSubjects.find((s) => s.slug === subject);
    const nextTitle = commitTitle(
      titleDraft,
      subjectMeta?.defaultTitle ?? "Exhibition",
    );
    setTitleDraft(nextTitle);
    if (nextTitle === title) return;
    setTitle(nextTitle);
    const state = exhibitionState();
    if (state) syncUrl({ ...state, title: nextTitle }, "replace");
  };

  const moveSlot = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target > 2) return;
    setSlots((prev) => {
      const next = [...prev];
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      const ids = next.map((slot) => {
        if (slot.kind === "ok") return slot.artwork.id;
        if (slot.kind === "unavailable") return slot.id;
        return 0;
      });
      if (ids.every((id) => id > 0) && new Set(ids).size === 3) {
        syncUrl(
          {
            subject,
            ids: ids as [number, number, number],
            title,
          },
          "replace",
        );
      }
      return next;
    });
  };

  const replaceSlot = async (index: number) => {
    if (pendingReplace !== null) return;
    setPendingReplace(index);
    setShareNotice(null);

    const exclude = currentIds().filter((id) => id > 0);
    try {
      const res = await fetch(
        `/api/replacements?subject=${encodeURIComponent(subject)}&exclude=${exclude.join(",")}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as ReplacementApiResponse;
      if (!data.ok) {
        setShareNotice(data.message);
        return;
      }

      setSlots((prev) => {
        const next = [...prev];
        next[index] = { kind: "ok", artwork: data.artwork };
        const ids = next.map((slot) => {
          if (slot.kind === "ok") return slot.artwork.id;
          if (slot.kind === "unavailable") return slot.id;
          return 0;
        });
        if (ids.every((id) => id > 0) && new Set(ids).size === 3) {
          syncUrl(
            {
              subject,
              ids: ids as [number, number, number],
              title,
            },
            "replace",
          );
          setStatus("ready");
          setMessage(null);
        }
        return next;
      });
    } catch {
      setShareNotice("Could not replace this work. Please try again.");
    } finally {
      setPendingReplace(null);
    }
  };

  const openInspect = (index: number) => {
    const slot = slots[index];
    if (!slot || slot.kind !== "ok") return;
    returnFocusRef.current = openerRefs.current[index];
    setInspectIndex(index);
  };

  const copyLink = async () => {
    const state = exhibitionState();
    if (!state) {
      setShareNotice("Fix unavailable artworks before sharing.");
      return;
    }
    const url = buildShareUrl(
      window.location.origin,
      window.location.pathname,
      state,
    );
    try {
      await navigator.clipboard.writeText(url);
      setClipboardFallback(null);
      setShareNotice("Link copied.");
    } catch {
      setClipboardFallback(url);
      setShareNotice("Clipboard unavailable. Copy the link below.");
    }
  };

  const resetDefault = () => {
    const controller = new AbortController();
    void loadDefaultSubject(
      publishedSubjects[0]?.slug ?? "windows",
      controller.signal,
      "replace",
    );
  };

  const inspected =
    inspectIndex != null && slots[inspectIndex]?.kind === "ok"
      ? (slots[inspectIndex] as Extract<Slot, { kind: "ok" }>).artwork
      : null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.brand}>Museum Exhibition Maker</p>
        <div className={styles.toolbar}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Subject</span>
            <select
              className={styles.select}
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              disabled={status === "loading"}
            >
              {publishedSubjects.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.defaultTitle}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Exhibition title</span>
            <input
              className={styles.titleInput}
              value={titleDraft}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={onTitleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              disabled={status === "loading" || status === "invalid_url"}
            />
          </label>
          <button
            type="button"
            className={styles.shareButton}
            onClick={() => void copyLink()}
            disabled={status === "loading" || status === "invalid_url"}
          >
            Copy link
          </button>
        </div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lede}>
          Three works about something you almost missed.
        </p>
      </header>

      <div
        className={styles.status}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {status === "loading" ? "Loading exhibition…" : null}
        {status === "ready" ? "Exhibition loaded." : null}
        {status === "partial" ? message : null}
        {status === "empty" || status === "error" || status === "invalid_url"
          ? message
          : null}
        {shareNotice}
      </div>

      {clipboardFallback ? (
        <div className={styles.clipboardFallback}>
          <label className={styles.fieldLabel} htmlFor="share-url">
            Share URL
          </label>
          <textarea
            id="share-url"
            className={styles.shareTextarea}
            readOnly
            value={clipboardFallback}
            rows={2}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      ) : null}

      {status === "invalid_url" && (
        <section className={styles.recovery} aria-label="Invalid shared link">
          <p className={styles.recoveryText}>
            {message ?? "This shared link is not valid."}
          </p>
          <button type="button" className={styles.retry} onClick={resetDefault}>
            Load default exhibition
          </button>
        </section>
      )}

      {status === "loading" && (
        <section
          className={styles.gallery}
          aria-busy="true"
          aria-label="Loading artworks"
        >
          <ArtworkSkeleton index={0} />
          <ArtworkSkeleton index={1} />
          <ArtworkSkeleton index={2} />
        </section>
      )}

      {(status === "ready" || status === "partial") && (
        <section className={styles.gallery} aria-label="Exhibition artworks">
          {slots.map((slot, index) => {
            if (slot.kind === "ok") {
              const artwork = slot.artwork;
              const isFirst = index === 0;
              const isLast = index === slots.length - 1;
              return (
                <article key={`${artwork.id}-${index}`} className={styles.slot}>
                  <div className={styles.frame}>
                    <button
                      ref={(el) => {
                        openerRefs.current[index] = el;
                      }}
                      type="button"
                      className={styles.imageButton}
                      onClick={() => openInspect(index)}
                      aria-label={`Inspect ${artwork.title}`}
                    >
                      <Image
                        src={artwork.image.small}
                        alt=""
                        width={843}
                        height={1124}
                        className={styles.image}
                        sizes="(max-width: 768px) 100vw, 33vw"
                        unoptimized
                      />
                    </button>
                  </div>
                  <div className={styles.meta}>
                    <h2 className={styles.workTitle}>{artwork.title}</h2>
                    <p className={styles.workCredit}>
                      <span>
                        {labelOrFallback(artwork.artist, "Artist unknown")}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>
                        {labelOrFallback(artwork.date, "Date unknown")}
                      </span>
                    </p>
                  </div>
                  <div className={styles.slotControls}>
                    <button
                      type="button"
                      className={styles.control}
                      aria-label="Move artwork earlier"
                      disabled={isFirst || pendingReplace !== null}
                      onClick={() => moveSlot(index, -1)}
                    >
                      <span className={styles.controlDesktop}>Move left</span>
                      <span className={styles.controlMobile}>Move up</span>
                    </button>
                    <button
                      type="button"
                      className={styles.control}
                      aria-label="Move artwork later"
                      disabled={isLast || pendingReplace !== null}
                      onClick={() => moveSlot(index, 1)}
                    >
                      <span className={styles.controlDesktop}>Move right</span>
                      <span className={styles.controlMobile}>Move down</span>
                    </button>
                    <button
                      type="button"
                      className={styles.control}
                      aria-label={`Replace ${artwork.title}`}
                      disabled={pendingReplace !== null}
                      onClick={() => void replaceSlot(index)}
                    >
                      {pendingReplace === index ? "Replacing…" : "Replace"}
                    </button>
                  </div>
                </article>
              );
            }

            if (slot.kind === "unavailable") {
              return (
                <article key={`missing-${slot.id}-${index}`} className={styles.slot}>
                  <div className={`${styles.frame} ${styles.unavailableFrame}`}>
                    <p className={styles.unavailableLabel}>
                      Artwork unavailable
                    </p>
                  </div>
                  <div className={styles.meta}>
                    <h2 className={styles.workTitle}>Missing work</h2>
                    <p className={styles.workCredit}>
                      ID {slot.id} could not be loaded ({slot.reason}).
                    </p>
                  </div>
                  <div className={styles.slotControls}>
                    <button
                      type="button"
                      className={styles.control}
                      disabled={pendingReplace !== null}
                      onClick={() => void replaceSlot(index)}
                    >
                      {pendingReplace === index ? "Replacing…" : "Replace"}
                    </button>
                    <button
                      type="button"
                      className={styles.control}
                      onClick={resetDefault}
                    >
                      Reset exhibition
                    </button>
                  </div>
                </article>
              );
            }

            return null;
          })}
        </section>
      )}

      {(status === "empty" || status === "error") && (
        <section className={styles.recovery} aria-label="Exhibition unavailable">
          <p className={styles.recoveryText}>
            {message ?? "Something went wrong while contacting the museum."}
          </p>
          {status === "error" && (
            <button
              type="button"
              className={styles.retry}
              onClick={() => setLoadToken((t) => t + 1)}
            >
              Try again
            </button>
          )}
          {status === "empty" && (
            <button type="button" className={styles.retry} onClick={resetDefault}>
              Load default exhibition
            </button>
          )}
        </section>
      )}

      {status === "partial" && (
        <section className={styles.recovery} aria-label="Partial exhibition">
          <p className={styles.recoveryText}>{message}</p>
          <button type="button" className={styles.retry} onClick={resetDefault}>
            Reset exhibition
          </button>
        </section>
      )}

      {inspected && (
        <InspectionModal
          artwork={inspected}
          onClose={() => setInspectIndex(null)}
          returnFocusRef={returnFocusRef as RefObject<HTMLElement | null>}
        />
      )}
    </main>
  );
}
