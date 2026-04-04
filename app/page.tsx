import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// 1. Added 'async' here
export default async function HomePage() {
  
  // 2. Added 'await' here
  const { userId } = await auth();

  // If the user is logged in, immediately send them to the dashboard router
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Welcome to Greenline</h1>
      <p style={{ color: '#4b5563', marginBottom: '2rem' }}>Please sign in to access your client dashboard.</p>
    </div>
  );
}
