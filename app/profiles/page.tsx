import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getActiveAmbassadors } from "@/lib/ambassadors";
import ProfilesDirectory from "./ProfilesDirectory";

const ADMIN_EMAILS = ["asmar@greenlineactivations.com", "sedell@greenlineactivations.com", "asmar.gary@gmail.com"];

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  if (!ADMIN_EMAILS.includes(email)) redirect("/");

  const ambassadors = await getActiveAmbassadors();

  return <ProfilesDirectory ambassadors={ambassadors} />;
}
