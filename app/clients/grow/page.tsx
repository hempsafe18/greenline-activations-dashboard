"use client";
import { useState, useEffect } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";

const CLIENT_ID = "GROW";

export default function GrowDashboard() {
  const { user } = useUser();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [expandedNotif, setExpandedNotif] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try { const res = await fetch("/api/grow/stats"); if (res.ok) setStats(await res.json()); } catch {}
    setLoading(false);
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications?client=${CLIENT_ID}`);
      if (res.ok) { const data = await res.json(); setNotifications(data.notifications || []); }
    } catch {}
  };

  const markAsRead = async (id: string) => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client: CLIENT_ID, markAllRead: true }) });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const formatNotifTime = (ts: string) =>
    new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  useEffect(() => { fetchStats(); fetchNotifications(); }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const lowInventory = stats && stats.inventory <= 30;
  const fmt$ = (n: number) => `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="db">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800,900,500&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .db { --ink: #0a0a0a; --bone: #faf0ea; --white: #fff; --muted: #767672; --gold: #d97706; --gold-pale: #fef3c7; --gold-dark: #92400e; --red: #dc2626; --red-pale: #fee2e2; --shadow: 4px 4px 0 0 #0a0a0a; font-family: 'Manrope', sans-serif; min-height: 100vh; background: var(--bone); color: var(--ink); }
        .db-layout { display: flex; min-height: 100vh; }
        .db-sidebar { width: 240px; background: var(--ink); display: flex; flex-direction: column; flex-shrink: 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
        .db-sidebar-header { padding: 24px 20px 20px; border-bottom: 2px solid rgba(255,255,255,0.1); }
        .db-sidebar-brand { font-size: 9px; font-weight: 700; color: rgba(250,240,234,0.4); letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 4px; }
        .db-sidebar-title { font-family: 'Cabinet Grotesk', sans-serif; font-size: 18px; font-weight: 800; color: var(--bone); letter-spacing: -0.02em; }
        .db-sidebar-sub { font-size: 10px; font-weight: 600; color: var(--gold); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 3px; }
        .db-nav { padding: 16px 12px; flex: 1; }
        .db-nav-label { font-size: 9px; font-weight: 700; color: rgba(250,240,234,0.3); letter-spacing: 0.16em; text-transform: uppercase; padding: 0 8px; margin-bottom: 8px; margin-top: 12px; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(250,240,234,0.55); cursor: pointer; transition: all 0.15s; border: 2px solid transparent; }
        .nav-item:hover { color: var(--bone); background: rgba(255,255,255,0.06); }
        .nav-item.active { color: var(--ink); background: var(--gold); border-color: var(--gold); }
        .nav-notif-badge { margin-left: auto; background: var(--red); color: #fff; font-size: 9px; font-weight: 800; padding: 2px 6px; min-width: 18px; text-align: center; }
        .db-sidebar-footer { padding: 16px 20px; border-top: 2px solid rgba(255,255,255,0.1); font-size: 10px; color: rgba(250,240,234,0.4); }
        .db-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .db-topbar { background: var(--white); border-bottom: 2px solid var(--ink); padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
        .db-topbar-title { font-family: 'Cabinet Grotesk', sans-serif; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
        .db-topbar-meta { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; }
        .db-content { padding: 32px; flex: 1; }
        .db-alert { background: var(--red-pale); border: 2px solid var(--red); padding: 14px 18px; margin-bottom: 24px; box-shadow: 3px 3px 0 0 var(--red); display: flex; align-items: center; gap: 12px; }
        .db-alert-text { font-size: 13px; font-weight: 700; color: var(--red); }
        .db-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
        .stat-card { background: var(--white); border: 2px solid var(--ink); padding: 20px 22px; box-shadow: var(--shadow); }
        .stat-card.red { background: var(--red-pale); border-color: var(--red); box-shadow: 4px 4px 0 0 var(--red); }
        .stat-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); margin-bottom: 8px; }
        .stat-value { font-family: 'Cabinet Grotesk', sans-serif; font-size: 34px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
        .stat-value.red { color: var(--red); }
        .stat-sub { font-size: 10px; font-weight: 600; color: var(--muted); margin-top: 4px; }
        .db-section-title { font-family: 'Cabinet Grotesk', sans-serif; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid var(--ink); }
        .db-card { background: var(--white); border: 2px solid var(--ink); box-shadow: var(--shadow); margin-bottom: 20px; }
        .db-table { width: 100%; border-collapse: collapse; }
        .db-table th { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); padding: 12px 16px; text-align: left; border-bottom: 2px solid var(--ink); background: var(--bone); }
        .db-table td { font-size: 12px; font-weight: 500; padding: 12px 16px; border-bottom: 1px solid rgba(10,10,10,0.08); }
        .db-table tr:last-child td { border-bottom: none; }
        .db-table tr:hover td { background: var(--gold-pale); }
        .badge { display: inline-block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 8px; border: 1.5px solid var(--ink); }
        .badge-new { background: var(--gold-pale); } .badge-ret { background: var(--bone); }
        .comm-summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .comm-card { border: 2px solid var(--ink); padding: 20px; box-shadow: var(--shadow); }
        .comm-card.gold { background: var(--gold-pale); } .comm-card.white { background: var(--white); }
        .comm-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); margin-bottom: 8px; }
        .comm-value { font-family: 'Cabinet Grotesk', sans-serif; font-size: 30px; font-weight: 800; letter-spacing: -0.02em; }
        .comm-note { font-size: 11px; font-weight: 500; color: var(--muted); margin-top: 6px; }
        .notif-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid var(--ink); }
        .notif-unread-badge { background: var(--red); color: #fff; font-size: 10px; font-weight: 800; padding: 2px 10px; display: inline-block; }
        .notif-list { display: flex; flex-direction: column; gap: 12px; }
        .notif-card { border: 2px solid var(--ink); padding: 16px; cursor: pointer; transition: all 0.15s; }
        .notif-card.unread { background: var(--gold-pale); box-shadow: 3px 3px 0 0 var(--ink); }
        .notif-card.read { background: var(--white); opacity: 0.7; }
        .notif-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
        .notif-type { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 2px 8px; border: 1.5px solid var(--ink); }
        .notif-subject { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
        .notif-body { font-size: 12px; font-weight: 500; color: #444; white-space: pre-wrap; }
        .notif-body.collapsed { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .notif-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(10,10,10,0.12); }
        .notif-time { font-size: 10px; font-weight: 600; color: var(--muted); }
        .btn-notif { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 12px; border: 1.5px solid var(--ink); background: var(--white); cursor: pointer; transition: all 0.12s; }
        .btn-notif:hover { background: var(--ink); color: var(--bone); }
        .notif-empty { text-align: center; padding: 48px 24px; color: var(--muted); font-size: 13px; font-weight: 600; }
        .loading { display: flex; align-items: center; justify-content: center; padding: 80px; font-size: 13px; font-weight: 600; color: var(--muted); }
        .db-table.clickable tbody tr { cursor: pointer; transition: background-color 0.15s; }
        .db-table.clickable tbody tr:hover td { background: var(--gold-pale); }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(10,10,10,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal { background: var(--white); border: 2px solid var(--ink); box-shadow: 8px 8px 0 0 var(--ink); max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; }
        .modal-header { padding: 24px; border-bottom: 2px solid var(--ink); display: flex; justify-content: space-between; align-items: center; }
        .modal-title { font-family: 'Cabinet Grotesk', sans-serif; font-size: 18px; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
        .modal-close { background: var(--red); color: var(--white); border: none; font-size: 18px; cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .modal-close:hover { background: #b91c1c; }
        .modal-content { padding: 24px; }
        .recap-section { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid rgba(10,10,10,0.08); }
        .recap-section:last-child { border-bottom: none; margin-bottom: 0; }
        .recap-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin-bottom: 6px; }
        .recap-value { font-size: 13px; font-weight: 600; color: var(--ink); }
        .recap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        /* ── Tablet (900px and below) ── */
        @media (max-width: 900px) {
          .db-layout { flex-direction: column; }
          .db-sidebar { width: 100%; height: auto; position: static; border-right: none; border-bottom: 2px solid var(--ink); padding: 12px; }
          .db-nav { flex-direction: row; gap: 8px; flex-wrap: wrap; }
          .db-nav-item { padding: 6px 10px; font-size: 10px; }
          .db-content { padding: 18px; }
          .db-header { flex-direction: column; gap: 12px; align-items: flex-start; }
          .db-header h1 { font-size: 20px; }
          .db-stats { grid-template-columns: 1fr 1fr; gap: 10px; }
          .db-stat-card { padding: 16px; }
          .db-stat-value { font-size: 28px; }
          .comm-summary { grid-template-columns: 1fr 1fr; gap: 10px; }
          .comm-card { padding: 14px; }
          .comm-value { font-size: 24px; }
        }

        /* ── Mobile (600px and below) ── */
        @media (max-width: 600px) {
          .db-content { padding: 14px; }
          .db-header { gap: 10px; }
          .db-header h1 { font-size: 16px; }
          .db-header p { font-size: 11px; }
          .db-stats { grid-template-columns: 1fr; gap: 8px; }
          .db-stat-card { padding: 12px 14px; }
          .db-stat-label { font-size: 9px; }
          .db-stat-value { font-size: 22px; }
          .db-stat-sub { font-size: 10px; }
          .comm-summary { grid-template-columns: 1fr; gap: 8px; }
          .comm-card { padding: 12px; }
          .comm-label { font-size: 9px; }
          .comm-value { font-size: 20px; }
          .notif-list { grid-template-columns: 1fr; gap: 8px; }
          .notif-card { padding: 12px; }
          .notif-title { font-size: 13px; }
          .notif-time { font-size: 9px; }
          .btn-notif { padding: 4px 8px; font-size: 9px; }
        }

        /* ── Extra small (480px and below) ── */
        @media (max-width: 480px) {
          .db-content { padding: 12px; }
          .db-header h1 { font-size: 14px; }
          .db-header p { font-size: 10px; }
          .db-stats { gap: 6px; }
          .db-stat-card { padding: 10px 12px; }
          .db-stat-label { font-size: 8px; }
          .db-stat-value { font-size: 18px; }
          .comm-summary { gap: 6px; }
          .comm-card { padding: 10px; }
          .comm-label { font-size: 8px; }
          .comm-value { font-size: 16px; }
          .notif-card { padding: 10px; }
          .notif-title { font-size: 12px; }
          .btn-notif { padding: 3px 6px; font-size: 8px; }
        }
      `}} />
      <div className="db-layout">
        <aside className="db-sidebar">
          <div className="db-sidebar-header">
            <p className="db-sidebar-brand">Greenline Activations</p>
            <p className="db-sidebar-title">GROW</p>
            <p className="db-sidebar-sub">Sales Dashboard</p>
          </div>
          <nav className="db-nav">
            <Link href="/dashboard" className="nav-item" style={{ marginBottom: 12, opacity: 0.7 }}><span>←</span> Main Dashboard</Link>
            <p className="db-nav-label">Overview</p>
            <div className={`nav-item ${activeSection==="dashboard"?"active":""}`} onClick={()=>setActiveSection("dashboard")}><span>📊</span> Dashboard</div>
            <div className={`nav-item ${activeSection==="accounts"?"active":""}`} onClick={()=>setActiveSection("accounts")}><span>🏪</span> Accounts</div>
            <div className={`nav-item ${activeSection==="orders"?"active":""}`} onClick={()=>setActiveSection("orders")}><span>📦</span> Orders</div>
            <div className={`nav-item ${activeSection==="commission"?"active":""}`} onClick={()=>setActiveSection("commission")}><span>💰</span> Commission</div>
            <p className="db-nav-label">Communications</p>
            <div className={`nav-item ${activeSection==="notifications"?"active":""}`} onClick={()=>setActiveSection("notifications")}>
              <span>🔔</span> Notifications
              {unreadCount>0&&<span className="nav-notif-badge">{unreadCount}</span>}
            </div>
          </nav>
          <div className="db-sidebar-footer">{user?.emailAddresses?.[0]?.emailAddress||""}</div>
        </aside>
        <main className="db-main">
          <div className="db-topbar">
            <div>
              <p className="db-topbar-title">{activeSection==="dashboard"&&"Sales Overview"}{activeSection==="accounts"&&"Account Directory"}{activeSection==="orders"&&"Order History"}{activeSection==="commission"&&"Commission Breakdown"}{activeSection==="notifications"&&"Notifications"}</p>
              <p className="db-topbar-meta">Welcome back, {user?.firstName||user?.emailAddresses?.[0]?.emailAddress?.split("@")[0]||"User"} &nbsp;·&nbsp; Grow Cannabis Group · Live Data</p>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'16px',marginLeft:'auto'}}>
              <UserButton />
            </div>
          </div>
          <div className="db-content">
            {loading?<div className="loading">Loading data...</div>:(
              <>
                {activeSection==="dashboard"&&(
                  <>
                    {lowInventory&&<div className="db-alert"><span style={{fontSize:'18px'}}>⚠️</span><span className="db-alert-text">Low Inventory: {stats.inventory} cases remaining — replenishment needed (threshold: 30 cases)</span></div>}
                    <div className="db-stats">
                      <div className="stat-card"><p className="stat-label">Accounts Visited</p><p className="stat-value">{stats?.accountsVisited??0}</p><p className="stat-sub">unique locations</p></div>
                      <div className="stat-card"><p className="stat-label">New Accounts</p><p className="stat-value">{stats?.newAccounts??0}</p><p className="stat-sub">first-time orders</p></div>
                      <div className="stat-card"><p className="stat-label">Cases Sold</p><p className="stat-value">{stats?.casesSold??0}</p><p className="stat-sub">total units ordered</p></div>
                      <div className={`stat-card ${lowInventory?"red":""}`}><p className="stat-label">Current Inventory</p><p className={`stat-value ${lowInventory?"red":""}`}>{stats?.inventory??100}</p><p className="stat-sub">cases remaining of 100</p></div>
                      <div className="stat-card"><p className="stat-label">Revenue</p><p className="stat-value" style={{fontSize:'24px'}}>{fmt$(stats?.revenue??0)}</p><p className="stat-sub">total wholesale</p></div>
                      <div className="stat-card" style={{background:'var(--gold-pale)'}}><p className="stat-label">Commission Balance</p><p className="stat-value" style={{fontSize:'24px',color:'var(--gold-dark)'}}>{fmt$(stats?.commission??0)}</p><p className="stat-sub">10% of revenue</p></div>
                    </div>
                    <p className="db-section-title">Top Accounts</p>
                    <div className="db-card"><table className="db-table"><thead><tr><th>Account</th><th>Status</th><th>Visits</th><th>Cases</th><th>Revenue</th><th>Last Visit</th></tr></thead><tbody>
                      {(stats?.accounts||[]).slice(0,5).map((acc:any,i:number)=>(<tr key={i}><td style={{fontWeight:700}}>{acc.name}</td><td><span className={`badge ${acc.isNew?"badge-new":"badge-ret"}`}>{acc.isNew?"New":"Returning"}</span></td><td>{acc.visitCount}</td><td>{acc.totalCases}</td><td>{fmt$(acc.totalRevenue)}</td><td style={{color:'var(--muted)'}}>{acc.lastVisit}</td></tr>))}
                      {(!stats?.accounts||stats.accounts.length===0)&&<tr><td colSpan={6} style={{textAlign:'center',color:'var(--muted)',padding:'32px'}}>No accounts yet</td></tr>}
                    </tbody></table></div>
                  </>
                )}
                {activeSection==="accounts"&&(<><p className="db-section-title">All Accounts</p><div className="db-card"><table className="db-table clickable"><thead><tr><th>Account</th><th>City</th><th>Status</th><th>Visits</th><th>Cases</th><th>Revenue</th><th>Last Visit</th></tr></thead><tbody>{(stats?.accounts||[]).map((acc:any,i:number)=>(<tr key={i} onClick={()=>setSelectedAccount(acc.name)}><td style={{fontWeight:700}}>{acc.name}</td><td style={{color:'var(--muted)'}}>{acc.city||'—'}</td><td><span className={`badge ${acc.isNew?'badge-new':'badge-ret'}`}>{acc.isNew?'New':'Returning'}</span></td><td>{acc.visitCount}</td><td>{acc.totalCases}</td><td>{fmt$(acc.totalRevenue)}</td><td style={{color:'var(--muted)'}}>{acc.lastVisit}</td></tr>))}{(!stats?.accounts||stats.accounts.length===0)&&<tr><td colSpan={7} style={{textAlign:'center',color:'var(--muted)',padding:'32px'}}>No accounts yet</td></tr>}</tbody></table></div></>)}
                {activeSection==="orders"&&(<><p className="db-section-title">Order History</p><div className="db-card"><table className="db-table"><thead><tr><th>Date</th><th>Rep</th><th>Account</th><th>City</th><th>SKU</th><th>Cases</th><th>Unit Price</th><th>Line Total</th></tr></thead><tbody>{(stats?.visits||[]).map((v:any,i:number)=>(<tr key={i}><td>{v.visit_date}</td><td style={{fontWeight:600}}>{v.rep_name}</td><td>{v.account_name}</td><td style={{color:'var(--muted)'}}>{v.city||'—'}</td><td style={{fontFamily:'monospace',fontSize:'11px'}}>{v.sku||'—'}</td><td>{v.qty_ordered}</td><td>{fmt$(v.unit_wholesale)}</td><td style={{fontWeight:700}}>{fmt$(v.line_total)}</td></tr>))}{(!stats?.visits||stats.visits.length===0)&&<tr><td colSpan={8} style={{textAlign:'center',color:'var(--muted)',padding:'32px'}}>No orders yet</td></tr>}</tbody></table></div></>)}
                {activeSection==="commission"&&(<><p className="db-section-title">Commission Breakdown</p><div className="comm-summary"><div className="comm-card white"><p className="comm-label">Total Revenue</p><p className="comm-value">{fmt$(stats?.revenue??0)}</p><p className="comm-note">All wholesale orders</p></div><div className="comm-card white"><p className="comm-label">Commission Rate</p><p className="comm-value">10%</p></div><div className="comm-card gold"><p className="comm-label">Commission Earned</p><p className="comm-value">{fmt$(stats?.commission??0)}</p></div></div><p className="db-section-title">By Account</p><div className="db-card"><table className="db-table"><thead><tr><th>Account</th><th>Revenue</th><th>Commission (10%)</th><th>Cases</th><th>Visits</th></tr></thead><tbody>{(stats?.accounts||[]).map((acc:any,i:number)=>(<tr key={i}><td style={{fontWeight:700}}>{acc.name}</td><td>{fmt$(acc.totalRevenue)}</td><td style={{fontWeight:700,color:'var(--gold-dark)'}}>{fmt$(acc.totalRevenue*0.1)}</td><td>{acc.totalCases}</td><td>{acc.visitCount}</td></tr>))}{(!stats?.accounts||stats.accounts.length===0)&&<tr><td colSpan={5} style={{textAlign:'center',color:'var(--muted)',padding:'32px'}}>No data yet</td></tr>}</tbody></table></div></>)}
                {activeSection==="notifications"&&(
                  <>
                    <div className="notif-header"><div style={{display:'flex',alignItems:'center',gap:'12px'}}><p className="db-section-title" style={{margin:0,border:0,padding:0}}>Notifications</p>{unreadCount>0&&<span className="notif-unread-badge">{unreadCount} unread</span>}</div>{unreadCount>0&&<button className="btn-notif" onClick={markAllRead}>Mark all read</button>}</div>
                    {notifications.length===0?<div className="notif-empty">No notifications yet.</div>:(
                      <div className="notif-list">{notifications.map((n:any)=>{
                        const typeColors:Record<string,string>={email:'var(--gold-pale)',alert:'var(--red-pale)',update:'#c7d7fe',announcement:'#fde68a'};
                        const isExpanded=expandedNotif===n.id;
                        return(<div key={n.id} className={`notif-card ${n.read?'read':'unread'}`} onClick={()=>setExpandedNotif(isExpanded?null:n.id)}>
                          <div className="notif-badges"><span className="notif-type" style={{background:typeColors[n.type]||'#f0f0f0'}}>{n.type}</span></div>
                          <p className="notif-subject">{n.subject}</p>
                          <p className={`notif-body ${isExpanded?'':'collapsed'}`}>{n.body}</p>
                          <div className="notif-footer"><span className="notif-time">{n.created_at?formatNotifTime(n.created_at):''}</span><div>{!n.read&&<button className="btn-notif" onClick={e=>{e.stopPropagation();markAsRead(n.id);}}>Mark read</button>}</div></div>
                        </div>);
                      })}</div>
                    )}
                  </>
                )}
              </>
            )}
            {selectedAccount&&(
              <div className="modal-overlay" onClick={()=>setSelectedAccount(null)}>
                <div className="modal" onClick={e=>e.stopPropagation()}>
                  <div className="modal-header">
                    <h2 className="modal-title">{selectedAccount} — Visit Recaps</h2>
                    <button className="modal-close" onClick={()=>setSelectedAccount(null)}>✕</button>
                  </div>
                  <div className="modal-content">
                    {stats?.visits?.filter((v:any)=>v.account_name===selectedAccount).map((visit:any,i:number)=>(
                      <div key={i} className="recap-section">
                        <div className="recap-grid">
                          <div>
                            <p className="recap-label">Visit Date</p>
                            <p className="recap-value">{visit.visit_date}</p>
                          </div>
                          <div>
                            <p className="recap-label">Rep Name</p>
                            <p className="recap-value">{visit.rep_name}</p>
                          </div>
                          <div>
                            <p className="recap-label">City</p>
                            <p className="recap-value">{visit.city||'—'}</p>
                          </div>
                          <div>
                            <p className="recap-label">SKU</p>
                            <p className="recap-value" style={{fontFamily:'monospace',fontSize:'11px'}}>{visit.sku||'—'}</p>
                          </div>
                          <div>
                            <p className="recap-label">Cases Ordered</p>
                            <p className="recap-value">{visit.qty_ordered}</p>
                          </div>
                          <div>
                            <p className="recap-label">Line Total</p>
                            <p className="recap-value">{fmt$(visit.line_total)}</p>
                          </div>
                        </div>
                        {visit.recap_data&&(
                          <>
                            {visit.recap_data.notes&&(
                              <div style={{marginTop:12}}>
                                <p className="recap-label">Notes</p>
                                <p className="recap-value" style={{whiteSpace:'pre-wrap'}}>{visit.recap_data.notes}</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                    {(!stats?.visits||stats.visits.filter((v:any)=>v.account_name===selectedAccount).length===0)&&(
                      <p style={{color:'var(--muted)',textAlign:'center',padding:'24px'}}>No visit recaps for this account</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
