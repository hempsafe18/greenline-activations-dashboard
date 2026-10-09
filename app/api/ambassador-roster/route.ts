import { NextResponse } from 'next/server';
import { countActiveAmbassadors } from '@/lib/ambassadors';
import { getProfilesViewer } from '@/lib/viewer';

// Roster size for the admin dashboard — all onboarded, active staff profiles
// (certified or not), not HubSpot contacts, which also include applicants who
// haven't been onboarded. /profiles lists only the certified subset.
export async function GET() {
  const viewer = await getProfilesViewer();
  if (viewer?.kind !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({ count: await countActiveAmbassadors() });
}
