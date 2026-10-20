"use client";
import { useEffect, useState } from "react";

export type DashboardTheme = "light" | "dark";

// Shared across every dashboard so the choice follows the viewer between brands.
const THEME_KEY = "greenline-dashboard-theme";

// Light (bone) is the default; dark is opt-in and remembered per browser.
// Storage can throw (private mode, blocked site data), so the page must work without it.
export function useDashboardTheme() {
  const [theme, setTheme] = useState<DashboardTheme>("light");

  useEffect(() => {
    try { if (localStorage.getItem(THEME_KEY) === "dark") setTheme("dark"); } catch {}
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  };

  // html2canvas paints its own background, so read the live theme token for PDF exports.
  const themeColor = (name: string, fallback: string) =>
    getComputedStyle(document.querySelector("[data-theme]") ?? document.body)
      .getPropertyValue(name).trim() || fallback;

  return { theme, toggleTheme, themeColor };
}

export function ThemeToggle({ theme, onToggle, className = "btn-action-primary theme-toggle" }: { theme: DashboardTheme; onToggle: () => void; className?: string }) {
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      className={className}
      onClick={onToggle}
      aria-label={`Switch to ${next} theme`}
      title={`${next[0].toUpperCase()}${next.slice(1)} theme`}
    >{theme === "dark" ? "☀" : "☾"}</button>
  );
}
