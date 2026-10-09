import { formatConversion, MIN_SAMPLED_FOR_RATE, type AmbassadorPerformance } from "@/lib/ambassador-format";

/** Compact "59% conv." chip for directory cards. Renders nothing without enough data. */
export function ConversionChip({ performance }: { performance: AmbassadorPerformance }) {
  if (performance.conversion_pct === null) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-sage px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
      {formatConversion(performance.conversion_pct)} conv.
    </span>
  );
}

/** Full conversion panel for the profile page. */
export default function ConversionStat({ performance }: { performance: AmbassadorPerformance }) {
  const { conversion_pct, sold, sampled, recaps } = performance;

  if (conversion_pct === null) {
    return (
      <div className="mt-3 rounded-lg bg-mist px-4 py-3 text-sm text-ink/60">
        {recaps > 0
          ? `Conversion rate appears after ${MIN_SAMPLED_FOR_RATE}+ consumers sampled — ${sampled} so far across ${recaps} ${recaps === 1 ? "recap" : "recaps"}.`
          : "New to the roster — conversion rate appears once activation recaps are logged."}
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center justify-between gap-4 rounded-lg bg-mist px-4 py-4">
      <p className="text-sm text-ink/60">
        <span className="font-bold text-ink">{sold}</span> sold of <span className="font-bold text-ink">{sampled}</span>{" "}
        sampled across {recaps} {recaps === 1 ? "recap" : "recaps"}
      </p>
      <p className="font-display text-3xl font-extrabold tracking-tight text-canopy">{formatConversion(conversion_pct)}</p>
    </div>
  );
}
