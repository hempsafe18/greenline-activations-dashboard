import { describeExperience } from "@/lib/ambassador-format";

export default function ExperienceTag({ experience }: { experience: string | null }) {
  const exp = describeExperience(experience);
  if (!exp) return null;
  return (
    <span className="inline-block rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-bold text-ink">
      {exp.label}
      {exp.detail ? <span className="font-semibold text-ink/50"> · {exp.detail}</span> : null}
    </span>
  );
}
