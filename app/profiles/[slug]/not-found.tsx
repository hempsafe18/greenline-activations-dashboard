import GreenlineWordmark from "../components/GreenlineWordmark";

export default function AmbassadorNotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6 py-12">
      <div className="w-full rounded-lg border border-ink/5 bg-white p-8 text-center shadow-card">
        <p className="text-[10px] uppercase tracking-widest text-ink/40">Brand Ambassador</p>
        <h1 className="mt-3 font-bold tracking-tight text-xl text-ink">Profile Not Found</h1>
        <p className="mt-2 text-sm text-ink/60">This ambassador profile is unavailable or no longer active.</p>
        <div className="mt-8 flex justify-center border-t border-ink/5 pt-5">
          <GreenlineWordmark />
        </div>
      </div>
    </div>
  );
}
