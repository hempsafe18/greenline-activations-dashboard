import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1.5rem', textAlign: 'center' }}>
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
