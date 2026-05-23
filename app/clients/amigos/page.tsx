"use client";
import { useState, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { supabase } from "../../../lib/supabase-client";

const TARGET_BRAND = "AMIGOS";

export default function UnifiedDashboard() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // PDF Loading States
  const [isExportingDashboard, setIsExportingDashboard] = useState(false);
  const [isExportingRecap, setIsExportingRecap] = useState(false);

  // Modal States
  const [changeModal, setChangeModal] = useState({ isOpen: false, type: "", event: null as any, notes: "" });
  const [selectedRecap, setSelectedRecap] = useState<any>(null);

  const [formData, setFormData] = useState({
    storeName: "", address: "", date: "", startTime: "", endTime: "", notes: ""
  });

  const [metrics, setMetrics] = useState({
    sampled: 0, sold: 0, activations: 0, conversion: 0,
    markets: [] as any[], upcoming: [] as any[], previous: [] as any[], intel: [] as any[]
  });

  const ITEMS_PER_PAGE = 6;
  const [visibleUpcoming, setVisibleUpcoming] = useState(ITEMS_PER_PAGE);
  const [visiblePrevious, setVisiblePrevious] = useState(ITEMS_PER_PAGE);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [expandedNotif, setExpandedNotif] = useState<string | null>(null);

  const fetchLiveData = async () => {
    setIsLoading(true);
    setVisibleUpcoming(ITEMS_PER_PAGE);
    setVisiblePrevious(ITEMS_PER_PAGE);
    try {
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('brand', TARGET_BRAND);

      if (error) throw error;

      let newCalendar: any[] = [];
      let totalSampled = 0; let totalSold = 0; let totalActivations = 0;
      let cityCounts: Record<string, number> = {};
      let flavorCounts: Record<string, number> = {};
      let newIntel: any[] = [];

      const completedEvents = events?.filter(e => e.status === 'completed') || [];
      const upcomingEvents = events?.filter(e => e.status === 'upcoming') || [];

      completedEvents.forEach(row => {
        if (!row.store_name) return;

        totalActivations++;
        totalSampled += row.sampled || 0;
        totalSold += row.sold || 0;

        const city = row.market || 'Unknown';
        cityCounts[city] = (cityCounts[city] || 0) + (row.sampled || 0);

        const flavor = row.top_flavor;
        if (flavor) flavorCounts[flavor] = (flavorCounts[flavor] || 0) + 1;

        const objections = row.objections;
        if (objections && objections.trim() !== "" && objections.toLowerCase() !== "none") {
            newIntel.push({ type: 'objection', icon: '💬', text: `Objection at ${row.store_name || city}: ${objections}` });
        }

        const photoField = row.photo_link;
        if (photoField) {
          const photoUrls = photoField.split(/[\n,]+/).map((s: string) => s.trim()).filter((s: string) => s.startsWith('http'));
          photoUrls.forEach((photoLink: string, idx: number) => {
            newIntel.push({ type: 'photo', icon: '📸', text: `Engagement photo${photoUrls.length > 1 ? ` ${idx + 1}` : ''} from ${row.store_name || city}.`, link: photoLink });
          });
        }

        newCalendar.push({
          date: row.date, store: row.store_name, market: city,
          time: row.shift_start && row.shift_end ? `${row.shift_start}-${row.shift_end}` : '',
          status: "Complete", sortDate: new Date(row.date),
          fullData: row
        });
      });

      upcomingEvents.forEach(row => {
        if (!row.store_name || !row.date) return;

        newCalendar.push({
          date: row.date, store: row.store_name, market: row.market || 'TBD',
          address: row.address || '', time: row.start_time && row.end_time ? `${row.start_time} - ${row.end_time}` : '',
          products: row.products || '', samplingType: row.sampling_type || '',
          purchaseReq: row.product_purchase || '', status: "Upcoming", sortDate: new Date(row.date)
        });
      });

      let bestFlavor = "No data"; let maxFlavorCount = 0;
      for (const [flavor, count] of Object.entries(flavorCounts)) {
        if (count > maxFlavorCount) { bestFlavor = flavor; maxFlavorCount = count; }
      }

      if (bestFlavor !== "No data") {
        newIntel.unshift({ type: 'flavor', icon: '🏆', text: `Top performing SKU across recent activations is ${bestFlavor}.` });
      }

      const markets = Object.entries(cityCounts).map(([city, value]) => ({ city, value })).sort((a, b) => b.value - a.value).slice(0, 3);

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const filteredUpcomingEvents = newCalendar
        .filter(e => e.status === 'Upcoming' && e.sortDate >= today)
        .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

      const filteredPreviousEvents = newCalendar
        .filter(e => e.status === 'Complete')
        .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

      if (totalActivations > 0 || newCalendar.length > 0) {
        setMetrics({
          sampled: totalSampled, sold: totalSold, activations: totalActivations,
          conversion: totalSampled > 0 ? Math.round((totalSold / totalSampled) * 100) : 0,
          markets: markets,
          upcoming: filteredUpcomingEvents,
          previous: filteredPreviousEvents,
          intel: newIntel.slice(0, 5)
        });
      }
    } catch (error) { console.error("Failed to fetch data", error); }
    setIsLoading(false);
  };

  const fetchNotifications = async () => {
    setNotifLoading(true);
    try {
      const res = await fetch(`/api/notifications?client=${encodeURIComponent(TARGET_BRAND)}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (e) { console.error('Failed to fetch notifications', e); }
    setNotifLoading(false);
  };

  const markAsRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: TARGET_BRAND, markAllRead: true })
    });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const formatNotifTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    } catch { return ts; }
  };

  const notifTypeColor: Record<string, string> = {
    email: 'var(--canopy-pale)', alert: 'var(--street)', update: '#c7d7fe', announcement: '#fde68a'
  };
  const notifTypeDark: Record<string, boolean> = { alert: true };
  const emailStatusColor: Record<string, string> = {
    delivered: 'var(--canopy-pale)', sent: '#c7d7fe', failed: 'var(--street-pale)', pending: '#fde68a'
  };

  useEffect(() => { fetchLiveData(); fetchNotifications(); }, []);
  useEffect(() => { document.title = "Greenline Activations | AMIGOS Dashboard"; }, []);

  // --- PDF GENERATION FUNCTIONS ---
  const downloadDashboardReport = async () => {
    setIsExportingDashboard(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const element = document.getElementById("dashboard-export-area");
      if (!element) return;
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#faf0ea" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${TARGET_BRAND}_Activation_Report.pdf`);
    } catch (error) {
      console.error("PDF generation failed", error);
      alert("Failed to generate PDF. Please try again.");
    }
    setIsExportingDashboard(false);
  };

const downloadRecapReport = async () => {
    setIsExportingRecap(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const element = document.getElementById("recap-export-area");
      if (!element) return;

      // 1. MAGIC TRICK: Temporarily expand the modal to show everything
      const originalMaxHeight = element.style.maxHeight;
      const originalOverflow = element.style.overflow;
      element.style.maxHeight = "none";
      element.style.overflow = "visible";

      // Take the full-height screenshot
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff" });
      
      // 2. Put the modal back to normal immediately
      element.style.maxHeight = originalMaxHeight || "85vh";
      element.style.overflow = originalOverflow || "auto";

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      // 3. MULTI-PAGE MATH: Calculate if it needs more than 1 page
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add the first page
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      // Keep adding new pages until we run out of image!
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Recap_${selectedRecap.store.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("PDF generation failed", error);
      alert("Failed to generate Recap PDF.");
    }
    setIsExportingRecap(false);
  };

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

  const renderRecapValue = (val: string) => {
    const urls = val.split(/[\n,]+/).map(s => s.trim()).filter(s => s.startsWith('http'));
    if (urls.length > 1) {
      return (
        <span style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
          {urls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{color: 'var(--ink)', fontWeight: '700', textDecoration: 'underline'}}>
              View Photo {i + 1} ↗
            </a>
          ))}
        </span>
      );
    }
    if (val.startsWith('http')) {
      return <a href={val} target="_blank" rel="noopener noreferrer" style={{color: 'var(--ink)', fontWeight: '700', textDecoration: 'underline'}}>View Link / File ↗</a>;
    }
    return val;
  };

  return (
    <div className="dashboard-wrapper">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800,900,500&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        .dashboard-wrapper {
          --bone: #faf0ea; --ink: #0a0a0a; --white: #ffffff;
          --canopy: #56e39f; --canopy-pale: #d6f8ea;
          --street: #ff4f33; --street-pale: #ffe3de;
          --muted: #767672; --card: #ffffff; --border: #0a0a0a;
          --shadow: 4px 4px 0 0 #0a0a0a; --shadow-lg: 6px 6px 0 0 #0a0a0a;
          --bg: var(--bone); --black: var(--ink);
          --green: var(--canopy); --green-light: var(--canopy); --green-pale: var(--canopy-pale);
          --orange: var(--street);
          font-family: 'Manrope', system-ui, sans-serif;
          background: var(--bone); color: var(--ink);
          min-height: 100vh; position: absolute; top: 0; left: 0; right: 0; z-index: 10;
          -webkit-font-smoothing: antialiased;
        }
        .dashboard-wrapper * { box-sizing: border-box; }

        .sidebar { position: fixed; top: 0; left: 0; width: 220px; height: 100vh; background: var(--ink); border-right: 2px solid var(--ink); padding: 28px 20px; display: flex; flex-direction: column; z-index: 100; }
        .sidebar-logo { font-family: 'Cabinet Grotesk', sans-serif; font-size: 10px; font-weight: 700; color: rgba(250,240,234,0.45); letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 4px; }
        .sidebar-brand { font-family: 'Cabinet Grotesk', sans-serif; font-size: 22px; font-weight: 800; color: var(--bone); margin-bottom: 36px; letter-spacing: -0.02em; }
        .nav-label { font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(250,240,234,0.3); margin-bottom: 8px; margin-top: 20px; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 0; font-size: 11px; font-weight: 700; color: rgba(250,240,234,0.6); cursor: pointer; transition: all 0.15s; margin-bottom: 2px; text-decoration: none; text-transform: uppercase; letter-spacing: 0.06em; border: 2px solid transparent; }
        .nav-item:hover, .nav-item.active { background: var(--canopy); color: var(--ink); border-color: var(--canopy); }
        .nav-item .icon { font-size: 14px; width: 18px; text-align: center; }

        .main { margin-left: 220px; padding: 32px; min-height: 100vh; padding-top: 80px; }
        .topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
        .topbar-left h1 { font-family: 'Cabinet Grotesk', sans-serif; font-size: 26px; font-weight: 800; color: var(--ink); margin: 0; display: flex; align-items: center; gap: 12px; letter-spacing: -0.02em; }
        .topbar-left p { font-size: 12px; font-weight: 500; color: var(--muted); margin-top: 2px; margin-bottom: 0; }
        .topbar-right { display: flex; align-items: center; gap: 16px; }
        .badge { background: var(--canopy); color: var(--ink); font-size: 10px; font-weight: 700; padding: 4px 12px; border: 2px solid var(--ink); text-transform: uppercase; letter-spacing: 0.08em; }
        .btn-action-primary { background: var(--white); border: 2px solid var(--ink); padding: 6px 12px; font-size: 10px; font-weight: 700; cursor: pointer; color: var(--ink); transition: all 0.15s; display: flex; align-items: center; gap: 6px; box-shadow: 3px 3px 0 0 var(--ink); text-transform: uppercase; letter-spacing: 0.05em; }
        .btn-action-primary:hover { transform: translate(-2px, -2px); box-shadow: 4px 4px 0 0 var(--ink); }
        .btn-action-primary:active { transform: translate(0,0); box-shadow: none; }

        .section { display: none; } .section.active { display: block; }

        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
        .stat-card { background: var(--card); border: 2px solid var(--ink); padding: 20px; box-shadow: var(--shadow); position: relative; overflow: hidden; }
        .stat-label { font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 10px; margin-top: 0; }
        .stat-value { font-family: 'Cabinet Grotesk', sans-serif; font-size: 34px; font-weight: 800; color: var(--ink); line-height: 1; margin-bottom: 6px; margin-top: 0; letter-spacing: -0.02em; }
        .stat-value.green { color: var(--canopy); }

        .two-col { display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; margin-bottom: 20px; }
        .card { background: var(--card); border: 2px solid var(--ink); padding: 22px; margin-bottom: 14px; box-shadow: var(--shadow); }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .card-title { font-family: 'Cabinet Grotesk', sans-serif; font-size: 15px; font-weight: 800; color: var(--ink); margin: 0; letter-spacing: -0.02em; }
        .card-sub { font-size: 11px; font-weight: 500; color: var(--muted); margin-top: 2px; margin-bottom: 0; }

        .chart-bars { display: flex; align-items: flex-end; gap: 10px; height: 140px; padding-bottom: 24px; position: relative; }
        .chart-bars::after { content: ''; position: absolute; bottom: 24px; left: 0; right: 0; height: 2px; background: var(--ink); }
        .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
        .bar-fill { width: 100%; border-radius: 0; background: var(--canopy); border: 2px solid var(--ink); border-bottom: none; transition: height 0.6s ease; position: relative; }
        .bar-label { font-size: 10px; font-weight: 700; color: var(--muted); margin-top: 6px; text-align: center; white-space: nowrap; margin-bottom: 0; text-transform: uppercase; letter-spacing: 0.06em; }
        .bar-val { position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: 700; color: var(--ink); white-space: nowrap; }

        .cal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .cal-card { background: var(--card); border: 2px solid var(--ink); border-left: 4px solid var(--ink); padding: 16px; display: flex; flex-direction: column; box-shadow: 3px 3px 0 0 var(--ink); }
        .cal-card.clickable { cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }
        .cal-card.clickable:hover { transform: translate(-2px, -2px); box-shadow: 5px 5px 0 0 var(--ink); }
        .cal-view-details { font-size: 10px; font-weight: 700; color: var(--ink); margin-top: 8px; text-transform: uppercase; letter-spacing: 0.08em; display: flex; align-items: center; gap: 4px; }
        .cal-card.status-Complete { border-left-color: var(--canopy); }
        .cal-card.status-Upcoming { border-left-color: var(--street); }
        .cal-date { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 6px; margin-top: 0; display: flex; justify-content: space-between; }
        .cal-time { text-transform: none; font-weight: 500; }
        .cal-store { font-family: 'Cabinet Grotesk', sans-serif; font-size: 14px; font-weight: 800; color: var(--ink); margin-bottom: 4px; margin-top: 0; letter-spacing: -0.01em; }
        .cal-market { font-size: 11px; font-weight: 500; color: var(--muted); margin-bottom: 8px; margin-top: 0; }
        .cal-products { font-size: 10px; font-weight: 700; color: var(--ink); margin-top: -4px; margin-bottom: 12px; background: var(--canopy-pale); border: 1px solid var(--ink); padding: 3px 8px; display: inline-block; text-transform: uppercase; letter-spacing: 0.05em; }
        .cal-footer { display: flex; align-items: center; gap: 8px; justify-content: space-between; margin-top: auto; }
        .cal-status { font-size: 10px; font-weight: 700; padding: 3px 9px; display: inline-block; text-transform: uppercase; letter-spacing: 0.08em; border: 2px solid var(--ink); }
        .cal-status.status-Complete { background: var(--canopy); color: var(--ink); }
        .cal-status.status-Upcoming { background: var(--street); color: var(--bone); }
        .cal-actions { display: flex; gap: 4px; }
        .btn-action { font-size: 10px; font-weight: 700; padding: 4px 8px; border: 2px solid var(--ink); background: var(--white); cursor: pointer; color: var(--ink); text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 2px 2px 0 0 var(--ink); transition: all 0.15s; }
        .btn-action:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 0 var(--ink); }
        .btn-action:active { transform: none; box-shadow: none; }

        .intel-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 2px solid var(--ink); font-size: 13px; align-items: center; }
        .intel-icon { font-size: 16px; width: 24px; flex-shrink: 0; margin-top: 1px; }
        .intel-text { color: var(--ink); font-weight: 500; line-height: 1.5; margin: 0; flex: 1; }
        .intel-link { color: var(--ink); text-decoration: none; font-weight: 700; font-size: 10px; padding: 4px 8px; border: 2px solid var(--ink); background: var(--canopy); text-transform: uppercase; letter-spacing: 0.06em; box-shadow: 2px 2px 0 0 var(--ink); transition: all 0.15s; }
        .intel-link:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 0 var(--ink); }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group.full { grid-column: 1 / -1; }
        .form-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: var(--ink); }
        .form-input { font-family: 'Manrope', sans-serif; font-size: 13px; font-weight: 500; padding: 10px 14px; border: 2px solid var(--ink); border-radius: 0; background: var(--white); color: var(--ink); outline: none; transition: all 0.15s; }
        .form-input:focus { box-shadow: 3px 3px 0 0 var(--ink); transform: translate(-2px, -2px); }
        .form-input::placeholder { color: rgba(10,10,10,0.35); }
        .form-textarea { resize: vertical; min-height: 80px; }
        .time-inputs { display: flex; align-items: center; gap: 10px; }
        .btn-submit { font-family: 'Cabinet Grotesk', sans-serif; font-size: 12px; font-weight: 700; background: var(--ink); color: var(--bone); border: 2px solid var(--ink); padding: 12px 28px; cursor: pointer; box-shadow: var(--shadow); transition: all 0.15s; text-transform: uppercase; letter-spacing: 0.08em; }
        .btn-submit:hover { transform: translate(-2px, -2px); box-shadow: var(--shadow-lg); }
        .btn-submit:active { transform: none; box-shadow: none; }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .success-msg { background: var(--canopy-pale); border: 2px solid var(--ink); padding: 14px 18px; font-size: 13px; font-weight: 600; color: var(--ink); margin-top: 14px; box-shadow: 3px 3px 0 0 var(--ink); }

        .loading-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(250,240,234,0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1000; }
        .spinner { border: 4px solid rgba(10,10,10,0.1); width: 40px; height: 40px; border-radius: 0; border-left-color: var(--ink); animation: spin 1s linear infinite; margin-bottom: 16px; }

        .modal-overlay { position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(10,10,10,0.6); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 20px; }
        .modal-content { background: var(--bone); padding: 24px; border: 2px solid var(--ink); box-shadow: var(--shadow-lg); width: 100%; max-width: 400px; }
        .modal-content.large { max-width: 700px; max-height: 85vh; overflow-y: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--ink); padding-bottom: 16px; margin-bottom: 16px; }
        .modal-title { font-family: 'Cabinet Grotesk', sans-serif; font-size: 20px; font-weight: 800; margin: 0; letter-spacing: -0.02em; }
        .modal-desc { font-size: 12px; font-weight: 500; color: var(--muted); margin-bottom: 16px; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
        .btn-close-icon { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--ink); padding: 0; line-height: 1; font-weight: 700; }
        .btn-cancel { background: var(--bone); border: 2px solid var(--ink); padding: 10px 16px; cursor: pointer; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; box-shadow: 3px 3px 0 0 var(--ink); transition: all 0.15s; }
        .btn-cancel:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 0 var(--ink); }

        .recap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .recap-item { background: var(--white); border: 2px solid var(--ink); padding: 12px; display: flex; flex-direction: column; gap: 4px; }
        .recap-item.full-width { grid-column: 1 / -1; }
        .recap-key { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); }
        .recap-val { font-size: 13px; font-weight: 500; color: var(--ink); word-break: break-word; }

        .cal-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .cal-section-title { font-family: 'Cabinet Grotesk', sans-serif; font-size: 16px; font-weight: 800; color: var(--ink); margin: 0; letter-spacing: -0.02em; }
        .cal-section-count { font-size: 10px; font-weight: 700; padding: 3px 10px; border: 2px solid var(--ink); text-transform: uppercase; letter-spacing: 0.08em; }
        .cal-section-count.upcoming { background: var(--street); color: var(--bone); }
        .cal-section-count.previous { background: var(--canopy); color: var(--ink); }
        .cal-load-more-wrap { display: flex; justify-content: center; margin-top: 16px; }
        .btn-load-more { background: var(--white); border: 2px solid var(--ink); padding: 9px 22px; font-family: 'Manrope', sans-serif; font-size: 11px; font-weight: 700; color: var(--ink); cursor: pointer; box-shadow: 3px 3px 0 0 var(--ink); transition: all 0.15s; text-transform: uppercase; letter-spacing: 0.06em; }
        .btn-load-more:hover { transform: translate(-2px, -2px); box-shadow: 4px 4px 0 0 var(--ink); }
        .btn-load-more:active { transform: none; box-shadow: none; }
        .cal-section-divider { border: none; border-top: 2px solid var(--ink); margin: 24px 0; }

        .notif-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; gap: 12px; flex-wrap: wrap; }
        .notif-header-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .notif-unread-badge { font-size: 10px; font-weight: 700; padding: 3px 10px; border: 2px solid var(--ink); text-transform: uppercase; letter-spacing: 0.08em; background: var(--street); color: var(--bone); }
        .notif-list { display: flex; flex-direction: column; gap: 10px; }
        .notif-card { background: var(--white); border: 2px solid var(--ink); border-left: 4px solid var(--ink); padding: 16px; box-shadow: 3px 3px 0 0 var(--ink); }
        .notif-card.unread { border-left-color: var(--street); background: var(--street-pale); }
        .notif-card.read { border-left-color: var(--canopy); opacity: 0.72; }
        .notif-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
        .notif-badges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .notif-type { font-size: 9px; font-weight: 700; padding: 2px 8px; border: 2px solid var(--ink); text-transform: uppercase; letter-spacing: 0.08em; }
        .notif-email-status { font-size: 9px; font-weight: 700; padding: 2px 8px; border: 2px solid var(--ink); text-transform: uppercase; letter-spacing: 0.08em; }
        .notif-subject { font-family: 'Cabinet Grotesk', sans-serif; font-size: 14px; font-weight: 800; color: var(--ink); margin: 0 0 6px 0; letter-spacing: -0.01em; }
        .notif-body { font-size: 12px; font-weight: 500; color: var(--ink); line-height: 1.6; margin: 0; white-space: pre-wrap; word-break: break-word; }
        .notif-body.collapsed { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; }
        .notif-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; gap: 8px; }
        .notif-time { font-size: 10px; font-weight: 500; color: var(--muted); }
        .notif-footer-actions { display: flex; gap: 6px; }
        .btn-notif { font-size: 10px; font-weight: 700; padding: 4px 10px; border: 2px solid var(--ink); background: var(--white); cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 2px 2px 0 0 var(--ink); transition: all 0.15s; }
        .btn-notif:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 0 var(--ink); }
        .notif-empty { font-size: 13px; color: var(--muted); text-align: center; padding: 40px 0; }
        .nav-notif-badge { display: inline-flex; align-items: center; justify-content: center; background: var(--street); color: var(--bone); border: 1px solid var(--bone); font-size: 9px; font-weight: 700; min-width: 16px; height: 15px; padding: 0 3px; margin-left: 5px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .sidebar { position: fixed; bottom: 0; left: 0; top: auto; width: 100%; height: 70px; padding: 8px; flex-direction: row; justify-content: space-around; z-index: 999; border-top: 2px solid rgba(250,240,234,0.2); border-right: none; }
          .sidebar-logo, .sidebar-brand, .nav-label { display: none; }
          .nav-item { flex-direction: column; font-size: 9px; padding: 4px; text-align: center; gap: 4px; width: 25%; margin-bottom: 0; border: none; }
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
          .recap-grid { grid-template-columns: 1fr; }
        }
      `}} />

      {/* CHANGE REQUEST MODAL (UPCOMING) */}
      {changeModal.isOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setChangeModal({isOpen: false, type: "", event: null, notes: ""})}}>          <div className="modal-content">
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

      {/* FULL RECAP MODAL (COMPLETED) */}
      {selectedRecap && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedRecap(null)}}>
          <div className="modal-content large" id="recap-export-area">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Activation Recap: {selectedRecap.store}</h3>
                <p className="modal-desc" style={{margin: '4px 0 0 0'}}>{selectedRecap.date} · {selectedRecap.market}</p>
              </div>
              
              <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                <button className="btn-action-primary" onClick={downloadRecapReport} disabled={isExportingRecap} data-html2canvas-ignore="true">
                  {isExportingRecap ? "Generating PDF..." : "⬇ Download Report"}
                </button>
                <button className="btn-close-icon" onClick={() => setSelectedRecap(null)} data-html2canvas-ignore="true">✕</button>
              </div>
            </div>
            
            <div className="recap-grid">
              {Object.entries(selectedRecap.fullData).map(([key, val]) => {
                if (!val || String(val).trim() === '' || key === 'Store Name' || key === 'Brand Name' || key === 'Activation Date' || key === 'Timestamp' || key === 'City'|| key.toLowerCase().includes('email')) return null;
                const isLongText = String(val).length > 60 || key.includes("Notes") || key.includes("objections") || key.includes("describe");

                return (
                  <div className={`recap-item ${isLongText ? 'full-width' : ''}`} key={key}>
                    <span className="recap-key">{key}</span>
                    <span className="recap-val">{renderRecapValue(String(val))}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="sidebar" data-html2canvas-ignore="true">
        <p className="sidebar-logo">Greenline Activations</p>
        <p className="sidebar-brand">{TARGET_BRAND}</p>
        <Link href="/dashboard" className="nav-item" style={{ marginBottom: 12, opacity: 0.7 }}><span className="icon">←</span> Main Dashboard</Link>
        <p className="nav-label">Menu</p>
        <a className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveSection('dashboard')}><span className="icon">📊</span> Dashboard</a>
        <a className={`nav-item ${activeSection === 'calendar' ? 'active' : ''}`} onClick={() => setActiveSection('calendar')}><span className="icon">📅</span> Activation Calendar</a>
        <a className={`nav-item ${activeSection === 'intel' ? 'active' : ''}`} onClick={() => setActiveSection('intel')}><span className="icon">🔍</span> Market Intel</a>
        <a className={`nav-item ${activeSection === 'request' ? 'active' : ''}`} onClick={() => setActiveSection('request')}><span className="icon">➕</span> Request Activation</a>
        <a className={`nav-item ${activeSection === 'notifications' ? 'active' : ''}`} onClick={() => setActiveSection('notifications')}>
          <span className="icon">🔔</span> Notifications
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="nav-notif-badge">{notifications.filter(n => !n.read).length}</span>
          )}
        </a>
      </div>

      <div className="main" id="dashboard-export-area">
        <div className="topbar">
          <div className="topbar-left">
            <h1>
              Activation Dashboard 
              <div style={{display: 'flex', gap: '8px', marginTop: '10px'}} data-html2canvas-ignore="true">
                <button className="btn-action-primary" onClick={fetchLiveData}>↻ Sync Data</button>
                <button className="btn-action-primary" onClick={downloadDashboardReport} disabled={isExportingDashboard}>
                  {isExportingDashboard ? "Generating PDF..." : "⬇ Export Dashboard"}
                </button>
              </div>
            </h1>
            <p style={{marginTop: '6px'}}>Live connected to Supabase</p>
          </div>
          <div className="topbar-right" data-html2canvas-ignore="true">
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

          {/* --- UPCOMING ACTIVATIONS --- */}
          <div className="card" style={{marginBottom: '16px'}}>
            <div className="cal-section-header">
              <p className="cal-section-title">Upcoming Activations</p>
              <span className="cal-section-count upcoming">{metrics.upcoming.length} scheduled</span>
            </div>
            <div className="cal-grid">
              {metrics.upcoming.slice(0, visibleUpcoming).map((event, index) => (
                <div className="cal-card status-Upcoming" key={index}>
                  <p className="cal-date">{event.date} <span className="cal-time">{event.time}</span></p>
                  <p className="cal-store">{event.store}</p>
                  <p className="cal-market">{event.market}{event.address && ` · ${event.address}`}</p>
                  {event.products && <div className="cal-products">🎁 {event.products}</div>}
                  <div className="cal-footer">
                    <span className="cal-status status-Upcoming">Upcoming</span>
                    <div className="cal-actions" data-html2canvas-ignore="true">
                      <button className="btn-action" onClick={() => setChangeModal({isOpen: true, type: 'Edit', event, notes: ''})}>Edit</button>
                      <button className="btn-action" onClick={() => setChangeModal({isOpen: true, type: 'Cancel', event, notes: ''})}>Cancel</button>
                    </div>
                  </div>
                </div>
              ))}
              {metrics.upcoming.length === 0 && (
                <p style={{fontSize: '12px', color: '#888', gridColumn: '1/-1'}}>No upcoming activations scheduled.</p>
              )}
            </div>
            {visibleUpcoming < metrics.upcoming.length && (
              <div className="cal-load-more-wrap" data-html2canvas-ignore="true">
                <button className="btn-load-more" onClick={() => setVisibleUpcoming(v => v + ITEMS_PER_PAGE)}>
                  Load More ({metrics.upcoming.length - visibleUpcoming} remaining)
                </button>
              </div>
            )}
          </div>

          {/* --- PREVIOUS ACTIVATIONS --- */}
          <div className="card">
            <div className="cal-section-header">
              <p className="cal-section-title">Previous Activations</p>
              <span className="cal-section-count previous">{metrics.previous.length} completed</span>
            </div>
            <div className="cal-grid">
              {metrics.previous.slice(0, visiblePrevious).map((event, index) => (
                <div
                  className="cal-card status-Complete clickable"
                  key={index}
                  onClick={() => setSelectedRecap(event)}
                >
                  <p className="cal-date">{event.date} <span className="cal-time">{event.time}</span></p>
                  <p className="cal-store">{event.store}</p>
                  <p className="cal-market">{event.market}</p>
                  <div className="cal-footer">
                    <span className="cal-status status-Complete">Complete</span>
                  </div>
                  <div className="cal-view-details" data-html2canvas-ignore="true">Read Full Report →</div>
                </div>
              ))}
              {metrics.previous.length === 0 && (
                <p style={{fontSize: '12px', color: '#888', gridColumn: '1/-1'}}>No previous activations found.</p>
              )}
            </div>
            {visiblePrevious < metrics.previous.length && (
              <div className="cal-load-more-wrap" data-html2canvas-ignore="true">
                <button className="btn-load-more" onClick={() => setVisiblePrevious(v => v + ITEMS_PER_PAGE)}>
                  Load More ({metrics.previous.length - visiblePrevious} remaining)
                </button>
              </div>
            )}
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
                  {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="intel-link" data-html2canvas-ignore="true">View Photo</a>}
               </div>
            ))}
            {metrics.intel.length === 0 && <p style={{fontSize: '12px', color: '#888'}}>No intel gathered yet.</p>}
          </div>
        </div>

        {/* NOTIFICATIONS TAB */}
        <div className={`section ${activeSection === 'notifications' ? 'active' : ''}`} data-html2canvas-ignore="true">
          <div className="card">
            <div className="notif-header">
              <div>
                <p className="card-title">Notifications</p>
                <p className="card-sub">Communications and updates from your Greenline team</p>
              </div>
              <div className="notif-header-actions">
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="notif-unread-badge">{notifications.filter(n => !n.read).length} unread</span>
                )}
                <button className="btn-action-primary" onClick={fetchNotifications}>↻ Refresh</button>
                {notifications.some(n => !n.read) && (
                  <button className="btn-action-primary" onClick={markAllRead}>✓ Mark All Read</button>
                )}
              </div>
            </div>
            {notifLoading ? (
              <p className="notif-empty">Loading notifications...</p>
            ) : notifications.length === 0 ? (
              <p className="notif-empty">No notifications yet. Check back soon.</p>
            ) : (
              <div className="notif-list">
                {notifications.map((n) => (
                  <div key={n.id} className={`notif-card ${n.read ? 'read' : 'unread'}`}>
                    <div className="notif-top">
                      <div className="notif-badges">
                        <span
                          className="notif-type"
                          style={{
                            background: notifTypeColor[n.type?.toLowerCase()] || '#e5e7eb',
                            color: notifTypeDark[n.type?.toLowerCase()] ? 'var(--bone)' : 'var(--ink)'
                          }}
                        >
                          {n.type || 'general'}
                        </span>
                        {n.email_status && (
                          <span
                            className="notif-email-status"
                            style={{ background: emailStatusColor[n.email_status?.toLowerCase()] || '#e5e7eb', color: 'var(--ink)' }}
                          >
                            ✉ {n.email_status}
                          </span>
                        )}
                      </div>
                      {!n.read && (
                        <button className="btn-notif" style={{background: 'var(--canopy-pale)'}} onClick={() => markAsRead(n.id)}>
                          Mark Read
                        </button>
                      )}
                    </div>
                    <p className="notif-subject">{n.subject}</p>
                    <p className={`notif-body ${expandedNotif === n.id ? '' : 'collapsed'}`}>{n.body}</p>
                    <div className="notif-footer">
                      <span className="notif-time">{formatNotifTime(n.created_at)}</span>
                      <div className="notif-footer-actions">
                        <button className="btn-notif" onClick={() => setExpandedNotif(expandedNotif === n.id ? null : n.id)}>
                          {expandedNotif === n.id ? 'Collapse ▲' : 'Read More ▼'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* REQUEST TAB */}
        <div className={`section ${activeSection === 'request' ? 'active' : ''}`} data-html2canvas-ignore="true">
          <div className="card">
            <div className="card-header"><div><p className="card-title">Request Activation</p></div></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Store Name</label><input type="text" name="storeName" value={formData.storeName} onChange={handleInputChange} className="form-input" placeholder="e.g. Total Wine" /></div>
              <div className="form-group"><label className="form-label">Store Address</label><input type="text" name="address" value={formData.address} onChange={handleInputChange} className="form-input" placeholder="e.g. 123 Main St, Orlando, FL" /></div>
              <div className="form-group"><label className="form-label">Preferred Date</label><input type="date" name="date" value={formData.date} onChange={handleInputChange} className="form-input" /></div>
              <div className="form-group"><label className="form-label">Time (From - To)</label><div className="time-inputs"><input type="time" name="startTime" value={formData.startTime} onChange={handleInputChange} className="form-input" style={{flex: 1}} /><span>-</span><input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} className="form-input" style={{flex: 1}} /></div></div>
              
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
