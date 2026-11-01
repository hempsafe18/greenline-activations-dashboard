import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { supabase } from '../../../lib/supabase';

const ADMIN_EMAILS = ["asmar@greenlineactivations.com", "sedell@greenlineactivations.com", "asmar.gary@gmail.com"];

// Dashboard client key -> clients.company_name
const CLIENT_COMPANY: Record<string, string> = {
  '3CHI':          '3CHI',
  AMIGOS:          'Amigos',
  'MELLOW FELLOW': 'Mellow Fellow',
  GROW:            'Grow',
  GROOVEWAGON:     'Groovewagon',
  WILLIES_REMEDY:  "Willie's Remedy",
  KICK_FIZZ:       'Kick Fizz',
  CLAYBOURNE_CO:   'Claybourne Co.',
};

async function requireAdmin() {
  const user = await currentUser();
  const email = user?.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ?? '';
  if (!user || !ADMIN_EMAILS.includes(email)) return null;
  return user;
}

// Returns the client keys that are currently inactive.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.from('clients').select('company_name, is_active');
  if (error) return NextResponse.json({ inactive: [], error: error.message }, { status: 500 });

  const inactiveNames = new Set(
    (data ?? []).filter(c => c.is_active === false).map(c => c.company_name.trim().toLowerCase())
  );
  const inactive = Object.entries(CLIENT_COMPANY)
    .filter(([, company]) => inactiveNames.has(company.toLowerCase()))
    .map(([key]) => key);

  return NextResponse.json({ inactive });
}

// Body: { client: <client key>, active: boolean }
export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const company = CLIENT_COMPANY[body?.client];
  if (!company || typeof body?.active !== 'boolean') {
    return NextResponse.json({ error: 'Invalid client or active flag' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('clients')
    .update({ is_active: body.active })
    .ilike('company_name', company)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  return NextResponse.json({ client: body.client, active: body.active });
}
