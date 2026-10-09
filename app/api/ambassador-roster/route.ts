import { NextResponse } from 'next/server';
import { countActiveAmbassadors } from '@/lib/ambassadors';
import { getProfilesViewer } from '@/lib/viewer';

// Roster size for the admin dashboard — the same set of ambassadors /profiles
// lists (onboarded staff profiles), not HubSpot contacts, which also include
// applicants who haven't been onboarded.
export async function GET() {
  const viewer = await getProfilesViewer();
  if (viewer?.kind !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({ count: await countActiveAmbassadors() });
}
