import { currentUser } from "@clerk/nextjs/server";

export const ADMIN_EMAILS = [
  "asmar@greenlineactivations.com",
  "sedell@greenlineactivations.com",
  "asmar.gary@gmail.com",
];

// Client email domain -> that client's dashboard. Single source of truth for
// the post-login redirect on `/` and for where "Back to Dashboard" leads from
// the ambassador profiles pages.
const CLIENT_DASHBOARDS: { domains: string[]; path: string }[] = [
  { domains: ["plift.com"], path: "/clients/plift" },
  { domains: ["3chi.com"], path: "/clients/3chi" },
  { domains: ["drinkamigos.com"], path: "/clients/amigos" },
  { domains: ["mellowfellowcannabis.com", "mfdrinks.com"], path: "/clients/mellow-fellow" },
  { domains: ["workingrelief.com"], path: "/clients/groovewagon" },
  { domains: ["drinkwillies.com"], path: "/clients/willies-remedy" },
  { domains: ["claybourneco.com"], path: "/clients/claybourne-co" },
];

const ADMIN_DOMAIN = "greenlineactivations.com";

export function clientDashboardForEmail(email: string): string | null {
  const lower = email.toLowerCase();
  const match = CLIENT_DASHBOARDS.find((c) => c.domains.some((d) => lower.endsWith(`@${d}`)));
  return match?.path ?? null;
}

/** Where a signed-in user lands after login: their client dashboard, or the admin dashboard. */
export function landingPathForEmail(email: string): string | null {
  const client = clientDashboardForEmail(email);
  if (client) return client;
  if (email.toLowerCase().endsWith(`@${ADMIN_DOMAIN}`)) return "/dashboard";
  return null;
}

export interface Viewer {
  email: string;
  kind: "admin" | "client";
  /** Dashboard this viewer should be sent back to. */
  homeHref: string;
}

/** The signed-in user if they may browse ambassador profiles (Greenline admins and client brand users). */
export async function getProfilesViewer(): Promise<Viewer | null> {
  const user = await currentUser();
  if (!user) return null;

  const email = (
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    ""
  ).toLowerCase();
  if (!email) return null;

  if (ADMIN_EMAILS.includes(email)) return { email, kind: "admin", homeHref: "/dashboard" };

  const clientPath = clientDashboardForEmail(email);
  if (clientPath) return { email, kind: "client", homeHref: clientPath };

  return null;
}
