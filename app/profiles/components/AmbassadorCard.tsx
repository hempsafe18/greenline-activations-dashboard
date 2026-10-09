import Link from "next/link";
import type { Ambassador } from "@/lib/ambassador-format";
import AmbassadorAvatar from "./AmbassadorAvatar";
import MarketPill from "./MarketPill";
import CertBadge from "./CertBadge";
import ExperienceTag from "./ExperienceTag";
import { ConversionChip } from "./ConversionStat";

export default function AmbassadorCard({ ambassador, eager = false }: { ambassador: Ambassador; eager?: boolean }) {
  const hasTags = ambassador.hempsafe_certified || ambassador.experience || ambassador.performance.conversion_pct !== null;

  return (
    <Link
      href={`/profiles/${ambassador.slug}`}
      className="flex flex-col rounded-lg border border-ink/5 bg-white p-5 shadow-soft no-underline transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
    >
      <div className="flex items-start gap-4">
        <AmbassadorAvatar src={ambassador.headshot_url} name={ambassador.name} size={80} eager={eager} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold tracking-tight text-ink">{ambassador.name}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ambassador.markets.slice(0, 2).map((m) => (
              <MarketPill key={m} market={m} />
            ))}
            {ambassador.markets.length > 2 && (
              <span className="self-center text-xs font-bold text-ink/40">+{ambassador.markets.length - 2}</span>
            )}
          </div>
        </div>
      </div>

      {ambassador.about && <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-ink/70">{ambassador.about}</p>}

      {hasTags && (
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
          <CertBadge certified={ambassador.hempsafe_certified} date={ambassador.hempsafe_cert_date} compact />
          <ExperienceTag experience={ambassador.experience} />
          <ConversionChip performance={ambassador.performance} />
        </div>
      )}
    </Link>
  );
}
