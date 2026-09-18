import subjectsData from "../../data/subjects.json";
import type { SubjectConfig, SubjectsFile } from "./types";

const data = subjectsData as SubjectsFile;

export function getDefaultSubjectSlug(): string {
  return data.defaultSubject;
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
