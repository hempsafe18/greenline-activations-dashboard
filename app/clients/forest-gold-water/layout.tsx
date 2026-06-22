import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Greenline Activations | Forest Gold Water Dashboard',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
