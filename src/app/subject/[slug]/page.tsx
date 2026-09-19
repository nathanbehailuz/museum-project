import { redirect } from "next/navigation";
import { getTermBySlug } from "@/lib/aic/queries";
import { subjectPath } from "@/lib/subjectUrlState";

type Props = { params: Promise<{ slug: string }> };

export default async function SubjectIndexPage({ params }: Props) {
  const { slug } = await params;
  const term = await getTermBySlug(slug);
  if (term?.status === "browse_only") {
    redirect(subjectPath(slug, "works"));
  }
  redirect(subjectPath(slug, "journey"));
}
