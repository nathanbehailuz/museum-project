import { cache } from "react";
import { ensureSubjectEnriched } from "./enrich";

/** One enrich per subject per RSC request (layout + page run in parallel). */
export const enrichSubjectOnce = cache((slug: string) =>
  ensureSubjectEnriched(slug),
);
