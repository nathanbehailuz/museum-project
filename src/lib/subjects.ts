import subjectsData from "../../data/subjects.json";
import type { SubjectConfig, SubjectsFile } from "./types";

const data = subjectsData as SubjectsFile;

export function getDefaultSubjectSlug(): string {
  return data.defaultSubject;
}

export function getPublishedSubjects(): SubjectConfig[] {
  return data.subjects.filter((s) => s.published);
}

export function getPublishedSubject(slug: string): SubjectConfig | null {
  const subject = data.subjects.find((s) => s.slug === slug && s.published);
  return subject ?? null;
}

export function isSupportedSubject(slug: string): boolean {
  return getPublishedSubject(slug) !== null;
}

export function getSubjectOrNull(slug: string | null | undefined): SubjectConfig | null {
  if (!slug || typeof slug !== "string") return null;
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return null;
  return getPublishedSubject(trimmed);
}

/** True if the ID appears in any published subject's reviewed pool. */
export function isIdInAnyPublishedPool(id: number): boolean {
  return getPublishedSubjects().some((s) => s.artworkIds.includes(id));
}

export function findSubjectContainingId(id: number): SubjectConfig | null {
  return getPublishedSubjects().find((s) => s.artworkIds.includes(id)) ?? null;
}

export function pickReplacementId(
  subject: SubjectConfig,
  exclude: number[],
): number | null {
  const excluded = new Set(exclude);
  const candidate = subject.artworkIds.find((id) => !excluded.has(id));
  return candidate ?? null;
}
