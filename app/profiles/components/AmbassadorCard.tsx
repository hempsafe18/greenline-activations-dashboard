import Link from "next/link";
import type { Ambassador } from "@/lib/ambassadors";
import AmbassadorAvatar from "./AmbassadorAvatar";
import MarketPill from "./MarketPill";
import CertBadge from "./CertBadge";

export default function AmbassadorCard({ ambassador }: { ambassador: Ambassador }) {
  return (
    <Link
      href={`/profiles/${ambassador.id}`}
      className="block rounded-lg border border-ink/5 bg-white p-5 shadow-card no-underline transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-4">
        <AmbassadorAvatar src={ambassador.headshot_url} name={ambassador.name} size={64} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold tracking-tight text-ink">{ambassador.name}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ambassador.markets.slice(0, 2).map((m) => (
              <MarketPill key={m} market={m} />
            ))}
            {ambassador.markets.length > 2 && (
              <span className="text-xs font-bold text-ink/40">+{ambassador.markets.length - 2}</span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <CertBadge certified={ambassador.hempsafe_certified} date={ambassador.hempsafe_cert_date} compact />
      </div>
    </Link>
  );
}
