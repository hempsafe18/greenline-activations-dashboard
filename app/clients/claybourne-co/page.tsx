"use client";
import { useState, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

const TARGET_BRAND = "CLAYBOURNE_CO";

const RECAP_DISPLAY_FIELDS: { key: string; label: string; long?: boolean }[] = [
  { key: 'sampling_type', label: 'Activation Type' },
  { key: 'products_featured', label: 'Products Featured', long: true },
  { key: 'consumers_approached', label: 'Consumers Approached' },
  { key: 'consumers_sampled', label: 'QR Code Scans' },
  { key: 'qr_code_destination', label: 'QR Code Destination' },
  { key: 'loyalty_signups', label: 'Loyalty Signups' },
  { key: 'estimated_units_sold', label: 'Estimated Units Sold' },
  { key: 'top_performing_flavor', label: 'Top Performing Category' },
  { key: 'education_topics_covered', label: 'Education Topics Covered', long: true },
  { key: 'top_patient_concerns', label: 'Top Patient/Customer Concerns', long: true },
  { key: 'consumer_objections', label: 'Questions & Concerns Raised', long: true },
  { key: 'product_in_stock', label: 'Product In Stock' },
  { key: 'shelf_placement', label: 'Shelf Placement' },
  { key: 'units_start', label: 'Units at Start' },
  { key: 'units_end', label: 'Units at End' },
  { key: 'price_displayed', label: 'Price Displayed' },
  { key: 'promo_signage_present', label: 'Promo Signage' },
  { key: 'reorder_needed', label: 'Reorder Needed' },
  { key: 'reorder_flagged', label: 'Reorder Flagged' },
  { key: 'competitor_sampling', label: 'Competitor Brand Activity' },
  { key: 'competitor_details', label: 'Competitor Details', long: true },
  { key: 'spoke_with_manager', label: 'Spoke with Manager' },
  { key: 'manager_sentiment', label: 'Manager Sentiment' },
  { key: 'educated_staff', label: 'Educated Budtenders' },
  { key: 'future_activations_interest', label: 'Future Activations Interest' },
  { key: 'manager_notes', label: 'Manager Notes', long: true },
  { key: 'issues_occurred', label: 'Issues Occurred' },
  { key: 'issue_description', label: 'Issue Details', long: true },
  { key: 'compliance_issue_occurred', label: 'Compliance Issue Occurred' },
  { key: 'compliance_issue_details', label: 'Compliance Issue Details', long: true },
  { key: 'recommend_account_again', label: 'Recommend Account' },
  { key: 'followup_required', label: 'Follow-up Required' },
  { key: 'followup_description', label: 'Follow-up Notes', long: true },
  { key: 'performance_rating', label: 'Performance Rating' },
  { key: 'product_knowledge_rating', label: 'Product Knowledge Rating' },
  { key: 'arrival_status', label: 'Arrival Status' },
  { key: 'late_minutes', label: 'Minutes Late' },
  { key: 'primary_age_group', label: 'Primary Age Group' },
  { key: 'primary_gender', label: 'Primary Gender' },
  { key: 'engagement_photos', label: 'Engagement Photos', long: true },
  { key: 'setup_photo', label: 'Setup Photo' },
  { key: 'shelf_photo', label: 'Shelf Photo' },
];

export default function UnifiedDashboard() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventPhotos, setEventPhotos] = useState<{key:string; title:string; date:string; photos:{thumb:string;full:string;uploadedAt:string}[]}[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string|null>(null);
  const [openEvents, setOpenEvents] = useState<Set<string>>(new Set());
  const [photoSort, setPhotoSort] = useState<'newest'|'oldest'>('newest');
  const [photoFilter, setPhotoFilter] = useState<string>('all');

  const [isExportingDashboard, setIsExportingDashboard] = useState(false);
  const [isExportingRecap, setIsExportingRecap] = useState(false);

  const [changeModal, setChangeModal] = useState({ isOpen: false, type: "", event: null as any, notes: "" });
  const [selectedRecap, setSelectedRecap] = useState<any>(null);

  const [formData, setFormData] = useState({
    storeName: "", address: "", date: "", startTime: "", endTime: "", notes: "", market: "", brand: "", samplingType: "", products: ""
  });

  const [dropdownOptions, setDropdownOptions] = useState({ market: [], brand: [], samplingType: [], products: [] });

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

  const fetchClientData = async () => {
    setIsLoading(true);
    setVisibleUpcoming(ITEMS_PER_PAGE);
    setVisiblePrevious(ITEMS_PER_PAGE);
    try {
      const res = await fetch(`/api/client-events?client=${encodeURIComponent(TARGET_BRAND)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMetrics({
        sampled: data.sampled ?? 0,
        sold: data.sold ?? 0,
        activations: data.activations ?? 0,
        conversion: data.conversion ?? 0,
        markets: data.markets ?? [],
        upcoming: data.upcoming ?? [],
        previous: data.previous ?? [],
        intel: data.intel ?? [],
      });
    } catch (error) { console.error("Failed to fetch client data", error); }
    setIsLoading(false);
  };

  const fetchNotifications = async () => {
    setNotifLoading(true);
    try {
      const res = await fetch(`/api/notifications?client=${encodeURIComponent(TARGET_BRAND)}`);
      if (res.ok) { const data = await res.json(); setNotifications(data.notifications || []); }
    } catch (e) { console.error('Failed to fetch notifications', e); }
    setNotifLoading(false);
  };

  const markAsRead = async (id: string) => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client: TARGET_BRAND, markAllRead: true }) });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const formatNotifTime = (ts: string) => {
    try { return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); }
    catch { return ts; }
  };

  const notifTypeColor: Record<string, string> = { email: 'var(--canopy-pale)', alert: 'var(--street)', update: '#c7d7fe', announcement: '#fde68a' };
  const notifTypeDark: Record<string, boolean> = { alert: true };
  const emailStatusColor: Record<string, string> = { delivered: 'var(--canopy-pale)', sent: '#c7d7fe', failed: 'var(--street-pale)', pending: '#fde68a' };

  useEffect(() => { fetchClientData(); fetchNotifications(); }, []);

  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const res = await fetch('/api/dropdown-data?client=CLAYBOURNE_CO');
        if (res.ok) {
          const data = await res.json();
          setDropdownOptions(data);
        }
      } catch (error) {
        console.error('Failed to fetch dropdown data', error);
      }
    };
    fetchDropdownData();
  }, []);

  const fetchPhotos = async (force = false) => {
    if (photoLoading || (!force && eventPhotos.length > 0)) return;
    if (force) setEventPhotos([]);
    setPhotoLoading(true);
    try {
      const res = await fetch('/api/photos?client=claybourne-co');
      const data = await res.json();
      if (data.events) setEventPhotos(data.events);
    } catch {}
    setPhotoLoading(false);
  };

  useEffect(() => { if (activeSection === 'intel') fetchPhotos(); }, [activeSection]);

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
    } catch (error) { console.error("PDF failed", error); alert("Failed to generate PDF."); }
    setIsExportingDashboard(false);
  };

  const downloadRecapReport = async () => {
    setIsExportingRecap(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const element = document.getElementById("recap-export-area");
      if (!element) return;
      const orig = { maxHeight: element.style.maxHeight, overflow: element.style.overflow };
      element.style.maxHeight = "none"; element.style.overflow = "visible";
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff" });
      element.style.maxHeight = orig.maxHeight || "85vh"; element.style.overflow = orig.overflow || "auto";
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight; let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight); heightLeft -= pageHeight;
      while (heightLeft > 0) { position = heightLeft - imgHeight; pdf.addPage(); pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight); heightLeft -= pageHeight; }
      pdf.save(`Recap_${selectedRecap.store.replace(/\s+/g, '_')}.pdf`);
    } catch (error) { console.error("Recap PDF failed", error); alert("Failed to generate Recap PDF."); }
    setIsExportingRecap(false);
  };

  const submitRequest = async () => {
    if (!formData.storeName || !formData.date) { alert("Please fill out at least the Store Name and Date."); return; }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...formData, client: TARGET_BRAND, requestType: "New Activation Request" }) });
      if (response.ok) { setUploadMessage("✅ Request submitted successfully. The team has been notified."); setShowSuccess(true); setFormData({ storeName: "", address: "", date: "", startTime: "", endTime: "", notes: "", market: "", brand: "", samplingType: "", products: "" }); }
      else { setUploadMessage("❌ Failed to send request. Please try again."); setShowSuccess(true); }
    } catch (error) { setUploadMessage("❌ Network error."); setShowSuccess(true); }
    setIsSubmitting(false); setTimeout(() => setShowSuccess(false), 5000);
  };

  const submitChangeRequest = async () => {
    if (!changeModal.notes) { alert("Please provide details for this change."); return; }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storeName: changeModal.event.store, date: changeModal.event.date, notes: changeModal.notes, client: TARGET_BRAND, requestType: `${changeModal.type} Request` }) });
      if (response.ok) { setUploadMessage(`✅ ${changeModal.type} request sent successfully.`); setShowSuccess(true); setChangeModal({ isOpen: false, type: "", event: null, notes: "" }); }
      else { alert("Failed to send request."); }
    } catch (error) { alert("Network error."); }
    setIsSubmitting(false); setTimeout(() => setShowSuccess(false), 5000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const maxMarketValue = Math.max(...metrics.markets.map(m => m.value), 1);

  const sortedEventPhotos = eventPhotos
    .filter(ev => photoFilter === 'all' || ev.key === photoFilter)
    .map(ev => ({
      ...ev,
      photos: [...ev.photos].sort((a, b) => {
        const cmp = (a.uploadedAt || '').localeCompare(b.uploadedAt || '');
        return photoSort === 'newest' ? -cmp : cmp;
      }),
    }));

  const renderRecapValue = (val: string) => {
    const urls = val.split(/[\n,]+/).map(s => s.trim()).filter(s => s.startsWith('http'));
    if (urls.length > 1) return (<span style={{display:'flex',flexDirection:'column',gap:'6px'}}>{urls.map((url,i)=>(<a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{color:'var(--ink)',fontWeight:'700',textDecoration:'underline'}}>View Photo {i+1} ↗</a>))}</span>);
    if (val.startsWith('http')) return <a href={val} target="_blank" rel="noopener noreferrer" style={{color:'var(--ink)',fontWeight:'700',textDecoration:'underline'}}>View Link / File ↗</a>;
    return val;
  };

  return (
    <div className="dashboard-wrapper">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800,900,500&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        .dashboard-wrapper {
          --bone: #faf0ea; --ink: #0a0a0a; --white: #ffffff;
          --canopy: #a9822c; --canopy-pale: #f4e8c8;
          --street: #ff4f33; --street-pale: #ffe3de;
          --muted: #767672; --card: #ffffff;
          --shadow: 4px 4px 0 0 #0a0a0a; --shadow-lg: 6px 6px 0 0 #0a0a0a;
          font-family: 'Manrope', system-ui, sans-serif;
          background: var(--bone); color: var(--ink);
          min-height: 100vh; position: absolute; top: 0; left: 0; right: 0; z-index: 10;
          -webkit-font-smoothing: antialiased;
        }
        .dashboard-wrapper * { box-sizing: border-box; }
        .sidebar { position: fixed; top: 0; left: 0; width: 220px; height: 100vh; background: var(--ink); padding: 28px 20px; display: flex; flex-direction: column; z-index: 100; }
        .sidebar-icon { width: 24px; height: 24px; border-radius: 5px; display: block; margin-bottom: 10px; }
        .sidebar-logo { font-family: 'Cabinet Grotesk', sans-serif; font-size: 10px; font-weight: 700; color: rgba(250,240,234,0.45); letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 4px; }
        .sidebar-brand { font-family: 'Cabinet Grotesk', sans-serif; font-size: 18px; font-weight: 800; color: var(--bone); margin-bottom: 36px; letter-spacing: -0.02em; }
        .nav-label { font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(250,240,234,0.3); margin-bottom: 8px; margin-top: 20px; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; font-size: 11px; font-weight: 700; color: rgba(250,240,234,0.6); cursor: pointer; transition: all 0.15s; margin-bottom: 2px; text-decoration: none; text-transform: uppercase; letter-spacing: 0.06em; border: 2px solid transparent; }
        .nav-item:hover, .nav-item.active { background: var(--canopy); color: var(--white); border-color: var(--canopy); }
        .nav-item .icon { font-size: 14px; width: 18px; text-align: center; }
        .main { margin-left: 220px; padding: 32px; min-height: 100vh; padding-top: 80px; }
        .topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
        .topbar-left h1 { font-family: 'Cabinet Grotesk', sans-serif; font-size: 26px; font-weight: 800; color: var(--ink); margin: 0; display: flex; align-items: center; gap: 12px; letter-spacing: -0.02em; }
        .topbar-left p { font-size: 12px; font-weight: 500; color: var(--muted); margin-top: 2px; margin-bottom: 0; }
        .topbar-right { display: flex; align-items: center; gap: 16px; }
        .badge { background: var(--canopy); color: var(--white); font-size: 10px; font-weight: 700; padding: 4px 12px; border: 2px solid var(--ink); text-transform: uppercase; letter-spacing: 0.08em; }
        .btn-action-primary { background: var(--white); border: 2px solid var(--ink); padding: 6px 12px; font-size: 10px; font-weight: 700; cursor: pointer; color: var(--ink); transition: all 0.15s; display: flex; align-items: center; gap: 6px; box-shadow: 3px 3px 0 0 var(--ink); text-transform: uppercase; letter-spacing: 0.05em; }
        .btn-action-primary:hover { transform: translate(-2px,-2px); box-shadow: 4px 4px 0 0 var(--ink); }
        .section { display: none; } .section.active { display: block; }
        .stat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 20px; }
        .stat-card { background: var(--card); border: 2px solid var(--ink); padding: 20px; box-shadow: var(--shadow); }
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
        .bar-fill { width: 100%; background: var(--canopy); border: 2px solid var(--ink); border-bottom: none; transition: height 0.6s ease; position: relative; }
        .bar-label { font-size: 10px; font-weight: 700; color: var(--muted); margin-top: 6px; text-align: center; white-space: nowrap; margin-bottom: 0; text-transform: uppercase; letter-spacing: 0.06em; }
        .bar-val { position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: 700; color: var(--ink); white-space: nowrap; }
        .cal-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
        .cal-card { background: var(--card); border: 2px solid var(--ink); border-left: 4px solid var(--ink); padding: 16px; display: flex; flex-direction: column; box-shadow: 3px 3px 0 0 var(--ink); }
        .cal-card.clickable { cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }
        .cal-card.clickable:hover { transform: translate(-2px,-2px); box-shadow: 5px 5px 0 0 var(--ink); }
        .cal-card.status-Complete { border-left-color: var(--canopy); }
        .cal-card.status-Upcoming { border-left-color: var(--street); }
        .cal-date { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 6px; margin-top: 0; display: flex; justify-content: space-between; }
        .cal-store { font-family: 'Cabinet Grotesk', sans-serif; font-size: 14px; font-weight: 800; color: var(--ink); margin-bottom: 4px; margin-top: 0; }
        .cal-market { font-size: 11px; font-weight: 500; color: var(--muted); margin-bottom: 8px; margin-top: 0; }
        .cal-footer { display: flex; align-items: center; gap: 8px; justify-content: space-between; margin-top: auto; }
        .cal-status { font-size: 10px; font-weight: 700; padding: 3px 9px; display: inline-block; text-transform: uppercase; border: 2px solid var(--ink); }
        .cal-status.status-Complete { background: var(--canopy); color: var(--white); }
        .cal-status.status-Upcoming { background: var(--street); color: var(--bone); }
        .cal-actions { display: flex; gap: 4px; }
        .btn-action { font-size: 10px; font-weight: 700; padding: 4px 8px; border: 2px solid var(--ink); background: var(--white); cursor: pointer; color: var(--ink); text-transform: uppercase; box-shadow: 2px 2px 0 0 var(--ink); transition: all 0.15s; }
        .intel-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 2px solid var(--ink); font-size: 13px; align-items: center; }
        .intel-icon { font-size: 16px; width: 24px; flex-shrink: 0; }
        .intel-text { color: var(--ink); font-weight: 500; line-height: 1.5; margin: 0; flex: 1; }
        .intel-link { color: var(--white); text-decoration: none; font-weight: 700; font-size: 10px; padding: 4px 8px; border: 2px solid var(--ink); background: var(--canopy); text-transform: uppercase; }

        .photo-section { margin-top: 16px; }
        .photo-event { border: 2px solid var(--ink); margin-bottom: 10px; box-shadow: var(--shadow); background: var(--card); }
        .photo-event-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; cursor: pointer; user-select: none; }
        .photo-event-header:hover { background: var(--canopy-pale); }
        .photo-event-title { font-family: 'Cabinet Grotesk', sans-serif; font-size: 14px; font-weight: 800; color: var(--ink); margin: 0; letter-spacing: -0.01em; }
        .photo-event-count { font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; display: flex; align-items: center; gap: 10px; }
        .photo-event-chevron { font-size: 12px; transition: transform 0.2s; display: inline-block; }
        .photo-event-chevron.open { transform: rotate(180deg); }
        .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; padding: 12px; border-top: 2px solid var(--ink); }
        .photo-thumb { width: 100%; aspect-ratio: 1; object-fit: cover; cursor: pointer; border: 2px solid var(--ink); display: block; transition: all 0.15s; }
        .photo-thumb:hover { transform: translate(-2px, -2px); box-shadow: 3px 3px 0 0 var(--ink); }
        .photo-empty { font-size: 12px; color: var(--muted); text-align: center; padding: 32px 0; }
        .lightbox-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.88); z-index: 3000; display: flex; align-items: center; justify-content: center; }
        .lightbox-img { max-width: 90vw; max-height: 90vh; object-fit: contain; box-shadow: 0 0 0 3px var(--ink); }
        .lightbox-close { position: absolute; top: 20px; right: 24px; color: #fff; font-size: 28px; cursor: pointer; font-weight: 700; background: none; border: none; line-height: 1; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group.full { grid-column: 1/-1; }
        .form-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: var(--ink); }
        .form-input { font-family: 'Manrope', sans-serif; font-size: 13px; font-weight: 500; padding: 10px 14px; border: 2px solid var(--ink); background: var(--white); color: var(--ink); outline: none; }
        .form-textarea { resize: vertical; min-height: 80px; }
        .btn-submit { font-family: 'Cabinet Grotesk', sans-serif; font-size: 12px; font-weight: 700; background: var(--ink); color: var(--bone); border: 2px solid var(--ink); padding: 12px 28px; cursor: pointer; box-shadow: var(--shadow); text-transform: uppercase; }
        .success-msg { background: var(--canopy-pale); border: 2px solid var(--ink); padding: 14px 18px; font-size: 13px; font-weight: 600; color: var(--ink); margin-top: 14px; }
        .modal-overlay { position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(10,10,10,0.6); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 20px; }
        .modal-content { background: var(--bone); padding: 24px; border: 2px solid var(--ink); box-shadow: var(--shadow); width: 100%; max-width: 400px; }
        .modal-content.large { max-width: 700px; max-height: 85vh; overflow-y: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--ink); padding-bottom: 16px; margin-bottom: 16px; }
        .modal-title { font-family: 'Cabinet Grotesk', sans-serif; font-size: 20px; font-weight: 800; margin: 0; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
        .btn-close-icon { background: none; border: none; font-size: 20px; cursor: pointer; }
        .btn-cancel { background: var(--bone); border: 2px solid var(--ink); padding: 10px 16px; cursor: pointer; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .recap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .recap-item { background: var(--white); border: 2px solid var(--ink); padding: 12px; display: flex; flex-direction: column; gap: 4px; }
        .recap-item.full-width { grid-column: 1/-1; }
        .recap-key { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); }
        .recap-val { font-size: 13px; font-weight: 500; color: var(--ink); word-break: break-word; }
        .cal-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .cal-section-title { font-family: 'Cabinet Grotesk', sans-serif; font-size: 16px; font-weight: 800; color: var(--ink); margin: 0; }
        .cal-section-count { font-size: 10px; font-weight: 700; padding: 3px 10px; border: 2px solid var(--ink); text-transform: uppercase; }
        .cal-section-count.upcoming { background: var(--street); color: var(--bone); }
        .cal-section-count.previous { background: var(--canopy); color: var(--white); }
        .cal-load-more-wrap { display: flex; justify-content: center; margin-top: 16px; }
        .btn-load-more { background: var(--white); border: 2px solid var(--ink); padding: 9px 22px; font-size: 11px; font-weight: 700; cursor: pointer; text-transform: uppercase; }
        .notif-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; gap: 12px; flex-wrap: wrap; }
        .notif-header-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .notif-unread-badge { font-size: 10px; font-weight: 700; padding: 3px 10px; border: 2px solid var(--ink); text-transform: uppercase; background: var(--street); color: var(--bone); }
        .notif-list { display: flex; flex-direction: column; gap: 10px; }
        .notif-card { background: var(--white); border: 2px solid var(--ink); border-left: 4px solid var(--ink); padding: 16px; box-shadow: 3px 3px 0 0 var(--ink); }
        .notif-card.unread { border-left-color: var(--street); background: var(--street-pale); }
        .notif-card.read { border-left-color: var(--canopy); opacity: 0.72; }
        .notif-subject { font-family: 'Cabinet Grotesk', sans-serif; font-size: 14px; font-weight: 800; color: var(--ink); margin: 0 0 6px 0; }
        .notif-body { font-size: 12px; font-weight: 500; color: var(--ink); line-height: 1.6; margin: 0; white-space: pre-wrap; word-break: break-word; }
        .notif-body.collapsed { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; }
        .notif-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; gap: 8px; }
        .notif-time { font-size: 10px; font-weight: 500; color: var(--muted); }
        .notif-footer-actions { display: flex; gap: 6px; }
        .btn-notif { font-size: 10px; font-weight: 700; padding: 4px 10px; border: 2px solid var(--ink); background: var(--white); cursor: pointer; text-transform: uppercase; }
        .notif-empty { font-size: 13px; color: var(--muted); text-align: center; padding: 40px 0; }
        .nav-notif-badge { display: inline-flex; align-items: center; justify-content: center; background: var(--street); color: var(--bone); border: 1px solid var(--bone); font-size: 9px; font-weight: 700; min-width: 16px; height: 15px; padding: 0 3px; margin-left: 5px; }
        .notif-type { font-size: 9px; font-weight: 700; padding: 2px 8px; border: 2px solid var(--ink); text-transform: uppercase; margin-right: 4px; }
        .notif-email-status { font-size: 9px; font-weight: 700; padding: 2px 8px; border: 2px solid var(--ink); text-transform: uppercase; }
        /* ── Tablet (900px and below) ── */
        @media (max-width: 900px) {
          .sidebar { position: fixed; bottom: 0; left: 0; top: auto; width: 100%; height: 70px; padding: 8px; flex-direction: row; justify-content: space-around; border-top: 2px solid rgba(250,240,234,0.2); border-right: none; }
          .sidebar-icon, .sidebar-logo, .sidebar-brand, .nav-label { display: none; }
          .nav-item { flex-direction: column; font-size: 9px; padding: 4px; text-align: center; gap: 4px; width: 25%; margin-bottom: 0; border: none; }
          .nav-item .icon { font-size: 18px; width: auto; text-align: center; margin: 0 auto; }
          .main { margin-left: 0; padding: 18px; padding-bottom: 90px; padding-top: 20px; }
          .topbar { flex-direction: column; align-items: flex-start; gap: 14px; }
          .topbar-left h1 { font-size: 22px; }
          .topbar-right { width: 100%; justify-content: space-between; flex-direction: row-reverse; }
          .stat-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
          .stat-card { padding: 18px; }
          .stat-value { font-size: 30px; }
          .two-col { grid-template-columns: 1fr; }
          .card { padding: 18px; }
          .cal-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .form-grid { grid-template-columns: 1fr; gap: 14px; }
          .time-inputs { flex-direction: column; align-items: flex-start; gap: 8px; }
          .time-inputs span { display: none; }
          .photo-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 5px; }
          .modal-content { max-width: 90vw; }
          .recap-grid { grid-template-columns: 1fr; }
        }

        /* ── Mobile (600px and below) ── */
        @media (max-width: 600px) {
          .main { padding: 14px; margin-left: 0; }
          .topbar { flex-direction: column; gap: 10px; }
          .topbar-left h1 { font-size: 18px; }
          .topbar-left p { font-size: 11px; }
          .topbar-right { width: 100%; justify-content: flex-start; gap: 10px; flex-direction: row; }
          .btn-action-primary { padding: 5px 10px; font-size: 9px; }
          .stat-grid { grid-template-columns: 1fr; gap: 10px; margin-bottom: 14px; }
          .stat-card { padding: 14px 16px; }
          .stat-value { font-size: 26px; }
          .stat-label { font-size: 9px; margin-bottom: 6px; }
          .card { padding: 14px; margin-bottom: 10px; }
          .card-title { font-size: 14px; }
          .card-sub { font-size: 10px; }
          .cal-grid { grid-template-columns: 1fr; gap: 8px; }
          .cal-card { padding: 12px; }
          .cal-store { font-size: 13px; }
          .cal-market { font-size: 10px; }
          .form-grid { grid-template-columns: 1fr; gap: 12px; }
          .form-label { font-size: 9px; }
          .form-input { padding: 8px 12px; font-size: 13px; }
          .btn-submit { padding: 10px 20px; font-size: 11px; }
          .chart-bars { height: 120px; }
          .photo-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 4px; padding: 10px; }
          .photo-thumb { aspect-ratio: 1; }
          .modal-content { max-width: 95vw; padding: 16px; }
          .modal-title { font-size: 16px; }
          .recap-grid { grid-template-columns: 1fr; gap: 10px; }
          .recap-item { padding: 10px; }
          .recap-key { font-size: 8px; }
          .recap-val { font-size: 12px; }
          .time-inputs { flex-direction: column; gap: 8px; }
        }

        /* ── Extra small (480px and below) ── */
        @media (max-width: 480px) {
          .main { padding: 12px; }
          .topbar { gap: 8px; }
          .topbar-left h1 { font-size: 16px; }
          .topbar-left p { font-size: 10px; }
          .topbar-right { flex-direction: column; width: 100%; gap: 8px; }
          .btn-action-primary { padding: 4px 8px; font-size: 8px; width: 100%; justify-content: center; }
          .stat-grid { gap: 8px; }
          .stat-card { padding: 12px 14px; }
          .stat-value { font-size: 22px; }
          .stat-label { font-size: 8px; }
          .card { padding: 12px; }
          .card-title { font-size: 13px; }
          .cal-grid { gap: 6px; }
          .cal-card { padding: 10px; }
          .cal-store { font-size: 12px; }
          .cal-date { font-size: 9px; }
          .form-grid { gap: 10px; }
          .form-label { font-size: 8px; }
          .form-input { padding: 8px 10px; font-size: 12px; }
          .btn-submit { padding: 8px 16px; font-size: 10px; width: 100%; }
          .chart-bars { height: 100px; }
          .photo-grid { grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 3px; padding: 8px; }
          .modal-content { padding: 14px; }
          .modal-title { font-size: 14px; }
          .modal-desc { font-size: 11px; }
          .recap-item { padding: 8px; }
          .recap-key { font-size: 7px; }
          .recap-val { font-size: 11px; }
          .btn-cancel, .btn-submit { padding: 8px 14px; font-size: 9px; }
        }
      `}} />

      {changeModal.isOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setChangeModal({isOpen:false,type:"",event:null,notes:""})}}>          <div className="modal-content">
            <div className="modal-header"><h3 className="modal-title">{changeModal.type} Activation</h3><button className="btn-close-icon" onClick={()=>setChangeModal({isOpen:false,type:"",event:null,notes:""})}>✕</button></div>
            <div className="form-group full"><label className="form-label">Details:</label><textarea className="form-input form-textarea" value={changeModal.notes} onChange={(e)=>setChangeModal({...changeModal,notes:e.target.value})} /></div>
            <div className="modal-actions"><button className="btn-cancel" onClick={()=>setChangeModal({isOpen:false,type:"",event:null,notes:""})}>Close</button><button className="btn-submit" onClick={submitChangeRequest}>{isSubmitting?"Sending...":"Submit"}</button></div>
          </div>
        </div>
      )}

      {lightboxPhoto && (
        <div className="lightbox-overlay" onClick={() => setLightboxPhoto(null)}>
          <button className="lightbox-close" onClick={() => setLightboxPhoto(null)}>✕</button>
          <img src={lightboxPhoto} alt="Event photo" className="lightbox-img" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {selectedRecap && (
        <div className="modal-overlay" onClick={(e)=>{if(e.target===e.currentTarget)setSelectedRecap(null)}}>
          <div className="modal-content large" id="recap-export-area">
            <div className="modal-header">
              <div><h3 className="modal-title">{selectedRecap.store}</h3><p style={{margin:'4px 0 0',fontSize:'12px',color:'var(--muted)'}}>{selectedRecap.date}</p></div>
              <div style={{display:'flex',gap:'12px'}}>
                <button className="btn-action-primary" onClick={downloadRecapReport}>{isExportingRecap?"Generating...":"⬇ PDF"}</button>
                <button className="btn-close-icon" onClick={()=>setSelectedRecap(null)}>✕</button>
              </div>
            </div>
            <div className="recap-grid">
              {RECAP_DISPLAY_FIELDS.map(({ key, label, long }) => {
                const val = selectedRecap.recap?.[key];
                if (!val || String(val).trim() === '') return null;
                const isLongText = long || String(val).length > 60;
                return (
                  <div className={`recap-item ${isLongText ? 'full-width' : ''}`} key={key}>
                    <span className="recap-key">{label}</span>
                    <span className="recap-val">{renderRecapValue(String(val))}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="sidebar">
        <img src="/brand/greenline-icon-canopy.svg" alt="" className="sidebar-icon" />
        <p className="sidebar-logo">Greenline Activations</p>
        <p className="sidebar-brand">CLAYBOURNE CO.</p>
        <Link href="/dashboard" className="nav-item" style={{ marginBottom: 12, opacity: 0.7 }}><span className="icon">←</span> Main Dashboard</Link>
        <p className="nav-label">Menu</p>
        <a className={`nav-item ${activeSection==='dashboard'?'active':''}`} onClick={()=>setActiveSection('dashboard')}><span className="icon">📊</span> Dashboard</a>
        <a className={`nav-item ${activeSection==='calendar'?'active':''}`} onClick={()=>setActiveSection('calendar')}><span className="icon">📅</span> Calendar</a>
        <a className={`nav-item ${activeSection==='intel'?'active':''}`} onClick={()=>setActiveSection('intel')}><span className="icon">🔍</span> Market Intel</a>
        <a className={`nav-item ${activeSection==='request'?'active':''}`} onClick={()=>setActiveSection('request')}><span className="icon">➕</span> Request</a>
        <a className={`nav-item ${activeSection==='notifications'?'active':''}`} onClick={()=>setActiveSection('notifications')}>
          <span className="icon">🔔</span> Notifications
          {notifications.filter(n=>!n.read).length>0&&(<span className="nav-notif-badge">{notifications.filter(n=>!n.read).length}</span>)}
        </a>
      </div>

      <div className="main" id="dashboard-export-area">
        <div className="topbar">
          <div className="topbar-left">
            <h1>Activation Dashboard</h1>
            <p style={{marginBottom: '2px'}}>Welcome back</p>
            <p>Live data · Claybourne Co.</p>
          </div>
          <div className="topbar-right">
            <UserButton />
            <button className="btn-action-primary" onClick={fetchClientData}>↻ Sync</button>
            <button className="btn-action-primary" onClick={downloadDashboardReport}>{isExportingDashboard?"Generating...":"⬇ Export"}</button>
          </div>
        </div>

        <div className={`section ${activeSection==='dashboard'?'active':''}`}>
          <div className="stat-grid">
            <div className="stat-card"><p className="stat-label">QR Code Scans</p><p className="stat-value">{metrics.sampled}</p></div>
            <div className="stat-card"><p className="stat-label">Total Purchases</p><p className="stat-value green">{metrics.sold}</p></div>
            <div className="stat-card"><p className="stat-label">Conversion Rate</p><p className="stat-value">{metrics.conversion}%</p></div>
            <div className="stat-card"><p className="stat-label">Total Activations</p><p className="stat-value">{metrics.activations}</p></div>
          </div>
          <div className="card">
            <p className="card-title">Consumers Reached by Market</p>
            <p className="card-sub">Top 3 Performing Cities</p>
            <div className="chart-bars" style={{marginTop:'16px'}}>
              {metrics.markets.length>0?metrics.markets.map((m,i)=>(
                <div className="bar-col" key={i}>
                  <div className="bar-fill" style={{height:`${(m.value/maxMarketValue)*100}%`}}><span className="bar-val">{m.value}</span></div>
                  <p className="bar-label">{m.city}</p>
                </div>
              )):<p style={{fontSize:'12px',color:'var(--muted)'}}>No data yet.</p>}
            </div>
          </div>
        </div>

        <div className={`section ${activeSection==='calendar'?'active':''}`}>
          <div className="card" style={{marginBottom:'16px'}}>
            <div className="cal-section-header"><p className="cal-section-title">Upcoming</p><span className="cal-section-count upcoming">{metrics.upcoming.length} scheduled</span></div>
            <div className="cal-grid">
              {metrics.upcoming.slice(0,visibleUpcoming).map((e,i)=>(
                <div className="cal-card status-Upcoming" key={i}>
                  <p className="cal-date">{e.date} <span>{e.time}</span></p>
                  <p className="cal-store">{e.store}</p>
                  <p className="cal-market">{e.market}</p>
                  <div className="cal-footer">
                    <span className="cal-status status-Upcoming">Upcoming</span>
                    <div className="cal-actions">
                      <button className="btn-action" onClick={()=>setChangeModal({isOpen:true,type:'Edit',event:e,notes:''})}>Edit</button>
                      <button className="btn-action" onClick={()=>setChangeModal({isOpen:true,type:'Cancel',event:e,notes:''})}>Cancel</button>
                    </div>
                  </div>
                </div>
              ))}
              {metrics.upcoming.length===0&&<p style={{fontSize:'12px',color:'var(--muted)',gridColumn:'1/-1'}}>No upcoming activations.</p>}
            </div>
            {visibleUpcoming<metrics.upcoming.length&&<div className="cal-load-more-wrap"><button className="btn-load-more" onClick={()=>setVisibleUpcoming(v=>v+ITEMS_PER_PAGE)}>Load More</button></div>}
          </div>
          <div className="card">
            <div className="cal-section-header"><p className="cal-section-title">Previous</p><span className="cal-section-count previous">{metrics.previous.length} completed</span></div>
            <div className="cal-grid">
              {metrics.previous.slice(0,visiblePrevious).map((e,i)=>(
                <div className="cal-card status-Complete clickable" key={i} onClick={()=>setSelectedRecap(e)}>
                  <p className="cal-date">{e.date}</p>
                  <p className="cal-store">{e.store}</p>
                  <p className="cal-market">{e.market}</p>
                  <div className="cal-footer"><span className="cal-status status-Complete">Complete</span></div>
                </div>
              ))}
              {metrics.previous.length===0&&<p style={{fontSize:'12px',color:'var(--muted)',gridColumn:'1/-1'}}>No previous activations.</p>}
            </div>
            {visiblePrevious<metrics.previous.length&&<div className="cal-load-more-wrap"><button className="btn-load-more" onClick={()=>setVisiblePrevious(v=>v+ITEMS_PER_PAGE)}>Load More</button></div>}
          </div>
        </div>

        <div className={`section ${activeSection==='intel'?'active':''}`}>
          <div className="card">
            <p className="card-title">Market Intelligence</p>
            <p className="card-sub">Latest feedback from the field</p>
            {metrics.intel.map((item,i)=>(<div className="intel-item" key={i}><span className="intel-icon">{item.icon}</span><p className="intel-text">{item.text}</p>{item.link&&<a href={item.link} target="_blank" rel="noopener noreferrer" className="intel-link">View</a>}</div>))}
            {metrics.intel.length===0&&<p style={{fontSize:'12px',color:'var(--muted)'}}>No intel yet.</p>}
          </div>

          <div className="card" style={{marginTop: '14px'}}>
            <div className="card-header">
              <div><p className="card-title">Event Photos</p><p className="card-sub">Recap photos organized by activation</p></div>
              <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
                {eventPhotos.length > 1 && (
                  <select className="form-input" style={{width: 'auto', padding: '6px 10px', fontSize: '11px'}} value={photoFilter} onChange={e => setPhotoFilter(e.target.value)}>
                    <option value="all">All Events</option>
                    {eventPhotos.map(ev => <option key={ev.key} value={ev.key}>{ev.title}</option>)}
                  </select>
                )}
                {eventPhotos.length > 0 && (
                  <button className="btn-action-primary" onClick={() => setPhotoSort(s => s === 'newest' ? 'oldest' : 'newest')}>
                    {photoSort === 'newest' ? '↓ Newest First' : '↑ Oldest First'}
                  </button>
                )}
                <button className="btn-action-primary" onClick={() => fetchPhotos(true)} disabled={photoLoading}>↻ Sync Photos</button>
              </div>
            </div>
            {photoLoading && <p className="photo-empty">Loading photos…</p>}
            {!photoLoading && eventPhotos.length === 0 && <p className="photo-empty">No event photos uploaded yet.</p>}
            <div className="photo-section">
              {sortedEventPhotos.map(ev => (
                <div className="photo-event" key={ev.key}>
                  <div className="photo-event-header" onClick={() => setOpenEvents(prev => {
                    const next = new Set(prev);
                    next.has(ev.key) ? next.delete(ev.key) : next.add(ev.key);
                    return next;
                  })}>
                    <p className="photo-event-title">{ev.title}</p>
                    <span className="photo-event-count">
                      {ev.photos.length} photo{ev.photos.length !== 1 ? 's' : ''}
                      <span className={`photo-event-chevron${openEvents.has(ev.key) ? ' open' : ''}`}>▼</span>
                    </span>
                  </div>
                  {openEvents.has(ev.key) && (
                    <div className="photo-grid">
                      {ev.photos.map((p, i) => (
                        <img key={i} src={p.thumb} alt={`${ev.title} photo ${i + 1}`} className="photo-thumb" loading="lazy" decoding="async" onClick={() => setLightboxPhoto(p.full)} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`section ${activeSection==='notifications'?'active':''}`}>
          <div className="card">
            <div className="notif-header">
              <div><p className="card-title">Notifications</p><p className="card-sub">From your Greenline team</p></div>
              <div className="notif-header-actions">
                {notifications.filter(n=>!n.read).length>0&&<span className="notif-unread-badge">{notifications.filter(n=>!n.read).length} unread</span>}
                <button className="btn-action-primary" onClick={fetchNotifications}>↻ Refresh</button>
                {notifications.some(n=>!n.read)&&<button className="btn-action-primary" onClick={markAllRead}>✓ All Read</button>}
              </div>
            </div>
            {notifLoading?<p className="notif-empty">Loading...</p>:notifications.length===0?<p className="notif-empty">No notifications yet.</p>:(
              <div className="notif-list">
                {notifications.map(n=>(
                  <div key={n.id} className={`notif-card ${n.read?'read':'unread'}`}>
                    <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'6px',flexWrap:'wrap'}}>
                      <span className="notif-type" style={{background:notifTypeColor[n.type?.toLowerCase()]||'#e5e7eb',color:notifTypeDark[n.type?.toLowerCase()]?'var(--bone)':'var(--ink)'}}>{n.type||'general'}</span>
                      {n.email_status&&<span className="notif-email-status" style={{background:emailStatusColor[n.email_status?.toLowerCase()]||'#e5e7eb'}}>{n.email_status}</span>}
                      {!n.read&&<button className="btn-notif" style={{marginLeft:'auto'}} onClick={()=>markAsRead(n.id)}>Mark Read</button>}
                    </div>
                    <p className="notif-subject">{n.subject}</p>
                    <p className={`notif-body ${expandedNotif===n.id?'':'collapsed'}`}>{n.body}</p>
                    <div className="notif-footer">
                      <span className="notif-time">{formatNotifTime(n.created_at)}</span>
                      <button className="btn-notif" onClick={()=>setExpandedNotif(expandedNotif===n.id?null:n.id)}>{expandedNotif===n.id?'▲':'Read More ▼'}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`section ${activeSection==='request'?'active':''}`}>
          <div className="card">
            <p className="card-title">Request Activation</p>
            <div className="form-grid" style={{marginTop:'16px'}}>
              <div className="form-group"><label className="form-label">Market</label><select name="market" value={formData.market} onChange={handleInputChange} className="form-input"><option value="">Select Market</option>{dropdownOptions.market.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Brand</label><select name="brand" value={formData.brand} onChange={handleInputChange} className="form-input"><option value="">Select Brand</option>{dropdownOptions.brand.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Store Name</label><input type="text" name="storeName" value={formData.storeName} onChange={handleInputChange} className="form-input" placeholder="e.g. Total Wine" /></div>
              <div className="form-group"><label className="form-label">Store Address</label><input type="text" name="address" value={formData.address} onChange={handleInputChange} className="form-input" placeholder="123 Main St" /></div>
              <div className="form-group"><label className="form-label">Preferred Date</label><input type="date" name="date" value={formData.date} onChange={handleInputChange} className="form-input" /></div>
              <div className="form-group"><label className="form-label">Time (From - To)</label><div style={{display:'flex',gap:'8px',alignItems:'center'}}><input type="time" name="startTime" value={formData.startTime} onChange={handleInputChange} className="form-input" style={{flex:1}} /><span>-</span><input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} className="form-input" style={{flex:1}} /></div></div>
              <div className="form-group"><label className="form-label">Activation Type</label><select name="samplingType" value={formData.samplingType} onChange={handleInputChange} className="form-input"><option value="">Select Activation Type</option>{dropdownOptions.samplingType.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div className="form-group full"><label className="form-label">Products</label><select name="products" value={formData.products} onChange={handleInputChange} className="form-input"><option value="">Select Products</option>{dropdownOptions.products.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
              <div className="form-group full"><label className="form-label">Notes</label><textarea name="notes" value={formData.notes} onChange={handleInputChange} className="form-input form-textarea" /></div>
            </div>
            <button className="btn-submit" onClick={submitRequest} disabled={isSubmitting}>{isSubmitting?"Sending...":"Submit Request"}</button>
            {showSuccess&&<div className="success-msg">{uploadMessage}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
