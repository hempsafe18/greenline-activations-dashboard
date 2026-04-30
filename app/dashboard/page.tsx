import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardRouter() {
  const user = await currentUser();

  if (!user) {
    redirect("/");
  }

  const email = user.emailAddresses[0]?.emailAddress;

  // 1. ADMIN HUB - Put your personal/admin email here!
  if (email === "asmar@greenlineactivations.com") {
    return (
      <div style={{ maxWidth: '800px', margin: '3rem auto', padding: '2rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#10B981' }}>Greenline Admin Hub</h1>
        <p style={{ marginBottom: '2rem', color: '#4b5563' }}>Welcome! Select a client dashboard below to view their data:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Link href="/clients/3chi" style={{ padding: '1rem 1.5rem', border: '1px solid #e5e7eb', borderRadius: '8px', textDecoration: 'none', color: '#111', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
            3CHI Dashboard <span>→</span>
          </Link>
          <Link href="/clients/amigos" style={{ padding: '1rem 1.5rem', border: '1px solid #e5e7eb', borderRadius: '8px', textDecoration: 'none', color: '#111', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
            Amigos Dashboard <span>→</span>
          </Link>
          <Link href="/clients/gigli" style={{ padding: '1rem 1.5rem', border: '1px solid #e5e7eb', borderRadius: '8px', textDecoration: 'none', color: '#111', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
            Gigli Dashboard <span>→</span>
          </Link>
        </div>
      </div>
    );
  }

  // 2. CLIENT ROUTING
  if (email.endsWith("@plift.com")) {
    redirect("/clients/plift");
  } else if (email.endsWith("@3chi.com")) {
    redirect("/clients/3chi");
  } else if (email.endsWith("@gigli.com")) {
    redirect("/clients/gigli");
  } else if (email === "asmar@greenlineactivations.com") {
    // Don't forget your own admin routing!
    redirect("/dashboard"); // Or wherever you want to land when you log in
  } else {
    // Optional: What happens if a random person creates an account?
    // They won't match any of the above, so you can show them an error or blank page.
    redirect("/"); 
  }

  // 3. UNAUTHORIZED
  return (
    <div style={{ padding: '3rem', textAlign: 'center' }}>
      <h1 style={{ color: '#EF4444' }}>Access Denied</h1>
      <p>Your email ({email}) is not assigned to a dashboard. Contact your Greenline manager.</p>
    </div>
  );
}
