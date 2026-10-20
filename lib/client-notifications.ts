import { supabase } from './supabase';

// Dashboards identify a client by key ("MELLOW FELLOW", "WILLIES_REMEDY"), but the
// database triggers (new event, staff assigned, cancelled, ...) write
// client_notifications.client_id as the client's display name ("Mellow Fellow"), and
// weekly reports are keyed by clients.id (uuid). Reads must match all three forms.
const CLIENT_COMPANY: Record<string, string> = {
  AMIGOS: 'Amigos',
  '3CHI': '3CHI',
  'MELLOW FELLOW': 'Mellow Fellow',
  GROW: 'Grow',
  GROOVEWAGON: 'Groovewagon',
  WILLIES_REMEDY: "Willie's Remedy",
  KICK_FIZZ: 'Kick Fizz',
  CLAYBOURNE_CO: 'Claybourne Co.',
  PLIFT: 'Plift',
};

export async function clientIdAliases(clientKey: string): Promise<string[]> {
  const aliases = new Set<string>([clientKey]);
  const company = CLIENT_COMPANY[clientKey];
  if (company) {
    aliases.add(company);
    const { data } = await supabase.from('clients').select('id').ilike('company_name', company);
    for (const row of data ?? []) aliases.add(row.id);
  }
  return Array.from(aliases);
}

export async function notificationBelongsToClient(clientId: string, clientKey: string): Promise<boolean> {
  return (await clientIdAliases(clientKey)).includes(clientId);
}
