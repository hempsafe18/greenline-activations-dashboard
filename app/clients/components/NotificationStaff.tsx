import Link from "next/link";

type StaffEntry = { name?: string; slug?: string | null; profile_url?: string | null };

// Assigned ambassadors on a client notification (metadata.staff). Links to the public
// ambassador profile only when the notification carries one; otherwise just the name.
export default function NotificationStaff({ metadata }: { metadata?: { staff?: StaffEntry[] } | null }) {
  const staff = (metadata?.staff ?? []).filter(s => s?.name);
  if (staff.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, margin: "8px 0 0" }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)" }}>Assigned</span>
      {staff.map((s, i) => {
        const href = s.profile_url || (s.slug ? `/profiles/${s.slug}` : null);
        const style = { fontSize: 11, fontWeight: 700, padding: "3px 10px", border: "2px solid var(--ink)", background: "var(--canopy-pale)", color: "var(--ink)", textDecoration: "none" } as const;
        return href
          ? <Link key={i} href={href} style={style}>{s.name} · View Profile →</Link>
          : <span key={i} style={{ ...style, background: "var(--white)" }}>{s.name}</span>;
      })}
    </div>
  );
}
