import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Greenline Activations | GrooveWagon Dashboard',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
