import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ambassador Profiles | Greenline Activations",
};

export default function ProfilesLayout({ children }: { children: React.ReactNode }) {
  return <div className="profiles-scope">{children}</div>;
}
