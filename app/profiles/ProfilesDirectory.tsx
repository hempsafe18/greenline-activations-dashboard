"use client";

import { useMemo, useState } from "react";
import type { Ambassador } from "@/lib/ambassadors";
import AmbassadorCard from "./components/AmbassadorCard";
import GreenlineWordmark from "./components/GreenlineWordmark";

export default function ProfilesDirectory({ ambassadors }: { ambassadors: Ambassador[] }) {
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [certifiedOnly, setCertifiedOnly] = useState(false);

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

  const filtered = ambassadors.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (state && a.state !== state) return false;
    if (city && a.city !== city) return false;
    if (certifiedOnly && !a.hempsafe_certified) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-ink/40">Greenline Activations</p>
          <h1 className="mt-1 font-bold tracking-tight text-2xl text-ink">Ambassador Profiles</h1>
        </div>
        <GreenlineWordmark />
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg bg-mist px-4 py-2 text-sm text-ink outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-canopy"
        />
        <select
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setCity("");
          }}
          className="rounded-lg bg-mist px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-canopy"
        >
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-lg bg-mist px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-canopy"
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={() => setCertifiedOnly((v) => !v)}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
            certifiedOnly ? "bg-canopy text-ink" : "bg-mist text-ink/60"
          }`}
        >
          HempSafe Certified Only
        </button>
        <span className="text-xs font-bold text-ink/40">
          {filtered.length} of {ambassadors.length} ambassadors
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-ink/5 bg-white p-10 text-center shadow-card">
          <p className="text-sm font-bold text-ink/60">No ambassadors match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <AmbassadorCard key={a.id} ambassador={a} />
          ))}
        </div>
      )}
    </div>
  );
}
