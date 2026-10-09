import { redirect } from "next/navigation";
import { getActiveAmbassadors } from "@/lib/ambassadors";
import { getProfilesViewer } from "@/lib/viewer";
import ProfilesDirectory from "./ProfilesDirectory";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  // Greenline admins and signed-in client brand users (email domain matched to
  // a client dashboard) may browse the directory.
  const viewer = await getProfilesViewer();
  if (!viewer) redirect("/");

  const ambassadors = await getActiveAmbassadors();

  return <ProfilesDirectory ambassadors={ambassadors} dashboardHref={viewer.homeHref} />;
}
