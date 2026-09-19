import { redirect } from "next/navigation";
import { subjectPath } from "@/lib/subjectUrlState";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function WorksRedirectPage({ params }: Props) {
  const { slug } = await params;
  redirect(subjectPath(slug, "journey"));
}
