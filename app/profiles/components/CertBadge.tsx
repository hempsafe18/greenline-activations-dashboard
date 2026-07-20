function formatCertDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CertBadge({
  certified,
  date,
  compact = false,
}: {
  certified: boolean;
  date: string | null;
  compact?: boolean;
}) {
  if (!certified) return null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-canopy px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
        <span className="h-1.5 w-1.5 rounded-full bg-ink" />
        HempSafe
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-canopy px-4 py-1.5 text-xs font-bold text-ink">
      <span className="h-1.5 w-1.5 rounded-full bg-ink" />
      HempSafe Certified{date ? ` · ${formatCertDate(date)}` : ""}
    </span>
  );
}
