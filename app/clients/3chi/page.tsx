"use client";
import { useState, useEffect } from "react";
// 🚨 NEW IMPORT ADDED HERE 🚨
import { UserButton } from "@clerk/nextjs";

const TARGET_BRAND = "3CHI"; 

// 1. PASTE YOUR GOOGLE SHEET LINKS HERE
const RECAP_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS5yMhDDOY4o5F6MeFQ9G7zW9NwBstUZdILzlXDW-ZsPkY-ZVMouJA_XruNLEx9ogoNYfVR8-Uwr84B/pub?gid=91040411&single=true&output=csv";
const UPCOMING_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRN0A0puaplJ3l1dkLEjBZyWZOquIUaMof32WQlUB8H3aJAKYJQ1ypp4hNvt67YApZV8lhnTamzhenw/pub?gid=0&single=true&output=csv";

export default function UnifiedDashboard() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State for Edits/Cancels
  const [changeModal, setChangeModal] = useState({ isOpen: false, type: "", event: null as any, notes: "" });

  const [formData, setFormData] = useState({
    storeName: "", address: "", date: "", startTime: "", endTime: "", notes: ""
  });

  const [metrics, setMetrics] = useState({
    sampled: 0, sold: 0, activations: 0, conversion: 0, 
    markets: [] as any[], calendar: [] as any[], intel: [] as any[]
  });

  const parseCSV = (str: string) => {
    const result = []; let row = []; let cell = ''; let quote = false;
    for (let i = 0; i < str.length; i++) {
      let char = str[i], nextChar = str[i + 1];
      if (char === '"' && quote && nextChar === '"') { cell += '"'; i++; }
      else if (char === '"') { quote = !quote; }
      else if (char === ',' && !quote) { row.push(cell); cell = ''; }
      else if (char === '\n' && !quote) { row.push(cell); result.push(row); row = []; cell = ''; }
      else { cell += char; }
    }
    row.push(cell); result.push(row);
    return result;
  };

  const fetchLiveData = async () => {
    setIsLoading(true);
    try {
      const [recapRes, upcomingRes] = await Promise.all([
        fetch(RECAP_CSV_URL).catch(() => null),
        fetch(UPCOMING_CSV_URL).catch(() => null)
      ]);

      let newCalendar: any[] = [];
      let totalSampled = 0; let totalSold = 0; let totalActivations = 0;
      let cityCounts: Record<string, number> = {}; 
      let flavorCounts: Record<string, number> = {};
      let newIntel: any[] = [];

      if (recapRes && recapRes.ok) {
        const text = await recapRes.text();
        const rows = parseCSV(text);
        const headers = rows[0].map((h: string) => h.trim());
        const data = rows.slice(1).map((row: string[]) => {
          let obj: any = {}; row.forEach((val, i) => obj[headers[i]] = val); return obj;
        });

        data.forEach(row => {
          if (!row['Store Name']) return; 
          
          totalActivations++;
          totalSampled += parseInt(row['Total consumers sampled']) || 0;
          totalSold += parseInt(row['Estimated units sold']) || 0;
          
          const city = row['City'] || 'Unknown';
          cityCounts[city] = (cityCounts[city] || 0) + (parseInt(row['Total consumers sampled']) || 0);
          
          const flavor = row['Top performing flavor'];
          if (flavor) flavorCounts[flavor] = (flavorCounts[flavor] || 0) + 1;

          const objections = row['Consumer objections encountered'];
          if (objections && objections.trim() !== "" && objections.toLowerCase() !== "none") {
              newIntel.push({ type: 'objection', icon: '💬', text: `Objection at ${row['Store Name'] || city}: ${objections}` });
          }

          const photoLink = row['Engagement photo submission'];
          if (photoLink && photoLink.includes('http')) {
               newIntel.push({ type: 'photo', icon: '📸', text: `New engagement photo from ${row['Store Name'] || city}.`, link: photoLink });
          }

          if (row['Activation Date']) {
            newCalendar.push({
              date: row['Activation Date'], store: row['Store Name'], market: city,
              time: `${row['Shift Start Time '] || ''}-${row['Shift End Time'] || ''}`,
              status: "Complete", sortDate: new Date(row['Activation Date'])
            });
          }
        });
      }

      if (upcomingRes && upcomingRes.ok) {
        const text = await upcomingRes.text();
        const rows = parseCSV(text);
        const headers = rows[0].map((h: string) => h.trim());
        const data = rows.slice(1).map((row: string[]) => {
          let obj: any = {}; row.forEach((val, i) => obj[headers[i]] = val); return obj;
        });

        data.forEach(row => {
          if (!row['Store Name'] || !row['Date']) return; 
          const startTime = row['Start Time'] || ''; const endTime = row['End Time'] || '';
          
          newCalendar.push({
            date: row['Date'], store: row['Store Name'], market: row['Market'] || 'TBD',
            address: row['Address'] || '', time: startTime && endTime ? `${startTime} - ${endTime}` : '',
            products: row['Products'] || '', samplingType: row['Sampling Type'] || '',
            purchaseReq: row['Product Purchase'] || '', status: "Upcoming", sortDate: new Date(row['Date'])
          });
        });
      }

      let bestFlavor = "No data"; let maxFlavorCount = 0;
      for (const [flavor, count] of Object.entries(flavorCounts)) {
        if (count > maxFlavorCount) { bestFlavor = flavor; maxFlavorCount = count; }
      }

      if (bestFlavor !== "No data") {
        newIntel.unshift({ type: 'flavor', icon: '🏆', text: `Top performing SKU across recent activations is ${bestFlavor}.` });
      }

      const markets = Object.entries(cityCounts).map(([city, value]) => ({ city, value })).sort((a, b) => b.value - a.value).slice(0, 3);
      newCalendar.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

      if (totalActivations > 0 || newCalendar.length > 0) {
        setMetrics({
          sampled: totalSampled, sold: totalSold, activations: totalActivations,
          conversion: totalSampled > 0 ? Math.round((totalSold / totalSampled) * 100) : 0,
          markets: markets, calendar: newCalendar.slice(0, 6), intel: newIntel.slice(0, 5)
        });
      }
    } catch (error) { console.error("Failed to fetch data", error); }
    setIsLoading(false);
  };

  useEffect(() => { fetchLiveData(); }, []);

  const submitRequest = async () => {
    if (!formData.storeName || !formData.date) { alert("Please fill out at least the Store Name and Date."); return; }
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, client: TARGET_BRAND, requestType: "New Activation Request" })
      });

      if (response.ok) {
        setUploadMessage("✅ Request submitted successfully. The team has been notified.");
        setShowSuccess(true);
        setFormData({ storeName: "", address: "", date: "", startTime: "", endTime: "", notes: "" });
      } else {
        setUploadMessage("❌ Failed to send request. Please try again.");
        setShowSuccess(true);
      }
    } catch (error) { setUploadMessage("❌ Network error."); setShowSuccess(true); }
    setIsSubmitting(false); setTimeout(() => setShowSuccess(false), 5000);
  };

  const submitChangeRequest = async () => {
    if (!changeModal.notes) { alert("Please provide details for this change."); return; }
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          storeName: changeModal.event.store,
          date: changeModal.event.date,
          notes: changeModal.notes,
          client: TARGET_BRAND, 
          requestType: `${changeModal.type} Request`
        })
      });

      if (response.ok) {
        setUploadMessage(`✅ ${changeModal.type} request sent successfully.`);
        setShowSuccess(true);
        setChangeModal({ isOpen: false, type: "", event: null, notes: "" });
      } else {
        alert("Failed to send request.");
      }
    } catch (error) { alert("Network error."); }
    setIsSubmitting(false); setTimeout(() => setShowSuccess(false), 5000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const maxMarketValue = Math.max(...metrics.markets.map(m => m.value), 1);

  return (
    <div className="dashboard-wrapper">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Outfit:wght@300;400;500;600&display=swap');
        .dashboard-wrapper { --bg: #f5f4ef; --white: #ffffff; --black: #111111; --green: #2d5f3f; --green-light: #52b788; --green-pale: #e8f0eb; --orange: #e07b39; --border: #e0ddd4; --muted: #888880; --card: #ffffff; font-family: 'Outfit', sans-serif; background: var(--bg); color: var(--black); min-height: 100vh; position: absolute; top: 0; left: 0; right: 0; z-index: 10; }
        .dashboard-wrapper * { box-sizing: border-box; }
        .sidebar { position: fixed; top: 0; left: 0; width: 220px; height: 100vh; background: var(--green); padding: 28px 20px; display: flex; flex-direction: column; z-index: 100; }
        .sidebar-logo { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.5); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
        .sidebar-brand { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; color: white; margin-bottom: 36px; }
        .nav-label { font-size: 9px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 8px; margin-top: 20px; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.65); cursor: pointer; transition: all 0.15s; margin-bottom: 2px; text-decoration: none; }
        .nav-item:hover, .nav-item.active { background: rgba(255,255,255,0.12); color: white; }
        .nav-item .icon { font-size: 15px; width: 18px; text-align: center; }
        .main { margin-left: 220px; padding: 32px; min-height: 100vh; padding-top: 80px; }
        .topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
        .topbar-left h1 { font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 700; color: var(--black); margin: 0; display: flex; align-items: center; gap: 12px; }
        .topbar-left p { font-size: 13px; color: var(--muted); margin-top: 2px; margin-bottom: 0; }
        .topbar-right { display: flex; align-items: center; gap: 16px; }
        .badge { background: var(--green-pale); color: var(--green); font-size: 11px; font-weight: 600; padding: 5px 12px; border-radius: 20px; }
        .btn-refresh { background: white; border: 1px solid var(--border); border-radius: 6px; padding: 6px 12px; font-size: 11px; font-weight: 600; cursor: pointer; color: var(--black); transition: 0.2s; }
        .btn-refresh:hover { background: var(--green-pale); color: var(--green); border-color: var(--green-light); }
        .section { display: none; } .section.active { display: block; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
        .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 20px; position: relative; overflow: hidden; }
        .stat-label { font-size: 11px; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 10px; margin-top: 0; }
        .stat-value { font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 700; color: var(--black); line-height: 1; margin-bottom: 6px; margin-top: 0; }
        .stat-value.green { color: var(--green); }
        .two-col { display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; margin-bottom: 20px; }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; margin-bottom: 14px; }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .card-title { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--black); margin: 0; }
        .card-sub { font-size: 11px; color: var(--muted); margin-top: 2px; margin-bottom: 0; }
        .chart-bars { display: flex; align-items: flex-end; gap: 10px; height: 140px; padding-bottom: 24px; position: relative; }
        .chart-bars::after { content: ''; position: absolute; bottom: 24px; left: 0; right: 0; height: 1px; background: var(--border); }
        .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
        .bar-fill { width: 100%; border-radius: 5px 5px 0 0; background: var(--green); transition: height 0.6s ease; position: relative; }
        .bar-label { font-size: 10px; color: var(--muted); margin-top: 6px; text-align: center; white-space: nowrap; margin-bottom: 0; }
        .bar-val { position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: 600; color: var(--black); white-space: nowrap; }
        .cal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .cal-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; border-left: 3px solid var(--border); display: flex; flex-direction: column; }
        .cal-card.status-Complete { border-left-color: var(--green); }
        .cal-card.status-Upcoming { border-left-color: var(--orange); }
        .cal-date { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 6px; margin-top: 0; display: flex; justify-content: space-between; }
        .cal-time { text-transform: none; font-weight: 500; }
        .cal-store { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--black); margin-bottom: 4px; margin-top: 0; }
        .cal-market { font-size: 11px; color: var(--muted); margin-bottom: 8px; margin-top: 0; }
        .cal-products { font-size: 10px; color: #666; margin-top: -4px; margin-bottom: 12px; background: #f5f5f5; padding: 4px 8px; border-radius: 4px; display: inline-block; }
        .cal-footer { display: flex; align-items: center; gap: 8px; justify-content: space-between; margin-top: auto; }
        .cal-status { font-size: 10px; font-weight: 600; padding: 3px 9px; border-radius: 10px; display: inline-block; }
        .cal-status.status-Complete { background: var(--green-pale); color: var(--green); }
        .cal-status.status-Upcoming { background: #fef3ec; color: var(--orange); }
        .cal-actions { display: flex; gap: 4px; }
        .btn-action { font-size: 10px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px; background: white; cursor: pointer; color: var(--muted); }
        .btn-action:hover { background: #f5f5f5; color: var(--black); border-color: #ccc; }
        .intel-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 13px; align-items: center; }
        .intel-icon { font-size: 16px; width: 24px; flex-shrink: 0; margin-top: 1px; }
        .intel-text { color: #555; line-height: 1.5; margin: 0; flex: 1; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group.full { grid-column: 1 / -1; }
        .form-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
        .form-input { font-family: 'Outfit', sans-serif; font-size: 13px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--black); outline: none; }
        .form-textarea { resize: vertical; min-height: 80px; }
        .time-inputs { display: flex; align-items: center; gap: 10px; }
        .btn-submit { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; background: var(--green); color: white; border: none; padding: 12px 28px; border-radius: 8px; cursor: pointer; transition: opacity 0.2s; }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .success-msg { background: var(--green-pale); border: 1px solid var(--green-light); border-radius: 8px; padding: 14px 18px; font-size: 13px; color: var(--green); font-weight: 500; margin-top: 14px; }
        .loading-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.8); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1000; }
        .spinner { border: 4px solid rgba(0,0,0,0.1); width: 40px; height: 40px; border-radius: 50%; border-left-color: var(--green); animation: spin 1s linear infinite; margin-bottom: 16px; }
        
        /* Modal Styles */
        .modal-overlay { position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 20px; }
        .modal-content { background: white; padding: 24px; border-radius: 12px; width: 100%; max-width: 400px; }
        .modal-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 8px; }
        .modal-desc { font-size: 13px; color: var(--muted); margin-bottom: 16px; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
        .btn-cancel { background: white; border: 1px solid var(--border); padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; }

        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .sidebar { position: fixed; bottom: 0; left: 0; top: auto; width: 100%; height: 70px; padding: 8px; flex-direction: row; justify-content: space-around; z-index: 999; border-top: 1px solid rgba(0,0,0,0.05); }
          .sidebar-logo, .sidebar-brand, .nav-label { display: none; }
          .nav-item { flex-direction: column; font-size: 10px; padding: 4px; text-align: center; gap: 4px; width: 25%; margin-bottom: 0; }
          .nav-item .icon { font-size: 18px; width: auto; text-align: center; margin: 0 auto; }
          .main { margin-left: 0; padding: 16px; padding-bottom: 90px; padding-top: 20px; }
          .topbar { flex-direction: column; align-items: flex-start; gap: 16px; }
          .topbar-right { width: 100%; justify-content: space-between; flex-direction: row-reverse; }
          .stat-grid { grid-template-columns: 1fr 1fr; }
          .two-col { grid-template-columns: 1fr; }
          .cal-grid { grid-template-columns: 1fr; }
          .form-grid { grid-template-columns: 1fr; }
          .time-inputs { flex-direction: column; align-items: flex-start; gap: 8px; }
          .time-inputs span { display: none; }
        }
      `}} />

      {/* CHANGE REQUEST MODAL */}
      {changeModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">{changeModal.type} Activation</h3>
            <p className="modal-desc">{changeModal.event.store} on {changeModal.event.date}</p>
            <div className="form-group full">
              <label className="form-label">Details of your request:</label>
              <textarea 
                className="form-input form-textarea" 
                placeholder={changeModal.type === 'Edit' ? "e.g. Can we move this to Friday at 5pm?" : "Please provide a reason for cancellation."}
                value={changeModal.notes}
                onChange={(e) => setChangeModal({...changeModal, notes: e.target.value})}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setChangeModal({isOpen: false, type: "", event: null, notes: ""})}>Close</button>
              <button className="btn-submit" onClick={submitChangeRequest} disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p style={{fontWeight: 600, color: 'var(--green)'}}>Syncing live data...</p>
        </div>
      )}

      <div className="sidebar">
        <p className="sidebar-logo">Greenline Activations</p>
        <p className="sidebar-brand">{TARGET_BRAND}</p>
        <p className="nav-label">Menu</p>
        <a className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveSection('dashboard')}><span className="icon">📊</span> Dashboard</a>
        <a className={`nav-item ${activeSection === 'calendar' ? 'active' : ''}`} onClick={() => setActiveSection('calendar')}><span className="icon">📅</span> Activation Calendar</a>
        <a className={`nav-item ${activeSection === 'intel' ? 'active' : ''}`} onClick={() => setActiveSection('intel')}><span className="icon">🔍</span> Market Intel</a>
        <a className={`nav-item ${activeSection === 'request' ? 'active' : ''}`} onClick={() => setActiveSection('request')}><span className="icon">➕</span> Request Activation</a>
      </div>

      <div className="main">
        <div className="topbar">
          <div className="topbar-left">
            <h1>Activation Dashboard <button className="btn-refresh" onClick={fetchLiveData}>↻ Sync Data</button></h1>
            <p>Live connected to Google Sheets</p>
          </div>
          <div className="topbar-right">
            <UserButton />
            <span className="badge">{metrics.activations} Activations Logged</span>
          </div>
        </div>

        {/* DASHBOARD TAB */}
        <div className={`section ${activeSection === 'dashboard' ? 'active' : ''}`}>
          <div className="stat-grid">
            <div className="stat-card"><p className="stat-label">Consumers Sampled</p><p className="stat-value">{metrics.sampled}</p></div>
            <div className="stat-card"><p className="stat-label">Total Purchases</p><p className="stat-value green">{metrics.sold}</p></div>
            <div className="stat-card"><p className="stat-label">Avg Conversion Rate</p><p className="stat-value">{metrics.conversion}%</p></div>
            <div className="stat-card"><p className="stat-label">Total Activations</p><p className="stat-value">{metrics.activations}</p></div>
          </div>
          <div className="two-col">
            <div className="card">
              <div className="card-header"><div><p className="card-title">Consumers Reached by Market</p><p className="card-sub">Top 3 Performing Cities</p></div></div>
              <div className="chart-bars">
                {metrics.markets.map((market, index) => (
                  <div className="bar-col" key={index}>
                    <div className="bar-fill" style={{height: `${(market.value / maxMarketValue) * 100}%`}}>
                      <span className="bar-val">{market.value}</span>
                    </div>
                    <p className="bar-label">{market.city}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CALENDAR TAB */}
        <div className={`section ${activeSection === 'calendar' ? 'active' : ''}`}>
          <div className="card">
            <div className="card-header"><div><p className="card-title">Activation Schedule</p></div></div>
            <div className="cal-grid">
              {metrics.calendar.map((event, index) => (
                <div className={`cal-card status-${event.status}`} key={index}>
                  <p className="cal-date">{event.date} <span className="cal-time">{event.time}</span></p>
                  <p className="cal-store">{event.store}</p>
                  <p className="cal-market">{event.market} {event.address && `· ${event.address}`}</p>
                  {event.products && <div className="cal-products">🎁 {event.products}</div>}
                  
                  <div className="cal-footer">
                    <div>
                      <span className={`cal-status status-${event.status}`}>{event.status}</span>
                    </div>
                    
                    {/* NEW: Edit/Cancel Buttons for Upcoming Events */}
                    {event.status === 'Upcoming' && (
                      <div className="cal-actions">
                        <button className="btn-action" onClick={() => setChangeModal({isOpen: true, type: 'Edit', event, notes: ''})}>Edit</button>
                        <button className="btn-action" onClick={() => setChangeModal({isOpen: true, type: 'Cancel', event, notes: ''})}>Cancel</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {metrics.calendar.length === 0 && <p style={{fontSize: '12px', color: '#888'}}>No activations found.</p>}
            </div>
          </div>
        </div>

        {/* INTEL TAB */}
        <div className={`section ${activeSection === 'intel' ? 'active' : ''}`}>
          <div className="card">
            <div className="card-header"><div><p className="card-title">Market Intelligence</p><p className="card-sub">Latest feedback and photos</p></div></div>
            {metrics.intel.map((item, index) => (
               <div className="intel-item" key={index}>
                  <span className="intel-icon">{item.icon}</span>
                  <p className="intel-text">{item.text}</p>
                  {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="intel-link">View Photo</a>}
               </div>
            ))}
            {metrics.intel.length === 0 && <p style={{fontSize: '12px', color: '#888'}}>No intel gathered yet.</p>}
          </div>
        </div>

        {/* REQUEST TAB */}
        <div className={`section ${activeSection === 'request' ? 'active' : ''}`}>
          <div className="card">
            <div className="card-header"><div><p className="card-title">Request Activation</p></div></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Store Name</label><input type="text" name="storeName" value={formData.storeName} onChange={handleInputChange} className="form-input" placeholder="e.g. Total Wine" /></div>
              <div className="form-group"><label className="form-label">Store Address</label><input type="text" name="address" value={formData.address} onChange={handleInputChange} className="form-input" placeholder="e.g. 123 Main St, Orlando, FL" /></div>
              <div className="form-group"><label className="form-label">Preferred Date</label><input type="date" name="date" value={formData.date} onChange={handleInputChange} className="form-input" /></div>
              <div className="form-group"><label className="form-label">Time (From - To)</label><div className="time-inputs"><input type="time" name="startTime" value={formData.startTime} onChange={handleInputChange} className="form-input" style={{flex: 1}} /><span>-</span><input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} className="form-input" style={{flex: 1}} /></div></div>
              
              {/* NEW: Notes Field */}
              <div className="form-group full">
                <label className="form-label">Additional Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} className="form-input form-textarea" placeholder="Any specific requirements, target demographics, or special instructions..." />
              </div>
            </div>
            <button className="btn-submit" onClick={submitRequest} disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Submit Request"}
            </button>
            {showSuccess && <div className="success-msg">{uploadMessage}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
