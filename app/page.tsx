import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default async function HomePage() {
  // 1. Use currentUser() instead of auth() so we can read their email address
  const user = await currentUser();

  if (user) {
    // 2. Safely extract their primary email address
    const email = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId
    )?.emailAddress;

    // 3. Our Enterprise Routing Logic
    if (email) {
      if (email.endsWith("@plift.com")) {
        redirect("/clients/plift");
      } else if (email.endsWith("@3chi.com")) {
        redirect("/clients/3chi");
      } else if (email.endsWith("@gigli.com")) {
        redirect("/clients/gigli");
      } else if (email === "asmar@greenlineactivations.com" || email === "asmar.gary@gmail.com") {
        // Admin Routing - Change this if you have a specific master dashboard!
        redirect("/clients/3chi"); 
      } else {
        // FALLBACK: If their email doesn't match any client, show Access Denied
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1.5rem', textAlign: 'center', backgroundColor: '#f5f4ef' }}>
            <div style={{ backgroundColor: 'white', padding: '3rem 2rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px' }}>
              <h1 style={{ fontSize: '2.25rem', marginBottom: '0.5rem', color: '#111', fontWeight: '800' }}>Access Denied</h1>
              <p style={{ color: '#4b5563', marginBottom: '2.5rem', fontSize: '1.05rem', lineHeight: '1.5' }}>
                Your email <b>({email})</b> is not authorized for any client dashboards. Please contact your Greenline representative.
              </p>
              {/* Gives them a way to sign out of the unauthorized account */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <UserButton /> 
              </div>
            </div>
          </div>
        );
      }
    }
  }

  // 4. If they are NOT logged in, show the standard mobile-friendly Login UI
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1.5rem', textAlign: 'center', backgroundColor: '#f5f4ef' }}>
      <div style={{ backgroundColor: 'white', padding: '3rem 2rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px' }}>
        <h1 style={{ fontSize: '2.25rem', marginBottom: '0.5rem', color: '#111', fontWeight: '800', letterSpacing: '-0.02em' }}>Greenline</h1>
        <p style={{ color: '#4b5563', marginBottom: '2.5rem', fontSize: '1.05rem', lineHeight: '1.5' }}>Welcome to the Activation Hub.<br/>Please sign in to access your data.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SignInButton mode="modal">
            <button style={{ padding: '16px 24px', fontSize: '1.1rem', backgroundColor: '#2d5f3f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>Sign In</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button style={{ padding: '16px 24px', fontSize: '1.1rem', backgroundColor: 'transparent', color: '#2d5f3f', border: '2px solid #2d5f3f', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>Create Account</button>
          </SignUpButton>
        </div>
      </div>
    </div>
  );
}
