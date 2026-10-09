"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ADMIN_EMAILS } from "@/lib/admin-emails";

/** "Master Dashboard" sidebar link, shown only to Greenline admins browsing a client dashboard. */
export default function AdminDashboardLink() {
  const { isLoaded, user } = useUser();
  if (!isLoaded || !user) return null;

  const email = (
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    ""
  ).toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) return null;

  return (
    <Link href="/dashboard" className="nav-item" style={{ marginBottom: 12, opacity: 0.7 }}>
      <span className="icon">←</span> Master Dashboard
    </Link>
  );
}
