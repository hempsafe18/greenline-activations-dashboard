import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAmbassadorBySlug } from "@/lib/ambassadors";
import AmbassadorProfileCard from "../components/AmbassadorProfileCard";
import BackLink from "../components/BackLink";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ambassador = await getAmbassadorBySlug(slug);
  return { title: ambassador ? `${ambassador.name} | Greenline Activations` : "Ambassador Profile" };
}

export default async function AmbassadorProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ambassador = await getAmbassadorBySlug(slug);

  if (!ambassador) notFound();

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center px-6 py-10">
      <div className="mb-4 w-full">
        <BackLink href="/profiles">Back to Profiles</BackLink>
      </div>

      <AmbassadorProfileCard ambassador={ambassador} />
    </div>
  );
}
