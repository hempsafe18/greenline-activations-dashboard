"use client";
import { useState, useEffect } from "react";

// 1. PASTE YOUR 3CHI PUBLISHED GOOGLE SHEETS CSV LINK HERE
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS5yMhDDOY4o5F6MeFQ9G7zW9NwBstUZdILzlXDW-ZsPkY-ZVMouJA_XruNLEx9ogoNYfVR8-Uwr84B/pub?gid=91040411&single=true&output=csv";

export default function UnifiedDashboard() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // --- DYNAMIC DASHBOARD STATE ---
  const [metrics, setMetrics] = useState({
    sampled: 0, sold: 0, activations: 0, conversion: 0, 
    markets: [] as any[], 
    calendar: [] as any[],
    intel: [] as any[]
  });

  // --- CUSTOM CSV PARSER ---
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

  // --- AUTOMATIC LIVE DATA FETCH ---
  const fetchLiveData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(GOOGLE_SHEET_CSV_URL);
      const text = await response.text();
      
      const rows = parseCSV(text);
      const headers = rows[0].map((h: string) => h.trim());
      const data = rows.slice(1).map((row: string[]) => {
        let obj: any = {};
        row.forEach((val, i) => obj[headers[i]] = val);
        return obj;
      });

      let totalSampled = 0; let totalSold = 0; let totalActivations = 0;
      let cityCounts: Record<string, number> = {}; 
      let flavorCounts: Record<string, number> = {};
      let newCalendar: any[] = [];
      let newIntel: any[] = [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      data.forEach(row => {
        // Because this is a dedicated sheet, we process EVERY row that has a store name
        if (!row['Store Name']) return; 
        
        totalActivations++;
        totalSampled += parseInt(row['Total consumers sampled']) || 0;
        totalSold += parseInt(row['Estimated units sold']) || 0;
        
        const city = row['City'] || 'Unknown';
        cityCounts[city] = (cityCounts[city] || 0) + (parseInt(row['Total consumers sampled']) || 0);
        
        const flavor = row['Top performing flavor'];
        if (flavor) flavorCounts[flavor] = (flavorCounts[flavor] || 0) + 1;

        // INTEL: Consumer Objections
        const objections = row['Consumer objections encountered'];
        if (objections && objections.trim() !== "" && objections.toLowerCase() !== "none") {
            newIntel.push({
                type: 'objection',
                icon: '💬',
                text: `Objection at ${row['Store Name'] || city}: ${objections}`
            });
        }

        // INTEL: Engagement Photo Link
        const photoLink = row['Engagement photo submission'];
        if (photoLink && photoLink.includes('http')) {
             newIntel.push({
                type: 'photo',
                icon: '📸',
                text: `New engagement photo from ${row['Store Name'] || city}.`,
                link: photoLink
             });
        }

        // CALENDAR LOGIC
        if (row['Activation Date']) {
          const actDate = new Date(row['Activation Date']);
          const isUpcoming = actDate > today;

          newCalendar.push({
            date: row['Activation Date'],
            store: row['Store Name'],
            market: `${city} · ${row['Shift Start Time '] || ''}-${row['Shift End Time'] || ''}`,
            status: isUpcoming ? "Upcoming" : "Complete",
            sortDate: actDate
          });
        }
      });

      // Find top flavor
      let bestFlavor = "No data"; let maxFlavorCount = 0;
      for (const [flavor, count] of Object.entries(flavorCounts)) {
        if (count > maxFlavorCount) { bestFlavor = flavor; maxFlavorCount = count; }
      }

      // Add top flavor to intel
      if (bestFlavor !== "No data") {
        newIntel.unshift({
            type: 'flavor',
            icon: '🏆',
            text: `Top performing SKU across recent activations is ${bestFlavor}.`
        });
      }

      const markets = Object.entries(cityCounts).map(([city, value]) => ({ city, value })).sort((a, b) => b.value - a.value).slice(0, 3);
      
      newCalendar.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

      if (totalActivations > 0) {
        setMetrics({
          sampled: totalSampled, sold: totalSold, activations: totalActivations,
          conversion: totalSampled > 0 ? Math.round((totalSold / totalSampled) * 100) : 0,
          markets: markets,
          calendar: newCalendar.slice(0, 6),
          intel: newIntel.slice(0, 5)
        });
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchLiveData(); }, []);

  const submitRequest = () => {
    setShowSuccess(true);
    setUploadMessage("✅ Request submitted successfully. Greenline will review shortly.");
    setTimeout(() => setShowSuccess(false), 5000);
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
        .topbar-right { display: flex; align-items: center; gap: 10px; }
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
        .cal-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; border-left: 3px solid var(--border); }
        .cal-card.status-Complete { border-left-color: var(--green); }
        .cal-card.status-Upcoming { border-left-color: var(--orange); }
        .cal-date { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 6px; margin-top: 0; }
        .cal-store { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--black); margin-bottom: 4px; margin-top: 0; }
        .cal-market { font-size: 11px; color: var(--muted); margin-bottom: 10px; margin-top: 0; }
        .cal-status { font-size: 10px; font-weight: 600; padding: 3px 9px; border-radius: 10px; display: inline-block; }
        .cal-status.status-Complete { background: var(--green-pale); color: var(--green); }
        .cal-status.status-Upcoming { background: #fef3ec; color: var(--orange); }
        .intel-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 13px; align-items: center; }
        .intel-icon { font-size: 16px; width: 24px; flex-shrink: 0; margin-top: 1px; }
        .intel-text { color: #555; line-height: 1.5; margin: 0; flex: 1; }
        .intel-link { color: var(--green); text-decoration: none; font-weight: bold; font-size: 11px; padding: 4px 8px; border: 1px solid var(--green); border-radius: 4px; }
        .intel-link:hover { background: var(--green); color: white; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
        .form-input { font-family: 'Outfit', sans-serif; font-size: 13px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--black); outline: none; }
        .time-inputs { display: flex; align-items: center; gap: 10px; }
        .btn-submit { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; background: var(--green); color: white; border: none; padding: 12px 28px; border-radius: 8px; cursor: pointer; transition: opacity 0.2s; }
        .success-msg { background: var(--green-pale); border: 1px solid var(--green-light); border-radius: 8px; padding: 14px 18px; font-size: 13px; color: var(--green); font-weight: 500; margin-top: 14px; }
        .loading-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.8); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1000; }
        .spinner { border: 4px solid rgba(0,0,0,0.1); width: 40px; height: 40px; border-radius: 50%; border-left-color: var(--green); animation: spin 1s linear infinite; margin-bottom: 16px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}} />

      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p style={{fontWeight: 600, color: 'var(--green)'}}>Syncing live data...</p>
        </div>
      )}

      <div className="sidebar">
        <p className="sidebar-logo">Greenline Activations</p>
        <p className="sidebar-brand">3CHI</p>
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
                  <p className="cal-date">{event.date}</p>
                  <p className="cal-store">{event.store}</p>
                  <p className="cal-market">{event.market}</p>
                  <span className={`cal-status status-${event.status}`}>{event.status}</span>
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
              <div className="form-group"><label className="form-label">Store Name</label><input type="text" className="form-input" placeholder="e.g. Total Wine" /></div>
              <div className="form-group"><label className="form-label">Store Address</label><input type="text" className="form-input" placeholder="e.g. 123 Main St, Orlando, FL" /></div>
              <div className="form-group"><label className="form-label">Preferred Date</label><input type="date" className="form-input" /></div>
              <div className="form-group"><label className="form-label">Time (From - To)</label><div className="time-inputs"><input type="time" className="form-input" style={{flex: 1}} /><span>-</span><input type="time" className="form-input" style={{flex: 1}} /></div></div>
            </div>
            <button className="btn-submit" onClick={submitRequest}>Submit Request</button>
            {showSuccess && <div className="success-msg">{uploadMessage}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
