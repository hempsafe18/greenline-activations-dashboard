import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardRouter() {
  const user = await currentUser();

  if (!user) {
    redirect("/");
  }

  const email = user.emailAddresses[0]?.emailAddress;

  // Route users based on their email
  if (email === "plift@example.com") {
    redirect("/clients/plift");
  } else if (email === "3chi@example.com") {
    redirect("/clients/3chi");
  } else if (email === "gigli@example.com") {
    redirect("/clients/gigli");
  }

  // If email is not recognized
  return (
    <div style={{ padding: '3rem', textAlign: 'center' }}>
      <h1 style={{ color: '#EF4444' }}>Access Denied</h1>
      <p>Your email ({email}) is not assigned to a dashboard. Contact your Greenline manager.</p>
    </div>
  );
}
