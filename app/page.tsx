import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

const BRAND_STYLE = `
  @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800,900,500&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
  .gate-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 1.5rem; text-align: center; background: #faf0ea; font-family: 'Manrope', system-ui, sans-serif; }
  .gate-card { background: #ffffff; padding: 3rem 2rem; border: 2px solid #0a0a0a; box-shadow: 6px 6px 0 0 #0a0a0a; width: 100%; max-width: 400px; }
  .gate-logo { display: block; width: 220px; height: auto; margin: 0 auto 1.75rem; }
  .gate-title { font-family: 'Cabinet Grotesk', sans-serif; font-size: 1.9rem; margin: 0 0 0.5rem; color: #0a0a0a; font-weight: 800; letter-spacing: -0.02em; }
  .gate-copy { color: #4b4b48; margin: 0 0 2.25rem; font-size: 1rem; line-height: 1.5; }
  .gate-actions { display: flex; flex-direction: column; gap: 0.85rem; }
  .gate-btn-primary { font-family: 'Cabinet Grotesk', sans-serif; padding: 15px 24px; font-size: 1rem; background: #00c853; color: #0a0a0a; border: 2px solid #0a0a0a; box-shadow: 3px 3px 0 0 #0a0a0a; cursor: pointer; font-weight: 800; width: 100%; text-transform: uppercase; letter-spacing: 0.04em; transition: all .15s; }
  .gate-btn-primary:hover { transform: translate(-2px,-2px); box-shadow: 5px 5px 0 0 #0a0a0a; }
  .gate-btn-secondary { font-family: 'Cabinet Grotesk', sans-serif; padding: 15px 24px; font-size: 1rem; background: transparent; color: #0a0a0a; border: 2px solid #0a0a0a; cursor: pointer; font-weight: 800; width: 100%; text-transform: uppercase; letter-spacing: 0.04em; transition: all .15s; }
  .gate-btn-secondary:hover { background: rgba(10,10,10,0.05); }
`;

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
      } else if (email.endsWith("@drinkamigos.com")) {
        redirect("/clients/amigos");
      } else if (email.endsWith("@growcannabis.group")) {
        redirect("/clients/grow");
      } else if (email.endsWith("@mellowfellowcannabis.com") || email.endsWith("@mfdrinks.com")) {
        redirect("/clients/mellow-fellow");
      } else if (email.endsWith("@workingrelief.com")) {
        redirect("/clients/groovewagon");
      } else if (email.endsWith("@drinkwillies.com")) {
        redirect("/clients/willies-remedy");
      } else if (email.endsWith("@greenlineactivations.com")) {
        // Admin Routing - Change this if you have a specific master dashboard!
        redirect("/dashboard");
      } else {
        // FALLBACK: If their email doesn't match any client, show Access Denied
        return (
          <div className="gate-wrap">
            <style dangerouslySetInnerHTML={{ __html: BRAND_STYLE }} />
            <div className="gate-card">
              <img src="/brand/greenline-wordmark-ink.svg" alt="Greenline Activations" className="gate-logo" />
              <h1 className="gate-title">Access Denied</h1>
              <p className="gate-copy">
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
    <div className="gate-wrap">
      <style dangerouslySetInnerHTML={{ __html: BRAND_STYLE }} />
      <div className="gate-card">
        <img src="/brand/greenline-wordmark-ink.svg" alt="Greenline Activations" className="gate-logo" />
        <p className="gate-copy">Welcome to the Activation Hub.<br/>Please sign in to access your data.</p>

        <div className="gate-actions">
          <SignInButton mode="modal">
            <button className="gate-btn-primary">Sign In</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="gate-btn-secondary">Create Account</button>
          </SignUpButton>
        </div>
      </div>
    </div>
  );
}
