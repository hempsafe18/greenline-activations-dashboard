import type { Ambassador } from "@/lib/ambassador-format";
import AmbassadorAvatar from "./AmbassadorAvatar";
import MarketPill from "./MarketPill";
import CertBadge from "./CertBadge";
import ConversionStat from "./ConversionStat";
import ExperienceTag from "./ExperienceTag";
import GreenlineWordmark from "./GreenlineWordmark";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-display text-[10px] font-bold uppercase tracking-widest text-ink/40">{children}</p>;
}

export default function AmbassadorProfileCard({ ambassador }: { ambassador: Ambassador }) {
  return (
    <div className="w-full rounded-lg border border-ink/5 bg-white p-8 shadow-soft">
      <SectionLabel>Brand Ambassador</SectionLabel>

      <div className="mt-4 flex items-center gap-5">
        <AmbassadorAvatar src={ambassador.headshot_url} name={ambassador.name} size={112} eager />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">{ambassador.name}</h1>
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

      <div className="mt-6">
        <SectionLabel>Avg. Conversion Rate</SectionLabel>
        <ConversionStat performance={ambassador.performance} />
      </div>

      {ambassador.experience && (
        <div className="mt-6">
          <SectionLabel>Brand Ambassador Experience</SectionLabel>
          <div className="mt-3">
            <ExperienceTag experience={ambassador.experience} />
          </div>
        </div>
      )}

      {ambassador.about && (
        <div className="mt-6">
          <SectionLabel>About</SectionLabel>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/80">{ambassador.about}</p>
        </div>
      )}

      {ambassador.strengths.length > 0 && (
        <div className="mt-6">
          <SectionLabel>Strengths</SectionLabel>
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

      <p className="mt-8 rounded-lg bg-sage px-4 py-3 text-xs leading-relaxed text-ink/70">
        Interested in this ambassador? Share them with your Greenline team. Requests are confirmed based on availability
        and program fit.
      </p>

      <div className="mt-6 border-t border-ink/5 pt-5">
        <GreenlineWordmark />
      </div>
    </div>
  );
}
