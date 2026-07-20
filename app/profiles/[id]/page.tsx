import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAmbassadorById } from "@/lib/ambassadors";
import AmbassadorAvatar from "../components/AmbassadorAvatar";
import MarketPill from "../components/MarketPill";
import CertBadge from "../components/CertBadge";
import GreenlineWordmark from "../components/GreenlineWordmark";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ambassador = await getAmbassadorById(id);
  return { title: ambassador ? `${ambassador.name} | Greenline Activations` : "Ambassador Profile" };
}

export default async function AmbassadorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ambassador = await getAmbassadorById(id);

  if (!ambassador) notFound();

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6 py-12">
      <div className="w-full rounded-lg border border-ink/5 bg-white p-8 shadow-card">
        <p className="text-[10px] uppercase tracking-widest text-ink/40">Brand Ambassador</p>

        <div className="mt-4 flex items-center gap-5">
          <AmbassadorAvatar src={ambassador.headshot_url} name={ambassador.name} size={96} />
          <div className="min-w-0">
            <h1 className="font-bold tracking-tight text-xl text-ink">{ambassador.name}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ambassador.markets.map((m) => (
                <MarketPill key={m} market={m} />
              ))}
            </div>
          </div>
        </div>

        {ambassador.hempsafe_certified && (
          <div className="mt-6">
            <CertBadge certified={ambassador.hempsafe_certified} date={ambassador.hempsafe_cert_date} />
          </div>
        )}

        {ambassador.strengths.length > 0 && (
          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-widest text-ink/40">Strengths</p>
            <ul className="mt-3 space-y-2">
              {ambassador.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-canopy" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 border-t border-ink/5 pt-5">
          <GreenlineWordmark />
        </div>
      </div>
    </div>
  );
}
