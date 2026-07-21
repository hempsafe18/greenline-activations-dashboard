"use client";
import { useState, useEffect } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";

// ─── Client Data Sources ─────────────────────────────────────────
// Stats are now loaded from Supabase via /api/dashboard-stats rather than
// from hardcoded Google Sheets CSV exports, so all data stays in sync with
// what the team portal writes.
const CLIENTS = [
  { id: "3chi",         name: "3CHI",         clientKey: "3CHI",         color: "#56e39f", icon: "🌿", href: "/clients/3chi" },
  { id: "amigos",       name: "AMIGOS",       clientKey: "AMIGOS",       color: "#ff4f33", icon: "🍹", href: "/clients/amigos" },
  { id: "mellow-fellow",  name: "MELLOW FELLOW",  clientKey: "MELLOW FELLOW",  color: "#9b59b6", icon: "😌", href: "/clients/mellow-fellow" },
  { id: "groovewagon",    name: "GROOVEWAGON",    clientKey: "GROOVEWAGON",    color: "#0d9488", icon: "🎵", href: "/clients/groovewagon" },
  { id: "willies-remedy", name: "WILLIE'S REMEDY", clientKey: "WILLIES_REMEDY", color: "#0284c7", icon: "🍃", href: "/clients/willies-remedy" },
];

const ADMIN_EMAILS = ["asmar@greenlineactivations.com", "sedell@greenlineactivations.com", "asmar.gary@gmail.com"];

interface ClientStats {
  name: string; color: string; icon: string; href: string;
  activations: number; sampled: number; sold: number; conversion: number;
  uniqueCities: string[]; cityActivations: Record<string, number>;
  upcoming: number; monthlyData: Record<string, number>;
}

const CLIENT_IDS = ["3CHI", "AMIGOS", "MELLOW FELLOW", "GROW", "GROOVEWAGON", "WILLIES_REMEDY"];

interface NotifyForm {
  type: "event" | "staff" | "recap";
  client: string;
  storeName: string;
  eventDate: string;
  staffName: string;
  staffRole: string;
  submittedBy: string;
  sampled: string;
  sold: string;
  notes: string;
}

export default function AdminDashboard() {
  const { user, isLoaded } = useUser();
  const [clientStats, setClientStats] = useState<ClientStats[]>([]);
  const [ambassadors, setAmbassadors] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [notifyForm, setNotifyForm] = useState<NotifyForm>({
    type: "event", client: "3CHI", storeName: "", eventDate: "",
    staffName: "", staffRole: "", submittedBy: "", sampled: "", sold: "", notes: "",
  });
  const [notifySending, setNotifySending] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState("");

  // Client-side auth guard
  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { window.location.href = "/"; return; }
    // Use the primary email, matching app/page.tsx's routing check — using
    // emailAddresses[0] here instead caused a redirect loop for any account
    // where the first-added email isn't the primary one.
    const email = user.primaryEmailAddress?.emailAddress ?? "";
    if (!ADMIN_EMAILS.includes(email)) { window.location.href = "/"; }
  }, [isLoaded, user]);

  const fetchAll = async () => {
    setIsLoading(true);

    // Fetch ambassador count in parallel (non-blocking)
    fetch("/api/hubspot-ambassadors")
      .then(r => r.json())
      .then(d => setAmbassadors(d.count ?? 0))
      .catch(() => setAmbassadors(0));

    const results: ClientStats[] = await Promise.all(
      CLIENTS.map(async (client) => {
        try {
          const res = await fetch(`/api/dashboard-stats?client=${client.clientKey}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const { activations = 0, sampled = 0, sold = 0, upcoming = 0, cityActivations = {}, monthlyData = {} } = data;
          return {
            name: client.name, color: client.color, icon: client.icon, href: client.href,
            activations, sampled, sold,
            conversion: sampled > 0 ? Math.round((sold / sampled) * 100) : 0,
            uniqueCities: Object.keys(cityActivations),
            cityActivations, upcoming, monthlyData,
          };
        } catch (e) {
          console.error(`Error fetching stats for ${client.name}:`, e);
          return {
            name: client.name, color: client.color, icon: client.icon, href: client.href,
            activations: 0, sampled: 0, sold: 0, conversion: 0,
            uniqueCities: [], cityActivations: {}, upcoming: 0, monthlyData: {},
          };
        }
      })
    );

    setClientStats(results);
    setLastUpdated(new Date().toLocaleTimeString());
    setIsLoading(false);
  };

  useEffect(() => { if (isLoaded && user) fetchAll(); }, [isLoaded]);

  const sendClientNotification = async () => {
    const { type, client, storeName, eventDate, staffName, staffRole, submittedBy, sampled, sold, notes } = notifyForm;
    if (!client || !storeName || !eventDate) { setNotifyMsg("Client, Store Name, and Event Date are required."); return; }
    setNotifySending(true);
    setNotifyMsg("");
    try {
      let endpoint = "/api/request";
      let payload: Record<string, string> = {};
      if (type === "event") {
        endpoint = "/api/request";
        payload = { client, storeName, date: eventDate, notes, requestType: "New Activation Request" };
      } else if (type === "staff") {
        endpoint = "/api/staff-assign";
        payload = { client, storeName, eventDate, staffName, staffRole, notes };
      } else {
        endpoint = "/api/recap";
        payload = { client, storeName, eventDate, submittedBy, sampled, sold, notes };
      }
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) {
        setNotifyMsg(`✅ Notification sent to ${client} dashboard.`);
        setNotifyForm(f => ({ ...f, storeName: "", eventDate: "", staffName: "", staffRole: "", submittedBy: "", sampled: "", sold: "", notes: "" }));
      } else {
        setNotifyMsg(`❌ Failed: ${data.error || "Unknown error"}`);
      }
    } catch { setNotifyMsg("❌ Network error."); }
    setNotifySending(false);
  };

  // ─── Derived aggregates ──────────────────────────────────────────
  const totalActivations  = clientStats.reduce((s, c) => s + c.activations, 0);
  const totalSampled      = clientStats.reduce((s, c) => s + c.sampled, 0);
  const totalSold         = clientStats.reduce((s, c) => s + c.sold, 0);
  const totalUpcoming     = clientStats.reduce((s, c) => s + c.upcoming, 0);
  const allCities         = new Set(clientStats.flatMap(c => c.uniqueCities));
  const avgConversion     = totalSampled > 0 ? Math.round((totalSold / totalSampled) * 100) : 0;
  const avgPerActivation  = totalActivations > 0 ? Math.round(totalSampled / totalActivations) : 0;

  const allMonthly: Record<string, number> = {};
  clientStats.forEach(c => Object.entries(c.monthlyData).forEach(([k, v]) => {
    allMonthly[k] = (allMonthly[k] || 0) + v;
  }));
  const sortedMonths   = Object.keys(allMonthly).sort().slice(-8);
  const maxMonthCount  = Math.max(...sortedMonths.map(m => allMonthly[m]), 1);

  const allCityMap: Record<string, number> = {};
  clientStats.forEach(c => Object.entries(c.cityActivations).forEach(([city, n]) => {
    allCityMap[city] = (allCityMap[city] || 0) + n;
  }));
  const topCities     = Object.entries(allCityMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCityCount  = Math.max(...topCities.map(c => c[1]), 1);
  const maxActivations = Math.max(...clientStats.map(c => c.activations), 1);

  const allCitiesArr = Array.from(allCities);

  if (!isLoaded) return null;

  return (
    <div className="admin-wrap">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800,900,500&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        .admin-wrap {
          --bone:#faf0ea; --ink:#0a0a0a; --white:#ffffff;
          --canopy:#56e39f; --canopy-pale:#d6f8ea;
          --street:#ff4f33; --street-pale:#ffe3de;
          --muted:#767672; --card:#ffffff;
          --shadow:4px 4px 0 0 #0a0a0a; --shadow-lg:6px 6px 0 0 #0a0a0a;
          font-family:'Manrope',system-ui,sans-serif;
          background:var(--bone); color:var(--ink);
          min-height:100vh; position:absolute; top:0; left:0; right:0; z-index:10;
          -webkit-font-smoothing:antialiased;
        }
        .admin-wrap * { box-sizing:border-box; }

        /* ── Sidebar ── */
        .adm-sidebar { position:fixed; top:0; left:0; width:220px; height:100vh; background:var(--ink); padding:28px 20px; display:flex; flex-direction:column; z-index:100; overflow-y:auto; }
        .adm-logo { font-family:'Cabinet Grotesk',sans-serif; font-size:10px; font-weight:700; color:rgba(250,240,234,.45); letter-spacing:.14em; text-transform:uppercase; margin:0 0 4px; }
        .adm-brand { font-family:'Cabinet Grotesk',sans-serif; font-size:19px; font-weight:800; color:var(--bone); margin:0 0 32px; letter-spacing:-.02em; line-height:1.2; }
        .adm-nav-label { font-size:9px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:rgba(250,240,234,.3); margin:20px 0 8px; }
        .adm-nav-item { display:flex; align-items:center; gap:10px; padding:9px 12px; font-size:11px; font-weight:700; color:rgba(250,240,234,.6); text-decoration:none; text-transform:uppercase; letter-spacing:.06em; border:2px solid transparent; margin-bottom:2px; transition:all .15s; cursor:pointer; }
        .adm-nav-item:hover { background:rgba(250,240,234,.08); color:var(--bone); }
        .adm-nav-item.active { background:var(--canopy); color:var(--ink); border-color:var(--canopy); }
        .adm-nav-dot { width:8px; height:8px; border-radius:50%; border:2px solid rgba(250,240,234,.4); flex-shrink:0; }
        .adm-divider { border:none; border-top:1px solid rgba(250,240,234,.12); margin:16px 0; }

        /* ── Main ── */
        .adm-main { margin-left:220px; padding:32px; min-height:100vh; }

        /* ── Topbar ── */
        .adm-topbar { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:28px; }
        .adm-topbar-title { font-family:'Cabinet Grotesk',sans-serif; font-size:28px; font-weight:800; color:var(--ink); margin:0; letter-spacing:-.02em; }
        .adm-topbar-sub { font-size:12px; font-weight:500; color:var(--muted); margin:4px 0 0; }
        .adm-topbar-right { display:flex; align-items:center; gap:12px; }
        .adm-live-dot { width:8px; height:8px; background:var(--canopy); border-radius:50%; border:2px solid var(--ink); }
        .adm-btn-sync { background:var(--white); border:2px solid var(--ink); padding:8px 16px; font-size:10px; font-weight:700; cursor:pointer; color:var(--ink); transition:all .15s; display:flex; align-items:center; gap:6px; box-shadow:3px 3px 0 0 var(--ink); text-transform:uppercase; letter-spacing:.05em; font-family:'Manrope',sans-serif; }
        .adm-btn-sync:hover { transform:translate(-2px,-2px); box-shadow:4px 4px 0 0 var(--ink); }
        .adm-btn-sync:active { transform:none; box-shadow:none; }

        /* ── Stat Grid ── */
        .adm-stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:14px; }
        .adm-stat-card { background:var(--card); border:2px solid var(--ink); padding:20px 22px; box-shadow:var(--shadow); }
        .adm-stat-card.ac-green { background:var(--canopy); }
        .adm-stat-card.ac-red { background:var(--street); }
        .adm-stat-card.ac-dark { background:var(--ink); }
        .adm-stat-label { font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.12em; margin:0 0 10px; }
        .adm-stat-card.ac-green .adm-stat-label,
        .adm-stat-card.ac-red .adm-stat-label { color:rgba(10,10,10,.5); }
        .adm-stat-card.ac-dark .adm-stat-label { color:rgba(250,240,234,.4); }
        .adm-stat-value { font-family:'Cabinet Grotesk',sans-serif; font-size:38px; font-weight:800; color:var(--ink); line-height:1; margin:0 0 4px; letter-spacing:-.02em; }
        .adm-stat-card.ac-dark .adm-stat-value { color:var(--canopy); }
        .adm-stat-sub { font-size:11px; font-weight:500; color:var(--muted); margin:0; }
        .adm-stat-card.ac-green .adm-stat-sub,
        .adm-stat-card.ac-red .adm-stat-sub { color:rgba(10,10,10,.5); }
        .adm-stat-card.ac-dark .adm-stat-sub { color:rgba(250,240,234,.4); }

        /* ── Card ── */
        .adm-card { background:var(--card); border:2px solid var(--ink); padding:22px; box-shadow:var(--shadow); margin-bottom:14px; }
        .adm-card-title { font-family:'Cabinet Grotesk',sans-serif; font-size:15px; font-weight:800; color:var(--ink); margin:0 0 2px; letter-spacing:-.02em; }
        .adm-card-sub { font-size:11px; font-weight:500; color:var(--muted); margin:0 0 18px; }

        /* ── Vertical Bar Chart ── */
        .adm-vbars { display:flex; align-items:flex-end; gap:10px; height:130px; padding-bottom:24px; position:relative; }
        .adm-vbars::after { content:''; position:absolute; bottom:24px; left:0; right:0; height:2px; background:var(--ink); }
        .adm-vbar-col { flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; }
        .adm-vbar-fill { width:100%; border:2px solid var(--ink); border-bottom:none; transition:height .6s ease; position:relative; min-height:4px; }
        .adm-vbar-val { position:absolute; top:-20px; left:50%; transform:translateX(-50%); font-size:10px; font-weight:700; color:var(--ink); white-space:nowrap; }
        .adm-vbar-label { font-size:10px; font-weight:700; color:var(--muted); margin-top:6px; text-align:center; text-transform:uppercase; letter-spacing:.05em; }

        /* ── Horizontal Bar Chart ── */
        .adm-hbar-row { display:flex; align-items:center; gap:10px; margin-bottom:9px; }
        .adm-hbar-label { font-size:11px; font-weight:700; color:var(--ink); width:85px; flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .adm-hbar-track { flex:1; height:22px; background:rgba(10,10,10,.06); border:2px solid var(--ink); position:relative; overflow:hidden; }
        .adm-hbar-fill { height:100%; transition:width .6s ease; }
        .adm-hbar-val { font-size:10px; font-weight:700; color:var(--muted); width:52px; text-align:right; flex-shrink:0; }

        /* ── Status Overview ── */
        .adm-status-row { display:flex; gap:16px; }
        .adm-status-item { flex:1; background:var(--bone); border:2px solid var(--ink); padding:14px 16px; display:flex; flex-direction:column; gap:4px; }
        .adm-status-num { font-family:'Cabinet Grotesk',sans-serif; font-size:28px; font-weight:800; color:var(--ink); line-height:1; }
        .adm-status-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); }
        .adm-status-bar { height:4px; border:1px solid var(--ink); margin-top:6px; }

        /* ── Client Breakdown Table ── */
        .adm-table { width:100%; border-collapse:collapse; }
        .adm-table th { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.12em; color:var(--muted); padding:8px 12px; text-align:left; border-bottom:2px solid var(--ink); white-space:nowrap; }
        .adm-table td { font-size:13px; font-weight:500; padding:13px 12px; border-bottom:1px solid rgba(10,10,10,.08); vertical-align:middle; }
        .adm-table tr:last-child td { border-bottom:none; }
        .adm-table tr:hover td { background:rgba(10,10,10,.02); }
        .adm-client-name { font-family:'Cabinet Grotesk',sans-serif; font-weight:800; font-size:14px; display:flex; align-items:center; gap:8px; }
        .adm-client-dot { width:10px; height:10px; border-radius:50%; border:2px solid var(--ink); flex-shrink:0; }
        .adm-conv-wrap { display:flex; align-items:center; gap:8px; }
        .adm-conv-bar { height:6px; width:60px; background:rgba(10,10,10,.06); border:1px solid var(--ink); position:relative; overflow:hidden; }
        .adm-conv-fill { height:100%; }
        .adm-open-btn { display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700; color:var(--ink); text-decoration:none; padding:5px 10px; border:2px solid var(--ink); text-transform:uppercase; letter-spacing:.05em; background:var(--white); box-shadow:2px 2px 0 0 var(--ink); transition:all .15s; }
        .adm-open-btn:hover { transform:translate(-1px,-1px); box-shadow:3px 3px 0 0 var(--ink); }

        /* ── Bottom Quick Links ── */
        .adm-quick-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; margin-top:14px; }
        .adm-quick-card { background:var(--white); border:2px solid var(--ink); padding:20px 22px; text-decoration:none; color:var(--ink); box-shadow:var(--shadow); display:flex; justify-content:space-between; align-items:center; font-family:'Cabinet Grotesk',sans-serif; font-weight:800; font-size:15px; transition:all .15s; }
        .adm-quick-card:hover { transform:translate(-2px,-2px); box-shadow:var(--shadow-lg); }

        /* ── Notify Panel ── */
        .adm-notify-tabs { display:flex; gap:0; margin-bottom:18px; border:2px solid var(--ink); overflow:hidden; }
        .adm-notify-tab { flex:1; padding:10px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; background:var(--bone); border:none; cursor:pointer; border-right:2px solid var(--ink); font-family:'Manrope',sans-serif; }
        .adm-notify-tab:last-child { border-right:none; }
        .adm-notify-tab.active { background:var(--ink); color:var(--bone); }
        .adm-notify-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
        .adm-notify-group { display:flex; flex-direction:column; gap:5px; }
        .adm-notify-group.full { grid-column:1/-1; }
        .adm-notify-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); }
        .adm-notify-input { border:2px solid var(--ink); padding:8px 10px; font-size:13px; font-family:'Manrope',sans-serif; outline:none; width:100%; background:var(--white); }
        .adm-notify-select { border:2px solid var(--ink); padding:8px 10px; font-size:13px; font-family:'Manrope',sans-serif; outline:none; width:100%; background:var(--white); }
        .adm-notify-msg { font-size:12px; font-weight:600; margin-top:10px; }

        /* ── Loading ── */
        .adm-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:360px; gap:16px; }
        .adm-spinner { border:4px solid rgba(10,10,10,.1); width:40px; height:40px; border-left-color:var(--ink); animation:adm-spin 1s linear infinite; }
        @keyframes adm-spin { to { transform:rotate(360deg); } }

        /* ── Grid layouts ── */
        .adm-two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }

        /* ── Tablet (900px and below) ── */
        @media (max-width:900px) {
          .adm-sidebar { display:none; }
          .adm-main { margin-left:0; padding:20px; }
          .adm-stat-grid { grid-template-columns:1fr 1fr; }
          .adm-two-col { grid-template-columns:1fr; }
          .adm-topbar { flex-direction:column; gap:12px; }
          .adm-topbar-title { font-size:24px; }
          .adm-topbar-right { width:100%; justify-content:flex-start; }
          .adm-card { padding:16px; }
          .adm-stat-card { padding:16px 18px; }
          .adm-stat-value { font-size:32px; }
          .adm-vbars { height:120px; }
          .adm-status-row { gap:12px; }
          .adm-status-item { padding:12px 14px; }
          .adm-status-num { font-size:24px; }
          .adm-hbar-label { width:70px; font-size:10px; }
          .adm-hbar-val { width:45px; }
          .adm-notify-grid { grid-template-columns:1fr; }
          .adm-table th, .adm-table td { padding:10px 8px; font-size:12px; }
          .adm-quick-grid { grid-template-columns:1fr; }
        }

        /* ── Mobile (600px and below) ── */
        @media (max-width:600px) {
          .admin-wrap { position:static; }
          .adm-main { padding:14px; margin-left:0; }
          .adm-topbar-title { font-size:20px; }
          .adm-topbar-sub { font-size:11px; }
          .adm-btn-sync { padding:6px 12px; font-size:9px; box-shadow:2px 2px 0 0 var(--ink); }
          .adm-stat-grid { grid-template-columns:1fr; gap:10px; margin-bottom:10px; }
          .adm-stat-card { padding:14px 16px; }
          .adm-stat-value { font-size:28px; }
          .adm-stat-label { font-size:9px; margin-bottom:6px; }
          .adm-stat-sub { font-size:10px; }
          .adm-card { padding:14px; margin-bottom:10px; box-shadow:2px 2px 0 0 var(--ink); }
          .adm-card-title { font-size:14px; }
          .adm-card-sub { font-size:10px; margin-bottom:12px; }
          .adm-vbars { height:110px; gap:8px; padding-bottom:20px; }
          .adm-vbar-fill { min-height:3px; }
          .adm-vbar-val { font-size:9px; top:-18px; }
          .adm-vbar-label { font-size:9px; }
          .adm-hbar-row { gap:8px; margin-bottom:8px; }
          .adm-hbar-label { width:60px; font-size:9px; }
          .adm-hbar-track { height:20px; }
          .adm-hbar-val { width:40px; font-size:9px; }
          .adm-status-row { flex-direction:column; gap:10px; }
          .adm-status-item { padding:10px 12px; }
          .adm-status-num { font-size:22px; }
          .adm-status-label { font-size:9px; }
          .adm-table { font-size:11px; }
          .adm-table th { padding:6px 4px; font-size:8px; }
          .adm-table td { padding:8px 4px; }
          .adm-client-name { font-size:13px; }
          .adm-open-btn { font-size:9px; padding:4px 8px; }
          .adm-notify-tabs { margin-bottom:12px; }
          .adm-notify-tab { padding:8px 6px; font-size:9px; }
          .adm-notify-grid { gap:8px; }
          .adm-notify-label { font-size:9px; }
          .adm-notify-input, .adm-notify-select { padding:6px 8px; font-size:12px; }
          .adm-quick-grid { gap:8px; margin-top:10px; }
          .adm-quick-card { padding:14px 12px; font-size:13px; }
        }

        /* ── Extra small (480px and below) ── */
        @media (max-width:480px) {
          .adm-main { padding:10px; }
          .adm-topbar { gap:8px; }
          .adm-topbar-title { font-size:18px; }
          .adm-topbar-right { flex-direction:column; gap:8px; width:100%; }
          .adm-btn-sync { width:100%; justify-content:center; }
          .adm-stat-grid { gap:8px; }
          .adm-stat-card { padding:12px 14px; }
          .adm-stat-value { font-size:24px; }
          .adm-card { padding:12px; }
          .adm-vbars { height:100px; }
          .adm-hbar-row { gap:6px; }
          .adm-table { display:block; overflow-x:auto; }
          .adm-quick-card { flex-direction:column; text-align:center; gap:8px; }
        }

        /* ── Bottom Menu ── */
        .adm-bottom-menu { display:none; }
        @media (max-width:600px) {
          .adm-bottom-menu { position:fixed; bottom:0; left:0; right:0; background:var(--ink); border-top:2px solid var(--ink); display:flex; justify-content:space-around; align-items:center; z-index:90; height:70px; }
          .adm-menu-item { display:flex; flex-direction:column; align-items:center; gap:4px; text-decoration:none; color:rgba(250,240,234,.6); font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; flex:1; height:100%; justify-content:center; transition:all .15s; border:none; background:none; cursor:pointer; font-family:'Manrope',sans-serif; }
          .adm-menu-item:hover { background:rgba(250,240,234,.08); color:var(--bone); }
          .adm-menu-item.active { background:var(--canopy); color:var(--ink); }
          .adm-menu-item-icon { font-size:16px; margin-bottom:2px; }
        }
      `}} />

      {/* ── Sidebar ── */}
      <div className="adm-sidebar">
        <p className="adm-logo">Greenline Activations</p>
        <p className="adm-brand">Admin Hub</p>
        <p className="adm-nav-label">Overview</p>
        <a className="adm-nav-item active"><span>📊</span> Master Dashboard</a>
        <hr className="adm-divider" />
        <p className="adm-nav-label">Client Portals</p>
        {CLIENTS.map(c => (
          <Link key={c.id} className="adm-nav-item" href={c.href}>
            <span className="adm-nav-dot" style={{ background: c.color }} />
            {c.name}
          </Link>
        ))}
        <hr className="adm-divider" />
        <p className="adm-nav-label">Sales Dashboards</p>
        <Link className="adm-nav-item" href="/clients/grow">
          <span className="adm-nav-dot" style={{ background: "#d97706" }} />
          GROW
        </Link>
        <hr className="adm-divider" />
        <p className="adm-nav-label">Account</p>
        <div style={{ padding: "8px 12px" }}><UserButton /></div>
      </div>

      {/* ── Main ── */}
      <div className="adm-main">

        {/* Topbar */}
        <div className="adm-topbar">
          <div>
            <h1 className="adm-topbar-title">Master Dashboard</h1>
            <p className="adm-topbar-sub">
              {lastUpdated ? `Synced at ${lastUpdated}` : "Loading..."}{" · "}
              {CLIENTS.length} brands · {allCitiesArr.length} markets
            </p>
          </div>
          <div className="adm-topbar-right">
            <div className="adm-live-dot" />
            <button className="adm-btn-sync" onClick={fetchAll} disabled={isLoading}>
              {isLoading ? "⟳ Syncing..." : "↻ Sync All"}
            </button>
            <UserButton />
          </div>
        </div>

        {isLoading ? (
          <div className="adm-loading">
            <div className="adm-spinner" />
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
              Fetching data from all sources...
            </p>
          </div>
        ) : (
          <>
            {/* ── Operations Stats ── */}
            <div className="adm-stat-grid">
              <div className="adm-stat-card">
                <p className="adm-stat-label">Total Activations</p>
                <p className="adm-stat-value">{totalActivations}</p>
                <p className="adm-stat-sub">Completed across all brands</p>
              </div>
              <div className="adm-stat-card ac-green">
                <p className="adm-stat-label">Upcoming</p>
                <p className="adm-stat-value">{totalUpcoming}</p>
                <p className="adm-stat-sub">Activations scheduled</p>
              </div>
              <div className="adm-stat-card ac-dark">
                <p className="adm-stat-label">Ambassador Roster</p>
                <p className="adm-stat-value">{ambassadors === null ? "—" : ambassadors}</p>
                <p className="adm-stat-sub">Brand ambassadors on file</p>
              </div>
              <div className="adm-stat-card">
                <p className="adm-stat-label">Active Markets</p>
                <p className="adm-stat-value">{allCitiesArr.length}</p>
                <p className="adm-stat-sub">
                  {allCitiesArr.slice(0, 2).join(", ")}
                  {allCitiesArr.length > 2 ? ` +${allCitiesArr.length - 2}` : ""}
                </p>
              </div>
            </div>

            {/* ── Performance Stats ── */}
            <div className="adm-stat-grid">
              <div className="adm-stat-card">
                <p className="adm-stat-label">Consumers Sampled</p>
                <p className="adm-stat-value">{totalSampled.toLocaleString()}</p>
                <p className="adm-stat-sub">Across all activations</p>
              </div>
              <div className="adm-stat-card ac-green">
                <p className="adm-stat-label">Total Purchases</p>
                <p className="adm-stat-value">{totalSold.toLocaleString()}</p>
                <p className="adm-stat-sub">Units sold at events</p>
              </div>
              <div className="adm-stat-card">
                <p className="adm-stat-label">Avg Conversion Rate</p>
                <p className="adm-stat-value">{avgConversion}%</p>
                <p className="adm-stat-sub">Sampled → Purchased</p>
              </div>
              <div className="adm-stat-card">
                <p className="adm-stat-label">Avg per Activation</p>
                <p className="adm-stat-value">{avgPerActivation}</p>
                <p className="adm-stat-sub">Consumers sampled per event</p>
              </div>
            </div>

            {/* ── Charts Row 1: Activations + Conversion ── */}
            <div className="adm-two-col">
              <div className="adm-card">
                <p className="adm-card-title">Activations by Brand</p>
                <p className="adm-card-sub">Completed activations per client</p>
                <div className="adm-vbars">
                  {clientStats.map(c => (
                    <div className="adm-vbar-col" key={c.name}>
                      <div
                        className="adm-vbar-fill"
                        style={{ height: `${(c.activations / maxActivations) * 100}%`, background: c.color }}
                      >
                        <span className="adm-vbar-val">{c.activations}</span>
                      </div>
                      <p className="adm-vbar-label">{c.name}</p>
                    </div>
                  ))}
                  {clientStats.length === 0 && (
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>No data</p>
                  )}
                </div>
              </div>

              <div className="adm-card">
                <p className="adm-card-title">Conversion Rate by Brand</p>
                <p className="adm-card-sub">Units sold ÷ consumers sampled</p>
                <div style={{ marginTop: 8 }}>
                  {clientStats.map(c => (
                    <div className="adm-hbar-row" key={c.name}>
                      <span className="adm-hbar-label">{c.name}</span>
                      <div className="adm-hbar-track">
                        <div
                          className="adm-hbar-fill"
                          style={{ width: `${Math.min(c.conversion, 100)}%`, background: c.color }}
                        />
                      </div>
                      <span className="adm-hbar-val">{c.conversion}%</span>
                    </div>
                  ))}
                  {clientStats.length === 0 && (
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>No data</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Charts Row 2: Monthly Trend + Top Markets ── */}
            <div className="adm-two-col">
              <div className="adm-card">
                <p className="adm-card-title">Monthly Activation Volume</p>
                <p className="adm-card-sub">All brands combined — last 8 months</p>
                <div className="adm-vbars">
                  {sortedMonths.map(month => (
                    <div className="adm-vbar-col" key={month}>
                      <div
                        className="adm-vbar-fill"
                        style={{ height: `${(allMonthly[month] / maxMonthCount) * 100}%`, background: "var(--canopy)" }}
                      >
                        <span className="adm-vbar-val">{allMonthly[month]}</span>
                      </div>
                      <p className="adm-vbar-label">{month.slice(5)}/{month.slice(2, 4)}</p>
                    </div>
                  ))}
                  {sortedMonths.length === 0 && (
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>No date data yet</p>
                  )}
                </div>
              </div>

              <div className="adm-card">
                <p className="adm-card-title">Top Markets</p>
                <p className="adm-card-sub">Total activations by city, all brands</p>
                <div style={{ marginTop: 8 }}>
                  {topCities.map(([city, count]) => (
                    <div className="adm-hbar-row" key={city}>
                      <span className="adm-hbar-label">{city}</span>
                      <div className="adm-hbar-track">
                        <div
                          className="adm-hbar-fill"
                          style={{ width: `${(count / maxCityCount) * 100}%`, background: "var(--canopy)" }}
                        />
                      </div>
                      <span className="adm-hbar-val">{count} acts</span>
                    </div>
                  ))}
                  {topCities.length === 0 && (
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>No market data yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Activation Status Summary ── */}
            <div className="adm-card">
              <p className="adm-card-title">Activation Status Overview</p>
              <p className="adm-card-sub">Across all brands</p>
              <div className="adm-status-row">
                <div className="adm-status-item" style={{ borderLeft: "4px solid var(--canopy)" }}>
                  <span className="adm-status-label">Completed</span>
                  <span className="adm-status-num">{totalActivations}</span>
                  <div className="adm-status-bar" style={{ background: "rgba(10,10,10,.06)" }}>
                    <div style={{ height: "100%", width: "100%", background: "var(--canopy)" }} />
                  </div>
                </div>
                <div className="adm-status-item" style={{ borderLeft: "4px solid var(--street)" }}>
                  <span className="adm-status-label">Upcoming / Scheduled</span>
                  <span className="adm-status-num">{totalUpcoming}</span>
                  <div className="adm-status-bar" style={{ background: "rgba(10,10,10,.06)" }}>
                    <div style={{
                      height: "100%",
                      width: totalActivations + totalUpcoming > 0
                        ? `${(totalUpcoming / (totalActivations + totalUpcoming)) * 100}%`
                        : "0%",
                      background: "var(--street)"
                    }} />
                  </div>
                </div>
                <div className="adm-status-item" style={{ borderLeft: "4px solid var(--ink)" }}>
                  <span className="adm-status-label">Brands Active</span>
                  <span className="adm-status-num">{CLIENTS.length}</span>
                  <div className="adm-status-bar" style={{ background: "rgba(10,10,10,.06)" }}>
                    <div style={{ height: "100%", width: "100%", background: "var(--ink)" }} />
                  </div>
                </div>
                <div className="adm-status-item" style={{ borderLeft: "4px solid rgba(10,10,10,.3)" }}>
                  <span className="adm-status-label">Ambassadors on Roster</span>
                  <span className="adm-status-num" style={{ color: ambassadors === null ? "var(--muted)" : "var(--ink)" }}>
                    {ambassadors === null ? "—" : ambassadors}
                  </span>
                  <div className="adm-status-bar" style={{ background: "rgba(10,10,10,.06)" }}>
                    <div style={{ height: "100%", width: ambassadors ? "100%" : "0%", background: "var(--ink)" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Client Breakdown Table ── */}
            <div className="adm-card">
              <p className="adm-card-title">Brand Performance Breakdown</p>
              <p className="adm-card-sub">All-time metrics per client</p>
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Activations</th>
                    <th>Sampled</th>
                    <th>Purchases</th>
                    <th>Conversion</th>
                    <th>Markets</th>
                    <th>Upcoming</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clientStats.map(c => (
                    <tr key={c.name}>
                      <td>
                        <div className="adm-client-name">
                          <div className="adm-client-dot" style={{ background: c.color }} />
                          {c.icon} {c.name}
                        </div>
                      </td>
                      <td><strong>{c.activations}</strong></td>
                      <td>{c.sampled.toLocaleString()}</td>
                      <td>{c.sold.toLocaleString()}</td>
                      <td>
                        <div className="adm-conv-wrap">
                          <div className="adm-conv-bar">
                            <div className="adm-conv-fill" style={{ width: `${c.conversion}%`, background: c.color }} />
                          </div>
                          <strong>{c.conversion}%</strong>
                        </div>
                      </td>
                      <td>{c.uniqueCities.length}</td>
                      <td>
                        <span style={{
                          display: "inline-block", fontSize: 9, fontWeight: 700, padding: "3px 8px",
                          border: "2px solid var(--ink)", textTransform: "uppercase", letterSpacing: ".06em",
                          background: c.upcoming > 0 ? "var(--canopy)" : "rgba(10,10,10,.06)"
                        }}>
                          {c.upcoming} scheduled
                        </span>
                      </td>
                      <td>
                        <Link href={c.href} className="adm-open-btn">Open →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Quick Nav Cards ── */}
            <div className="adm-quick-grid">
              {CLIENTS.map(c => (
                <Link key={c.id} href={c.href} className="adm-quick-card">
                  <span>{c.icon} {c.name} Dashboard</span>
                  <span style={{ fontSize: 20 }}>→</span>
                </Link>
              ))}
              <Link href="/clients/grow" className="adm-quick-card">
                <span>🌱 GROW Dashboard</span>
                <span style={{ fontSize: 20 }}>→</span>
              </Link>
            </div>

            {/* ── Notify Client Panel ── */}
            <div className="adm-card" style={{ marginTop: 14 }}>
              <p className="adm-card-title">Notify Client</p>
              <p className="adm-card-sub">Send a notification to a client dashboard — event added, staff assigned, or recap submitted</p>

              <div className="adm-notify-tabs">
                {(["event", "staff", "recap"] as const).map(t => (
                  <button
                    key={t}
                    className={`adm-notify-tab${notifyForm.type === t ? " active" : ""}`}
                    onClick={() => setNotifyForm(f => ({ ...f, type: t }))}
                  >
                    {t === "event" ? "Event Added" : t === "staff" ? "Staff Assigned" : "Recap Submitted"}
                  </button>
                ))}
              </div>

              <div className="adm-notify-grid">
                <div className="adm-notify-group">
                  <label className="adm-notify-label">Client</label>
                  <select className="adm-notify-select" value={notifyForm.client} onChange={e => setNotifyForm(f => ({ ...f, client: e.target.value }))}>
                    {CLIENT_IDS.map(id => <option key={id} value={id}>{id}</option>)}
                  </select>
                </div>
                <div className="adm-notify-group">
                  <label className="adm-notify-label">Store / Event Name</label>
                  <input className="adm-notify-input" value={notifyForm.storeName} onChange={e => setNotifyForm(f => ({ ...f, storeName: e.target.value }))} placeholder="e.g. Total Wine - Orlando" />
                </div>
                <div className="adm-notify-group">
                  <label className="adm-notify-label">Event Date</label>
                  <input type="date" className="adm-notify-input" value={notifyForm.eventDate} onChange={e => setNotifyForm(f => ({ ...f, eventDate: e.target.value }))} />
                </div>

                {notifyForm.type === "staff" && (
                  <>
                    <div className="adm-notify-group">
                      <label className="adm-notify-label">Staff Name</label>
                      <input className="adm-notify-input" value={notifyForm.staffName} onChange={e => setNotifyForm(f => ({ ...f, staffName: e.target.value }))} placeholder="e.g. Jordan Smith" />
                    </div>
                    <div className="adm-notify-group">
                      <label className="adm-notify-label">Role (optional)</label>
                      <input className="adm-notify-input" value={notifyForm.staffRole} onChange={e => setNotifyForm(f => ({ ...f, staffRole: e.target.value }))} placeholder="e.g. Brand Ambassador" />
                    </div>
                  </>
                )}

                {notifyForm.type === "recap" && (
                  <>
                    <div className="adm-notify-group">
                      <label className="adm-notify-label">Submitted By</label>
                      <input className="adm-notify-input" value={notifyForm.submittedBy} onChange={e => setNotifyForm(f => ({ ...f, submittedBy: e.target.value }))} placeholder="e.g. Jordan Smith" />
                    </div>
                    <div className="adm-notify-group">
                      <label className="adm-notify-label">Consumers Sampled</label>
                      <input type="number" className="adm-notify-input" value={notifyForm.sampled} onChange={e => setNotifyForm(f => ({ ...f, sampled: e.target.value }))} placeholder="e.g. 120" />
                    </div>
                    <div className="adm-notify-group">
                      <label className="adm-notify-label">Units Sold</label>
                      <input type="number" className="adm-notify-input" value={notifyForm.sold} onChange={e => setNotifyForm(f => ({ ...f, sold: e.target.value }))} placeholder="e.g. 24" />
                    </div>
                  </>
                )}

                <div className="adm-notify-group full">
                  <label className="adm-notify-label">Notes (optional)</label>
                  <input className="adm-notify-input" value={notifyForm.notes} onChange={e => setNotifyForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional details..." />
                </div>
              </div>

              <button className="adm-btn-sync" onClick={sendClientNotification} disabled={notifySending}>
                {notifySending ? "Sending..." : "Send Notification →"}
              </button>
              {notifyMsg && <p className="adm-notify-msg">{notifyMsg}</p>}
            </div>

            {/* ── Bottom Menu ── */}
            <div className="adm-bottom-menu">
              <Link href="/dashboard" className="adm-menu-item active">
                <div className="adm-menu-item-icon">📊</div>
                <div>Dashboard</div>
              </Link>
              <a href="#activations" className="adm-menu-item">
                <div className="adm-menu-item-icon">📅</div>
                <div>Activation Calendar</div>
              </a>
              <a href="#markets" className="adm-menu-item">
                <div className="adm-menu-item-icon">🔍</div>
                <div>Market Intel</div>
              </a>
              <a href="#request" className="adm-menu-item">
                <div className="adm-menu-item-icon">➕</div>
                <div>Request Activation</div>
              </a>
              <Link href="/dashboard" className="adm-menu-item">
                <div className="adm-menu-item-icon">⬅️</div>
                <div>Admin Dashboard</div>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
