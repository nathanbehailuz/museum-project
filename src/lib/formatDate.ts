/** Format catalog years and Met date_display strings for UI. */

export function formatYear(year: number | null | undefined): string {
  if (year == null || !Number.isFinite(year)) return "";
  const y = Math.trunc(year);
  if (y < 0) return `${Math.abs(y)} BCE`;
  if (y === 0) return "1 BCE";
  return String(y);
}

export function formatYearRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  const a = formatYear(min);
  const b = formatYear(max);
  if (a && b) return a === b ? a : `${a}–${b}`;
  return a || b || "";
}

/** Clean Met approximate dates like "ca..1770" → "ca. 1770". */
export function formatDateDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.trim();
  if (!s) return "";

  // Collapse "ca.." / "c.." / "circa." punctuation
  s = s.replace(/\b(ca|c|circa)\s*\.+\s*/gi, "ca. ");
  s = s.replace(/\b(ca|c|circa)\s+/gi, "ca. ");
  // Fix double spaces / dots
  s = s.replace(/\.{2,}/g, ".");
  s = s.replace(/\s{2,}/g, " ").trim();

  // Leading negative year in free text: -5 → 5 BCE (standalone or start)
  s = s.replace(/(^|[^\d])-(\d{1,4})\b/g, (_, pre, n) => `${pre}${n} BCE`);

  return s;
}

export function formatSubjectMeta(
  workCount: number,
  dateMin: number | null | undefined,
  dateMax: number | null | undefined,
): string {
  const range = formatYearRange(dateMin ?? null, dateMax ?? null);
  const works = `${workCount} work${workCount === 1 ? "" : "s"}`;
  return range ? `${works} · ${range}` : works;
}
