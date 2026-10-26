"use client";

import { useCallback, useEffect, useState } from "react";

const CURRENT_BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
const POLL_MS = 60_000;

/** "New version available" bar. Compares the build this tab loaded with the one /api/version reports. */
export default function UpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const { buildId } = await res.json();
      if (buildId && buildId !== CURRENT_BUILD) setUpdateReady(true);
    } catch {
      // Offline or mid-deploy: try again on the next tick.
    }
  }, []);

  useEffect(() => {
    if (!CURRENT_BUILD) return; // local dev: no build id, nothing to compare
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setDismissed(false); // "Later" only lasts until the user comes back to the tab
      check();
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") check();
    }, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [check]);

  if (!updateReady || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: "calc(12px + env(safe-area-inset-top))",
        left: 12,
        right: 12,
        margin: "0 auto",
        maxWidth: 440,
        zIndex: 4000,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: "#ffffff",
        color: "#0a0a0a",
        border: "1px solid rgba(10,10,10,0.05)",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(10,10,10,0.12)",
        fontFamily: "'Manrope', system-ui, sans-serif",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Cabinet Grotesk', 'Manrope', sans-serif", fontWeight: 800, fontSize: 14, letterSpacing: "-0.02em" }}>
          New update available
        </div>
        <div style={{ fontSize: 12, color: "rgba(10,10,10,0.6)" }}>Reload to get the latest version.</div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: "none", border: "none", color: "rgba(10,10,10,0.5)", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "8px 4px" }}
      >
        Later
      </button>
      <button
        onClick={() => window.location.reload()}
        style={{ background: "#00c853", color: "#0a0a0a", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 13, padding: "10px 16px", minHeight: 40, cursor: "pointer", fontFamily: "'Cabinet Grotesk', 'Manrope', sans-serif" }}
      >
        Reload
      </button>
    </div>
  );
}
