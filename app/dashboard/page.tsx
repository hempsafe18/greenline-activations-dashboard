"use client";
import { Fragment, useState, useEffect } from "react";
import "./admin.css";
import { useDashboardTheme, ThemeToggle } from "../clients/components/theme";
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
  { id: "kick-fizz",       name: "KICK FIZZ",       clientKey: "KICK_FIZZ",      color: "#1f8f84", icon: "🥤", href: "/clients/kick-fizz" },
  { id: "claybourne-co",  name: "CLAYBOURNE CO.",  clientKey: "CLAYBOURNE_CO",  color: "#a9822c", icon: "🦅", href: "/clients/claybourne-co" },
];

const ADMIN_EMAILS = ["asmar@greenlineactivations.com", "sedell@greenlineactivations.com", "asmar.gary@gmail.com"];

interface ClientStats {
  name: string; color: string; icon: string; href: string;
  activations: number; sampled: number; sold: number; conversion: number;
  uniqueCities: string[]; cityActivations: Record<string, number>;
  upcoming: number; monthlyData: Record<string, number>;
}

const CLIENT_IDS = ["3CHI", "AMIGOS", "MELLOW FELLOW", "GROW", "GROOVEWAGON", "WILLIES_REMEDY", "KICK_FIZZ", "CLAYBOURNE_CO"];

interface LoginEvent {
  id: string;
  email: string | null;
  name: string | null;
  client_id: string | null;
  occurred_at: string;
}

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
  const { theme, toggleTheme } = useDashboardTheme();
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

  const [eventRequests, setEventRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const [loginEvents, setLoginEvents] = useState<LoginEvent[]>([]);
  const [loginsError, setLoginsError] = useState<string | null>(null);
  const [includeInternal, setIncludeInternal] = useState(false);
  const [loginsLoading, setLoginsLoading] = useState(false);

  // Client-side auth guard
  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { window.location.href = "/"; return; }
    const email = user.emailAddresses[0]?.emailAddress ?? "";
    if (!ADMIN_EMAILS.includes(email)) { window.location.href = "/"; }
  }, [isLoaded, user]);

  const fetchAll = async () => {
    setIsLoading(true);

    // Fetch ambassador count in parallel (non-blocking)
    fetch("/api/ambassador-roster")
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

  const fetchEventRequests = async () => {
    setRequestsLoading(true);
    try {
      const res = await fetch("/api/event-requests");
      if (res.ok) { const data = await res.json(); setEventRequests(data.requests ?? []); }
    } catch (e) { console.error("Failed to fetch event requests", e); }
    setRequestsLoading(false);
  };

  const fetchLoginEvents = async (internal = includeInternal) => {
    setLoginsLoading(true);
    setLoginsError(null);
    try {
      const res = await fetch(`/api/client-logins?days=7&includeInternal=${internal}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setLoginEvents(data.logins ?? []);
      else setLoginsError(res.status === 401 ? "Not authorized to view login activity." : data.error ?? `Request failed (${res.status})`);
    } catch (e) {
      console.error("Failed to fetch login events", e);
      setLoginsError("Couldn't load login activity.");
    }
    setLoginsLoading(false);
  };

  useEffect(() => { if (isLoaded && user) { fetchAll(); fetchEventRequests(); fetchLoginEvents(); } }, [isLoaded]);

  const isSameDay = (a: string | Date, b: string | Date) => new Date(a).toDateString() === new Date(b).toDateString();

  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    if (isSameDay(d, new Date())) return "Today";
    if (isSameDay(d, new Date(Date.now() - 86400000))) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  };

  const timeAgo = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  };

  const resolveEventRequest = async (id: string, action: "approve" | "decline") => {
    setResolvingId(id);
    try {
      const res = await fetch("/api/event-requests", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (data.success) {
        setEventRequests(prev => prev.filter(r => r.id !== id));
      } else {
        alert(`Failed to ${action} request: ${data.error || "Unknown error"}`);
      }
    } catch { alert("Network error."); }
    setResolvingId(null);
  };

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
    <div className="admin-wrap" data-theme={theme}>

      {/* ── Sidebar ── */}
      <div className="adm-sidebar">
        <img src="/brand/greenline-icon-canopy.svg" alt="" className="adm-icon" />
        <p className="adm-logo">Greenline Activations</p>
        <p className="adm-brand">Admin Hub</p>
        <p className="adm-nav-label">Overview</p>
        <a className="adm-nav-item active"><span>📊</span> Master Dashboard</a>
        <Link className="adm-nav-item" href="/profiles"><span>👥</span> Ambassador Profiles</Link>
        <hr className="adm-divider" />
        <p className="adm-nav-label">Client Portals</p>
        {CLIENTS.map(c => (
          <Link key={c.id} className="adm-nav-item" href={c.href}>
            <span className="adm-nav-dot" style={{ background: c.color }} />
            {c.name}
          </Link>
        ))}
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
            <ThemeToggle theme={theme} onToggle={toggleTheme} className="adm-btn-sync adm-theme-toggle" />
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
                <p className="adm-stat-sub">Active ambassadors on the roster</p>
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
                  <div className="adm-status-bar" style={{ background: "var(--tint-neutral)" }}>
                    <div style={{ height: "100%", width: "100%", background: "var(--canopy)" }} />
                  </div>
                </div>
                <div className="adm-status-item" style={{ borderLeft: "4px solid var(--street)" }}>
                  <span className="adm-status-label">Upcoming / Scheduled</span>
                  <span className="adm-status-num">{totalUpcoming}</span>
                  <div className="adm-status-bar" style={{ background: "var(--tint-neutral)" }}>
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
                  <div className="adm-status-bar" style={{ background: "var(--tint-neutral)" }}>
                    <div style={{ height: "100%", width: "100%", background: "var(--ink)" }} />
                  </div>
                </div>
                <div className="adm-status-item" style={{ borderLeft: "4px solid var(--line-strong)" }}>
                  <span className="adm-status-label">Ambassadors on Roster</span>
                  <span className="adm-status-num" style={{ color: ambassadors === null ? "var(--muted)" : "var(--ink)" }}>
                    {ambassadors === null ? "—" : ambassadors}
                  </span>
                  <div className="adm-status-bar" style={{ background: "var(--tint-neutral)" }}>
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
                          border: "1px solid var(--line)", borderRadius: 999, textTransform: "uppercase", letterSpacing: ".06em",
                          background: c.upcoming > 0 ? "var(--canopy)" : "var(--tint-neutral)",
                          color: c.upcoming > 0 ? "var(--on-canopy)" : "var(--ink)"
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
            </div>

            {/* ── Event Requests Panel ── */}
            <div className="adm-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div>
                  <p className="adm-card-title">Event Requests</p>
                  <p className="adm-card-sub">Pending activation requests from client dashboards</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {eventRequests.length > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 8px", border: "1px solid var(--line)", borderRadius: 999,
                      textTransform: "uppercase", letterSpacing: ".06em", background: "var(--street)", color: "var(--on-street)",
                    }}>
                      {eventRequests.length} pending
                    </span>
                  )}
                  <button className="adm-btn-sync" onClick={fetchEventRequests} disabled={requestsLoading}>
                    {requestsLoading ? "⟳ Loading..." : "↻ Refresh"}
                  </button>
                </div>
              </div>

              {requestsLoading && eventRequests.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 14 }}>Loading requests...</p>
              ) : eventRequests.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 14 }}>No pending requests. All caught up.</p>
              ) : (
                <table className="adm-table" style={{ marginTop: 14 }}>
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Type</th>
                      <th>Store</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventRequests.map(r => {
                      const m = r.metadata ?? {};
                      const isNewActivation = m.requestType === "New Activation Request";
                      return (
                        <tr key={r.id}>
                          <td><strong>{r.client_id}</strong></td>
                          <td>{m.requestType ?? "Request"}</td>
                          <td>
                            <div>{m.storeName}</div>
                            {(r.requester_name || r.requester_email) && <div style={{ fontSize: 10, color: "var(--muted)" }}>Requested by {r.requester_name || r.requester_email}</div>}
                            {m.address && <div style={{ fontSize: 10, color: "var(--muted)" }}>{m.address}</div>}
                          </td>
                          <td>{m.date}</td>
                          <td>{m.startTime && m.endTime ? `${m.startTime} - ${m.endTime}` : "—"}</td>
                          <td style={{ maxWidth: 220 }}>{m.notes || "—"}</td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                className="adm-btn-sync"
                                style={{ background: "var(--canopy)", color: "var(--on-canopy)" }}
                                disabled={resolvingId === r.id}
                                onClick={() => resolveEventRequest(r.id, "approve")}
                              >
                                {resolvingId === r.id ? "..." : isNewActivation ? "Approve" : "Acknowledge"}
                              </button>
                              <button
                                className="adm-btn-sync"
                                style={{ background: "var(--street)", color: "var(--on-street)" }}
                                disabled={resolvingId === r.id}
                                onClick={() => resolveEventRequest(r.id, "decline")}
                              >
                                {resolvingId === r.id ? "..." : "Decline"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Client Login Activity Panel ── */}
            <div className="adm-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div>
                  <p className="adm-card-title">Client Login Activity</p>
                  <p className="adm-card-sub">When client contacts sign in and view their dashboard</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 8px", border: "1px solid var(--line)", borderRadius: 999,
                    textTransform: "uppercase", letterSpacing: ".06em", background: "var(--canopy)", color: "var(--on-canopy)",
                  }}>
                    {loginEvents.filter(l => isSameDay(l.occurred_at, new Date())).length} today
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 8px", border: "1px solid var(--line)", borderRadius: 999,
                    textTransform: "uppercase", letterSpacing: ".06em", background: "var(--white)",
                  }}>
                    {loginEvents.length} last 7 days
                  </span>
                  <button className="adm-btn-sync" onClick={() => { const next = !includeInternal; setIncludeInternal(next); fetchLoginEvents(next); }} disabled={loginsLoading}>
                    {includeInternal ? "☑" : "☐"} Include Greenline team
                  </button>
                  <button className="adm-btn-sync" onClick={() => fetchLoginEvents()} disabled={loginsLoading}>
                    {loginsLoading ? "⟳ Loading..." : "↻ Refresh"}
                  </button>
                </div>
              </div>

              {loginsLoading && loginEvents.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 14 }}>Loading login activity...</p>
              ) : loginsError ? (
                <p style={{ fontSize: 12, color: "var(--street, #ff4f33)", fontWeight: 700, marginTop: 14 }}>{loginsError}</p>
              ) : loginEvents.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 14 }}>
                  No {includeInternal ? "" : "client "}logins in the last 7 days. Logins are recorded when someone loads a client dashboard (and by the Clerk webhook, see README).
                </p>
              ) : (
                <table className="adm-table" style={{ marginTop: 14 }}>
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginEvents.map((l, i) => {
                      const client = CLIENTS.find(c => c.clientKey === l.client_id);
                      const newDay = i === 0 || !isSameDay(l.occurred_at, loginEvents[i - 1].occurred_at);
                      return (
                        <Fragment key={l.id}>
                        {newDay && (
                          <tr>
                            <td colSpan={4} style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", background: "var(--tint-neutral)" }}>
                              {dayLabel(l.occurred_at)}
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td>
                            <div className="adm-client-name" style={{ fontSize: 12 }}>
                              {client && <div className="adm-client-dot" style={{ background: client.color }} />}
                              {client?.name ?? l.client_id ?? "—"}
                            </div>
                          </td>
                          <td>{l.name ?? "—"}</td>
                          <td>{l.email ?? "—"}</td>
                          <td title={new Date(l.occurred_at).toLocaleString()}>
                            {new Date(l.occurred_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                            <span style={{ color: "var(--muted)" }}> · {timeAgo(l.occurred_at)}</span>
                          </td>
                        </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
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
