export default function MarketPill({ market }: { market: string }) {
  return (
    <span className="inline-block rounded-full bg-sage px-3 py-1 text-xs font-bold text-ink">
      {market}
    </span>
  );
}
