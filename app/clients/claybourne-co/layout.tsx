import { Metadata } from 'next';
import { recordClientSession } from '@/lib/login-log';

export const metadata: Metadata = {
  title: 'Greenline Activations | Claybourne Co. Dashboard',
};

// Per-request: the layout reads the signed-in session to log client logins.
export const dynamic = 'force-dynamic';

export default async function Layout({ children }: { children: React.ReactNode }) {
  // Log this session as a client login the first time it loads a dashboard.
  await recordClientSession();
  return <>{children}</>;
}
