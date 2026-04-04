"use client";
import { useState } from "react";

export default function UnifiedDashboard() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  // Handles the manual form submission
  const submitRequest = () => {
    setShowSuccess(true);
    setUploadMessage("✅ Request submitted successfully.");
    setTimeout(() => {
      setShowSuccess(false);
      setUploadMessage("");
    }, 5000);
  };

  // Handles the file upload button
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileName = e.target.files[0].name;
      setShowSuccess(true);
      setUploadMessage(`✅ Bulk upload successful: ${fileName}`);
      setTimeout(() => {
        setShowSuccess(false);
        setUploadMessage("");
      }, 5000);
    }
  };

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
        .topbar-left h1 { font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 700; color: var(--black); margin: 0; }
        .topbar-left p { font-size: 13px; color: var(--muted); margin-top: 2px; margin-bottom: 0; }
        .topbar-right { display: flex; align-items: center; gap: 10px; }
        .badge { background: var(--green-pale); color: var(--green); font-size: 11px; font-weight: 600; padding: 5px 12px; border-radius: 20px; }
        .badge-orange { background: #fef3ec; color: var(--orange); }
        .section { display: none; } .section.active { display: block; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
        .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 20px; position: relative; overflow: hidden; }
        .stat-card::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: var(--green); opacity: 0; transition: opacity 0.2s; }
        .stat-card:hover::after { opacity: 1; }
        .stat-label { font-size: 11px; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 10px; margin-top: 0; }
        .stat-value { font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 700; color: var(--black); line-height: 1; margin-bottom: 6px; margin-top: 0; }
        .stat-value.green { color: var(--green); }
        .stat-delta { font-size: 11px; color: var(--green-light); font-weight: 500; margin: 0; }
        .two-col { display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; margin-bottom: 20px; }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; margin-bottom: 14px; }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .card-title { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--black); margin: 0; }
        .card-sub { font-size: 11px; color: var(--muted); margin-top: 2px; margin-bottom: 0; }
        .chart-bars { display: flex; align-items: flex-end; gap: 10px; height: 140px; padding-bottom: 24px; position: relative; }
        .chart-bars::after { content: ''; position: absolute; bottom: 24px; left: 0; right: 0; height: 1px; background: var(--border); }
        .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
        .bar-fill { width: 100%; border-radius: 5px 5px 0 0; background: var(--green); transition: height 0.4s ease; position: relative; }
        .bar-fill.light { background: var(--green-pale); border: 1px solid var(--green-light); }
        .bar-label { font-size: 10px; color: var(--muted); margin-top: 6px; text-align: center; white-space: nowrap; margin-bottom: 0; }
        .bar-val { position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: 600; color: var(--black); white-space: nowrap; }
        .conv-meter { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
        .conv-label { font-size: 13px; color: #555; min-width: 120px; }
        .conv-track { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
        .conv-fill { height: 100%; border-radius: 4px; background: var(--green); }
        .conv-val { font-size: 13px; font-weight: 600; color: var(--green); min-width: 40px; text-align: right; }
        .cal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .cal-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
        .cal-card.completed { border-left: 3px solid var(--green); } .cal-card.upcoming { border-left: 3px solid var(--orange); }
        .cal-date { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 6px; margin-top: 0; }
        .cal-store { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--black); margin-bottom: 4px; margin-top: 0; }
        .cal-market { font-size: 11px; color: var(--muted); margin-bottom: 10px; margin-top: 0; }
        .cal-status { font-size: 10px; font-weight: 600; padding: 3px 9px; border-radius: 10px; display: inline-block; }
        .cs-done { background: var(--green-pale); color: var(--green); } .cs-upcoming { background: #fef3ec; color: var(--orange); }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
        .form-input { font-family: 'Outfit', sans-serif; font-size: 13px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--black); outline: none; }
        .time-inputs { display: flex; align-items: center; gap: 10px; }
        .time-inputs span { font-size: 12px; color: var(--muted); font-weight: bold; }
        .btn-submit { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; background: var(--green); color: white; border: none; padding: 12px 28px; border-radius: 8px; cursor: pointer; transition: opacity 0.2s; }
        .btn-submit:hover { opacity: 0.9; }
        .success-msg { background: var(--green-pale); border: 1px solid var(--green-light); border-radius: 8px; padding: 14px 18px; font-size: 13px; color: var(--green); font-weight: 500; margin-top: 14px; }
        .intel-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
        .intel-icon { font-size: 16px; width: 24px; flex-shrink: 0; margin-top: 1px; }
        .intel-text { color: #555; line-height: 1.5; margin: 0; } .intel-text strong { color: var(--black); font-weight: 600; }
        
        /* New Bulk Upload Styles */
        .bulk-upload-area { margin-top: 30px; padding: 24px; border: 2px dashed var(--border); border-radius: 12px; text-align: center; background: #fafaf8; }
        .bulk-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: var(--black); }
        .bulk-desc { font-size: 12px; color: var(--muted); margin-bottom: 16px; }
        .btn-upload { display: inline-block; background: var(--green-pale); color: var(--green); font-size: 12px; font-weight: 700; padding: 10px 20px; border-radius: 6px; cursor: pointer; transition: all 0.2s; border: 1px solid var(--green-light); }
        .btn-upload:hover { background: var(--green); color: white; }
      `}} />

      {/* SIDEBAR */}
      <div className="sidebar">
        <p className="sidebar-logo">Greenline Activations</p>
        <p className="sidebar-brand">3CHI</p>

        <p className="nav-label">Menu</p>
        <a className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveSection('dashboard')}>
          <span className="icon">📊</span> Dashboard
        </a>
        <a className={`nav-item ${activeSection === 'calendar' ? 'active' : ''}`} onClick={() => setActiveSection('calendar')}>
          <span className="icon">📅</span> Activation Calendar
        </a>
        <a className={`nav-item ${activeSection === 'intel' ? 'active' : ''}`} onClick={() => setActiveSection('intel')}>
          <span className="icon">🔍</span> Market Intel
        </a>
        <a className={`nav-item ${activeSection === 'request' ? 'active' : ''}`} onClick={() => setActiveSection('request')}>
          <span className="icon">➕</span> Request Activation
        </a>
      </div>

      {/* MAIN CONTENT */}
      <div className="main">
        <div className="topbar">
          <div className="topbar-left">
            <h1>Activation Dashboard</h1>
            <p>March 2026 · Sprint 1 · Florida</p>
          </div>
          <div className="topbar-right">
            <span className="badge">8 Activations Complete</span>
            <span className="badge badge-orange">4 Upcoming</span>
          </div>
        </div>

        {/* DASHBOARD TAB */}
        <div className={`section ${activeSection === 'dashboard' ? 'active' : ''}`}>
          <div className="stat-grid">
            <div className="stat-card"><p className="stat-label">Consumers Sampled</p><p className="stat-value">318</p><p className="stat-delta">↑ Across 8 activations</p></div>
            <div className="stat-card"><p className="stat-label">Total Purchases</p><p className="stat-value green">47</p><p className="stat-delta">↑ Units sold</p></div>
            <div className="stat-card"><p className="stat-label">Avg Conversion Rate</p><p className="stat-value">16%</p><p className="stat-delta">↑ Midtown 18%</p></div>
            <div className="stat-card"><p className="stat-label">Activations</p><p className="stat-value">8 <span style={{fontSize:'16px', color:'var(--muted)'}}>/ 12</span></p><p className="stat-delta">Sprint 1 in progress</p></div>
          </div>

          <div className="two-col">
            <div className="card">
              <div className="card-header"><div><p className="card-title">Consumers Reached by Market</p><p className="card-sub">Sprint 1</p></div></div>
              <div className="chart-bars">
                <div className="bar-col"><div className="bar-fill" style={{height:'85%'}}><span className="bar-val">142</span></div><p className="bar-label">Melbourne</p></div>
                <div className="bar-col"><div className="bar-fill" style={{height:'72%'}}><span className="bar-val">120</span></div><p className="bar-label">St. Johns</p></div>
                <div className="bar-col"><div className="bar-fill light" style={{height:'45%'}}><span className="bar-val">34</span></div><p className="bar-label">Longwood</p></div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div><p className="card-title">Conversion</p><p className="card-sub">Sample-to-purchase</p></div></div>
              <div className="conv-meter"><span className="conv-label">Midtown</span><div className="conv-track"><div className="conv-fill" style={{width:'78%'}}></div></div><span className="conv-val">18%</span></div>
              <div className="conv-meter"><span className="conv-label">Beachwalk</span><div className="conv-track"><div className="conv-fill" style={{width:'72%'}}></div></div><span className="conv-val">17%</span></div>
            </div>
          </div>
        </div>

        {/* CALENDAR TAB */}
        <div className={`section ${activeSection === 'calendar' ? 'active' : ''}`}>
          <div className="card">
            <div className="card-header"><div><p className="card-title">Activation Calendar</p><p className="card-sub">Sprint 1</p></div></div>
            <div className="cal-grid">
              <div className="cal-card completed"><p className="cal-date">Feb 27, 2026</p><p className="cal-store">Shores Beachwalk</p><p className="cal-market">St. Augustine · 4-7pm</p><span className="cal-status cs-done">✓ Complete</span></div>
              <div className="cal-card upcoming"><p className="cal-date">Mar 27, 2026</p><p className="cal-store">Shores Rivertown</p><p className="cal-market">St. Johns · 4-7pm</p><span className="cal-status cs-upcoming">⏳ Upcoming</span></div>
            </div>
          </div>
        </div>

        {/* INTEL TAB */}
        <div className={`section ${activeSection === 'intel' ? 'active' : ''}`}>
          <div className="card">
            <div className="card-header"><div><p className="card-title">Market Intelligence</p><p className="card-sub">Field observations</p></div></div>
            <div className="intel-item"><span className="intel-icon">🍋‍🟩</span><p className="intel-text"><strong>Tart Lime dominates.</strong> Top sampled and purchased SKU across all locations.</p></div>
          </div>
        </div>

        {/* REQUEST TAB */}
        <div className={`section ${activeSection === 'request' ? 'active' : ''}`}>
          <div className="card">
            <div className="card-header">
              <div>
                <p className="card-title">Request Activation</p>
                <p className="card-sub">Greenline will confirm within 48 hours.</p>
              </div>
            </div>
            
            {/* Manual Form Area */}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Store Name</label>
                <input type="text" className="form-input" placeholder="e.g. Total Wine" />
              </div>
              <div className="form-group">
                <label className="form-label">Store Address</label>
                <input type="text" className="form-input" placeholder="e.g. 123 Main St, Orlando, FL" />
              </div>
              <div className="form-group">
                <label className="form-label">Preferred Date</label>
                <input type="date" className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Time (From - To)</label>
                <div className="time-inputs">
                  <input type="time" className="form-input" style={{flex: 1}} />
                  <span>-</span>
                  <input type="time" className="form-input" style={{flex: 1}} />
                </div>
              </div>
            </div>
            
            <button className="btn-submit" onClick={submitRequest}>Submit Request</button>

            {/* Bulk Upload Area */}
            <div className="bulk-upload-area">
              <p className="bulk-title">Have multiple activations?</p>
              <p className="bulk-desc">Upload a CSV or Excel file to request multiple stores at once.</p>
              <label className="btn-upload">
                Choose CSV / Excel File
                {/* This input is hidden, clicking the label triggers the upload window */}
                <input 
                  type="file" 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                  style={{ display: 'none' }} 
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            {/* Success Message Banner */}
            {showSuccess && <div className="success-msg">{uploadMessage}</div>}
          </div>
        </div>

      </div>
    </div>
  );
}
