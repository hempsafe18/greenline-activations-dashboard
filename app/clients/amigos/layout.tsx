import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Greenline Activations | Amigos Dashboard',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
