"use client";

import { useMemo, useState } from "react";
import type { Ambassador } from "@/lib/ambassador-format";
import AmbassadorCard from "./components/AmbassadorCard";
import BackLink from "./components/BackLink";
import GreenlineWordmark from "./components/GreenlineWordmark";

type SortKey = "name" | "conversion";

const FIELD =
  "rounded-lg border border-ink/10 bg-mist px-4 py-2 text-sm text-ink outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-canopy";

const STEPS = [
  {
    title: "Browse",
    body: "Every ambassador here is onboarded and active with Greenline. Conversion rates come straight from logged activation recaps.",
  },
  {
    title: "Shortlist",
    body: "Note the ambassadors you want on your program and share them with your Greenline team, or include them with your activation request.",
  },
  {
    title: "We confirm",
    body: "Requests are reviewed for availability and program fit. If a pick is booked or isn't the right match, we'll recommend a strong alternate.",
  },
];

function FilterToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-lg border px-4 py-2 text-sm font-bold transition-colors ${
        active ? "border-canopy bg-canopy text-ink" : "border-ink/10 bg-mist text-ink/60 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export default function ProfilesDirectory({
  ambassadors,
  dashboardHref,
}: {
  ambassadors: Ambassador[];
  dashboardHref: string;
}) {
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [certifiedOnly, setCertifiedOnly] = useState(false);
  const [hasPhotoOnly, setHasPhotoOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");

  const states = useMemo(() => {
    const set = new Set<string>();
    ambassadors.forEach((a) => a.state && set.add(a.state));
    return Array.from(set).sort();
  }, [ambassadors]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    ambassadors.forEach((a) => {
      if (a.city && (!state || a.state === state)) set.add(a.city);
    });
    return Array.from(set).sort();
  }, [ambassadors, state]);

  const certifiedCount = useMemo(() => ambassadors.filter((a) => a.hempsafe_certified).length, [ambassadors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = ambassadors.filter((a) => {
      if (q && !a.name.toLowerCase().includes(q)) return false;
      if (state && a.state !== state) return false;
      if (city && a.city !== city) return false;
      if (certifiedOnly && !a.hempsafe_certified) return false;
      if (hasPhotoOnly && !a.has_photo) return false;
      return true;
    });
    if (sort === "conversion") {
      // Ambassadors without a rate yet sort last, still alphabetical among themselves.
      return [...list].sort(
        (a, b) =>
          (b.performance.conversion_pct ?? -1) - (a.performance.conversion_pct ?? -1) || a.name.localeCompare(b.name)
      );
    }
    return list;
  }, [ambassadors, search, state, city, certifiedOnly, hasPhotoOnly, sort]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <BackLink href={dashboardHref}>Back to Dashboard</BackLink>
        <GreenlineWordmark />
      </div>

      <div className="mb-6 max-w-2xl">
        <p className="font-display text-[10px] font-bold uppercase tracking-widest text-ink/40">Greenline Activations</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">Ambassador Profiles</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          Meet the HempSafe-certified brand ambassadors working Greenline activations. Compare experience, markets, and
          real in-store conversion, then build a shortlist of the reps you want representing your brand.
        </p>
      </div>

      <div className="mb-8 rounded-lg border border-ink/5 bg-white p-5 shadow-soft">
        <p className="font-display text-[10px] font-bold uppercase tracking-widest text-ink/40">How staff requests work</p>
        <ol className="mt-4 grid gap-5 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-extrabold text-ink">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-bold text-ink">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink/60">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 border-t border-ink/5 pt-3 text-xs text-ink/40">
          Requests are not guaranteed — availability and fit decide every assignment. Conversion = units sold ÷ consumers
          sampled across an ambassador&apos;s activation recaps, shown once they&apos;ve sampled 10+ consumers.
        </p>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name..."
          aria-label="Search ambassadors by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={FIELD}
        />
        <select
          aria-label="Filter by state"
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setCity("");
          }}
          className={FIELD}
        >
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select aria-label="Filter by city" value={city} onChange={(e) => setCity(e.target.value)} className={FIELD}>
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <FilterToggle active={certifiedOnly} onClick={() => setCertifiedOnly((v) => !v)}>
          HempSafe Certified Only
        </FilterToggle>
        <FilterToggle active={hasPhotoOnly} onClick={() => setHasPhotoOnly((v) => !v)}>
          Has Photo
        </FilterToggle>
        <select aria-label="Sort ambassadors" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={FIELD}>
          <option value="name">Sort: Name A–Z</option>
          <option value="conversion">Sort: Top conversion</option>
        </select>
        <span className="text-xs font-bold text-ink/40">
          {filtered.length} of {ambassadors.length} ambassadors · {certifiedCount} HempSafe certified
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-ink/5 bg-white py-12 text-center shadow-soft">
          <p className="text-sm font-bold text-ink/60">No ambassadors match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a, i) => (
            <AmbassadorCard key={a.id} ambassador={a} eager={i < 6} />
          ))}
        </div>
      )}
    </div>
  );
}
