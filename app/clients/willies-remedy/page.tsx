"use client";
import { useState, useEffect } from "react";
import "../dashboard.css";
import { useDashboardTheme, ThemeToggle } from "../components/theme";
import { UserButton } from "@clerk/nextjs";
import AdminDashboardLink from "../components/AdminDashboardLink";
import NotificationStaff from "../components/NotificationStaff";
import Link from "next/link";

const TARGET_BRAND = "WILLIES_REMEDY";

const RECAP_DISPLAY_FIELDS: { key: string; label: string; long?: boolean }[] = [
  { key: 'sampling_type', label: 'Sampling Type' },
  { key: 'products_featured', label: 'Products Featured', long: true },
  { key: 'consumers_approached', label: 'Consumers Approached' },
  { key: 'consumers_sampled', label: 'Consumers Sampled' },
  { key: 'estimated_units_sold', label: 'Estimated Units Sold' },
  { key: 'top_performing_flavor', label: 'Top Performing SKU' },
  { key: 'consumer_objections', label: 'Consumer Objections', long: true },
  { key: 'product_in_stock', label: 'Product In Stock' },
  { key: 'shelf_placement', label: 'Shelf Placement' },
  { key: 'units_start', label: 'Units at Start' },
  { key: 'units_end', label: 'Units at End' },
  { key: 'units_start_key_lime', label: 'Key Lime - Units Start' },
  { key: 'units_end_key_lime', label: 'Key Lime - Units End' },
  { key: 'units_start_cherry_limeade', label: 'Cherry Limeade - Units Start' },
  { key: 'units_end_cherry_limeade', label: 'Cherry Limeade - Units End' },
  { key: 'units_start_watermelon_mojito', label: 'Watermelon Mojito - Units Start' },
  { key: 'units_end_watermelon_mojito', label: 'Watermelon Mojito - Units End' },
  { key: 'price_displayed', label: 'Price Displayed' },
  { key: 'price_10mg_4pk', label: 'Price (10mg 4pk)' },
  { key: 'single_cans_offered', label: 'Single Cans Offered' },
  { key: 'promo_signage_present', label: 'Promo Signage' },
  { key: 'reorder_needed', label: 'Reorder Needed' },
  { key: 'reorder_flagged', label: 'Reorder Flagged' },
  { key: 'competitor_sampling', label: 'Competitor Sampling' },
  { key: 'competitor_details', label: 'Competitor Details', long: true },
  { key: 'spoke_with_manager', label: 'Spoke with Manager' },
  { key: 'manager_sentiment', label: 'Manager Sentiment' },
  { key: 'educated_staff', label: 'Educated Staff' },
  { key: 'future_activations_interest', label: 'Future Activations Interest' },
  { key: 'manager_notes', label: 'Manager Notes', long: true },
  { key: 'issues_occurred', label: 'Issues Occurred' },
  { key: 'issue_description', label: 'Issue Details', long: true },
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

// Event descriptions often carry internal scheduling/booking context ahead of
// the operational note (e.g. "From Willie's Remedy Sampling Demos Tracker
// (rep Morgan Baker)... 💧 Sampling: Dosed Willie's THC 10mg Spirit"). Only
// the marker onward is meant for ambassadors/admins, so trim to that.
function cleanEventDescription(description?: string | null): string {
  if (!description) return '';
  const match = description.match(/[\u{1F300}-\u{1FAFF}☀-➿️][\s\S]*$/u);
  return (match ? match[0] : description).trim();
}

export default function UnifiedDashboard() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const { theme, toggleTheme, themeColor } = useDashboardTheme();
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
    storeName: "", address: "", date: "", startTime: "", endTime: "", notes: "", market: "", brand: "", samplingType: "", productPurchase: "", products: ""
  });

  const [dropdownOptions, setDropdownOptions] = useState({ market: [], brand: [], samplingType: [], productPurchase: [], products: [] });

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

  // --- SHIPMENT ENTRY (log table/booth materials sent directly to an ambassador) ---
  // Willie's Remedy has no product-SKU inventory to ship or track (see /api/materials-shipments),
  // so unlike Amigos' shipment tab this only ever logs materials, never flavors/cases.
  const MATERIAL_OPTIONS = [
    { key: 'tee', label: 'Tee' },
    { key: 'tablecloth', label: 'Table Cloth' },
    { key: 'standee', label: 'Standee / Banner' },
    { key: 'pos_items', label: 'POS Items' },
    { key: 'merch', label: 'Merch' },
  ];

  const [shipmentData, setShipmentData] = useState<{
    ambassadors: { id: string; full_name: string; city: string | null; state: string | null; street_address: string | null; address_line_2: string | null; zip_code: string | null }[];
    events: { id: string; title: string; event_date: string; city: string | null }[];
    recentShipments: any[];
  }>({ ambassadors: [], events: [], recentShipments: [] });
  const [shipmentLoading, setShipmentLoading] = useState(false);
  const [shipmentForm, setShipmentForm] = useState({
    user_id: "", event_id: "", tracking_number: "",
    shipped_at: new Date().toISOString().split("T")[0], notes: "",
  });
  const [materialQty, setMaterialQty] = useState<Record<string, string>>({});
  const [ambassadorQuery, setAmbassadorQuery] = useState("");
  const [showAmbassadorList, setShowAmbassadorList] = useState(false);
  const [shipmentSubmitting, setShipmentSubmitting] = useState(false);
  const [shipmentError, setShipmentError] = useState("");
  const [shipmentResult, setShipmentResult] = useState<{ ambassadorName: string; materials: { item: string; quantity: number }[] } | null>(null);

  const fetchShipmentData = async () => {
    setShipmentLoading(true);
    try {
      const res = await fetch(`/api/materials-shipments?client=${encodeURIComponent(TARGET_BRAND)}`);
      if (res.ok) setShipmentData(await res.json());
    } catch (e) { console.error('Failed to fetch shipment data', e); }
    setShipmentLoading(false);
  };

  useEffect(() => { if (activeSection === 'shipment') fetchShipmentData(); }, [activeSection]);

  // Deep link support so a "Log a Shipment" email can jump straight to this tab, e.g.
  // /clients/willies-remedy?section=shipment
  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get('section');
    if (section) setActiveSection(section);
  }, []);

  const filteredAmbassadors = ambassadorQuery.trim()
    ? shipmentData.ambassadors.filter(a => a.full_name.toLowerCase().includes(ambassadorQuery.trim().toLowerCase()))
    : shipmentData.ambassadors;

  const selectAmbassador = (a: { id: string; full_name: string }) => {
    setShipmentForm(prev => ({ ...prev, user_id: a.id }));
    setAmbassadorQuery(a.full_name);
    setShowAmbassadorList(false);
  };

  const selectedAmbassador = shipmentData.ambassadors.find(a => a.id === shipmentForm.user_id) || null;
  const selectedAmbassadorAddressLines = selectedAmbassador
    ? [
        selectedAmbassador.street_address,
        selectedAmbassador.address_line_2,
        [selectedAmbassador.city, selectedAmbassador.state, selectedAmbassador.zip_code].filter(Boolean).join(', '),
      ].filter(Boolean) as string[]
    : [];

  const submitShipment = async () => {
    setShipmentError("");
    const materials = MATERIAL_OPTIONS
      .filter(m => Number(materialQty[m.key]) > 0)
      .map(m => ({ item: m.key, quantity: Number(materialQty[m.key]) }));

    if (!shipmentForm.user_id || !shipmentForm.tracking_number || !shipmentForm.shipped_at) {
      setShipmentError("Please fill out recipient, tracking number, and ship date.");
      return;
    }
    if (materials.length === 0) {
      setShipmentError("Add at least one material with a quantity.");
      return;
    }
    setShipmentSubmitting(true);
    try {
      const res = await fetch('/api/materials-shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...shipmentForm, event_id: shipmentForm.event_id || null, materials, client: TARGET_BRAND }),
      });
      const data = await res.json();
      if (res.ok) {
        const ambassadorName = shipmentData.ambassadors.find(a => a.id === shipmentForm.user_id)?.full_name || 'Ambassador';
        setShipmentResult({ ambassadorName, materials });
        setShipmentForm({ user_id: "", event_id: "", tracking_number: "", shipped_at: new Date().toISOString().split("T")[0], notes: "" });
        setMaterialQty({});
        setAmbassadorQuery("");
        fetchShipmentData();
      } else {
        setShipmentError(data.error || "Failed to log shipment. Please try again.");
      }
    } catch (e) {
      setShipmentError("Network error. Please try again.");
    }
    setShipmentSubmitting(false);
  };

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

  const notifTypeColor: Record<string, string> = { email: 'var(--canopy-pale)', alert: 'var(--street)', update: 'var(--tint-blue)', announcement: 'var(--tint-amber)' };
  const notifTypeDark: Record<string, boolean> = { alert: true };
  const emailStatusColor: Record<string, string> = { delivered: 'var(--canopy-pale)', sent: 'var(--tint-blue)', failed: 'var(--street-pale)', pending: 'var(--tint-amber)' };

  useEffect(() => { fetchClientData(); fetchNotifications(); }, []);

  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const res = await fetch('/api/dropdown-data?client=WILLIES_REMEDY');
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
      const res = await fetch('/api/photos?client=willies-remedy');
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
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: themeColor("--bone", "#faf0ea") });
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
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: themeColor("--surface", "#ffffff") });
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
      if (response.ok) { setUploadMessage("✅ Request submitted successfully. The team has been notified."); setShowSuccess(true); setFormData({ storeName: "", address: "", date: "", startTime: "", endTime: "", notes: "", market: "", brand: "", samplingType: "", productPurchase: "", products: "" }); }
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
    <div className="dashboard-wrapper" data-theme={theme} data-brand="willies-remedy">

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
        <p className="sidebar-brand">WILLIE'S REMEDY</p>
        <AdminDashboardLink />
        <p className="nav-label">Menu</p>
        <a className={`nav-item ${activeSection==='dashboard'?'active':''}`} onClick={()=>setActiveSection('dashboard')}><span className="icon">📊</span> Dashboard</a>
        <a className={`nav-item ${activeSection==='calendar'?'active':''}`} onClick={()=>setActiveSection('calendar')}><span className="icon">📅</span> Calendar</a>
        <a className={`nav-item ${activeSection==='intel'?'active':''}`} onClick={()=>setActiveSection('intel')}><span className="icon">🔍</span> Market Intel</a>
        <a className={`nav-item ${activeSection==='request'?'active':''}`} onClick={()=>setActiveSection('request')}><span className="icon">➕</span> Request</a>
        <a className={`nav-item ${activeSection==='shipment'?'active':''}`} onClick={()=>setActiveSection('shipment')}><span className="icon">📦</span> Log Shipment</a>
        <Link href="/profiles" className="nav-item"><span className="icon">👥</span> View BA Profiles</Link>
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
            <p>Live data · Willie's Remedy</p>
          </div>
          <div className="topbar-right">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <UserButton />
            <button className="btn-action-primary" onClick={fetchClientData}>↻ Sync</button>
            <button className="btn-action-primary" onClick={downloadDashboardReport}>{isExportingDashboard?"Generating...":"⬇ Export"}</button>
          </div>
        </div>

        <div className={`section ${activeSection==='dashboard'?'active':''}`}>
          <div className="stat-grid">
            <div className="stat-card"><p className="stat-label">Consumers Sampled</p><p className="stat-value">{metrics.sampled}</p></div>
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
                  {e.products && <div className="cal-products">{cleanEventDescription(e.products)}</div>}
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
                  {e.products && <div className="cal-products">{cleanEventDescription(e.products)}</div>}
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
                      <span className="notif-type" style={{background:notifTypeColor[n.type?.toLowerCase()]||'var(--surface-2)',color:notifTypeDark[n.type?.toLowerCase()]?'var(--on-street)':'var(--ink)'}}>{n.type||'general'}</span>
                      {n.email_status&&<span className="notif-email-status" style={{background:emailStatusColor[n.email_status?.toLowerCase()]||'var(--surface-2)'}}>{n.email_status}</span>}
                      {!n.read&&<button className="btn-notif" style={{marginLeft:'auto'}} onClick={()=>markAsRead(n.id)}>Mark Read</button>}
                    </div>
                    <p className="notif-subject">{n.subject}</p>
                    <p className={`notif-body ${expandedNotif===n.id?'':'collapsed'}`}>{n.body}</p>
                    <NotificationStaff metadata={n.metadata} />
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

        <div className={`section ${activeSection==='shipment'?'active':''}`} data-html2canvas-ignore="true">
          <div className="card">
            <div className="card-header">
              <div>
                <p className="card-title">Log a Materials Shipment</p>
                <p className="card-sub">Record tees, table/booth setup materials, and POS items shipped directly to an ambassador ahead of an activation.</p>
              </div>
            </div>

            {shipmentLoading && <p style={{fontSize: '12px', color: 'var(--muted)'}}>Loading ambassadors…</p>}

            <div className="form-grid">
              <div className="form-group combobox full">
                <label className="form-label">Recipient (Ambassador)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by name…"
                  value={ambassadorQuery}
                  onFocus={() => setShowAmbassadorList(true)}
                  onChange={(e) => { setAmbassadorQuery(e.target.value); setShipmentForm(prev => ({ ...prev, user_id: "" })); setShowAmbassadorList(true); }}
                  onBlur={() => setTimeout(() => setShowAmbassadorList(false), 150)}
                />
                {showAmbassadorList && (
                  <div className="combobox-list">
                    {filteredAmbassadors.length === 0 && <div className="combobox-empty">No ambassadors confirmed on your events yet.</div>}
                    {filteredAmbassadors.map(a => (
                      <div key={a.id} className="combobox-option" onMouseDown={() => selectAmbassador(a)}>
                        {a.full_name}
                        {(a.city || a.state) && <div className="combobox-option-sub">{[a.city, a.state].filter(Boolean).join(', ')}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {selectedAmbassador && (
                  selectedAmbassadorAddressLines.length > 0 ? (
                    <div className="address-preview">
                      <p className="address-preview-label">Shipping Address on File</p>
                      {selectedAmbassadorAddressLines.map((line, i) => <p key={i} className="address-preview-line">{line}</p>)}
                    </div>
                  ) : (
                    <div className="address-preview address-preview-missing">
                      No shipping address on file for {selectedAmbassador.full_name} — confirm with them before shipping.
                    </div>
                  )
                )}
              </div>

              <div className="form-group full">
                <label className="form-label">Materials Included</label>
                <div className="materials-grid">
                  {MATERIAL_OPTIONS.map(m => {
                    const checked = Number(materialQty[m.key]) > 0;
                    return (
                      <div className={`material-item ${checked ? 'checked' : ''}`} key={m.key}>
                        <label className="material-item-check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setMaterialQty(prev => ({ ...prev, [m.key]: e.target.checked ? (prev[m.key] || '1') : '' }))}
                          />
                          {m.label}
                        </label>
                        {checked && (
                          <input
                            type="number"
                            min="1"
                            className="form-input material-item-qty"
                            value={materialQty[m.key] ?? '1'}
                            onChange={(e) => setMaterialQty(prev => ({ ...prev, [m.key]: e.target.value }))}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Tracking Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 1Z999AA10123456784"
                  value={shipmentForm.tracking_number}
                  onChange={(e) => setShipmentForm(prev => ({ ...prev, tracking_number: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date Shipped</label>
                <input
                  type="date"
                  className="form-input"
                  value={shipmentForm.shipped_at}
                  onChange={(e) => setShipmentForm(prev => ({ ...prev, shipped_at: e.target.value }))}
                />
              </div>

              <div className="form-group full">
                <label className="form-label">Activation Date (Optional)</label>
                <select
                  className="form-input"
                  value={shipmentForm.event_id}
                  onChange={(e) => setShipmentForm(prev => ({ ...prev, event_id: e.target.value }))}
                >
                  <option value="">Not tied to a specific date</option>
                  {shipmentData.events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.title} — {ev.event_date}{ev.city ? ` (${ev.city})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="form-group full">
                <label className="form-label">Notes (Optional)</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="Anything the team should know about this shipment…"
                  value={shipmentForm.notes}
                  onChange={(e) => setShipmentForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>

            <button className="btn-submit" onClick={submitShipment} disabled={shipmentSubmitting}>
              {shipmentSubmitting ? "Logging Shipment..." : "Log Shipment"}
            </button>
            {shipmentError && <div className="error-msg">{shipmentError}</div>}

            {shipmentResult && (
              <div className="shipment-confirm-card">
                <p className="shipment-confirm-title">✅ Shipment logged for {shipmentResult.ambassadorName}</p>
                <p style={{fontSize: '12px', margin: 0}}>
                  Included: {shipmentResult.materials.map(m => `${m.quantity} ${MATERIAL_OPTIONS.find(o => o.key === m.item)?.label || m.item}`).join(', ')}
                </p>
              </div>
            )}
          </div>

          <div className="card" style={{marginTop: '14px'}}>
            <div className="card-header"><div><p className="card-title">Recent Shipments</p><p className="card-sub">Last 50 shipments logged to your ambassadors</p></div></div>
            {shipmentData.recentShipments.length === 0 ? (
              <p style={{fontSize: '12px', color: 'var(--muted)'}}>No shipments logged yet.</p>
            ) : (
              <>
                <div className="shipment-table-wrap">
                  <table className="shipment-table">
                    <thead>
                      <tr><th>Date</th><th>Ambassador</th><th>Materials</th><th>Tracking #</th></tr>
                    </thead>
                    <tbody>
                      {shipmentData.recentShipments.map((s: any) => (
                        <tr key={s.id}>
                          <td>{new Date(s.shipped_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td>{s.ambassador_name}</td>
                          <td>{s.materials.map((m: any) => `${m.quantity} ${MATERIAL_OPTIONS.find(o => o.key === m.item)?.label || m.item}`).join(', ')}</td>
                          <td>{s.tracking_number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="shipment-cards">
                  {shipmentData.recentShipments.map((s: any) => (
                    <div className="shipment-card" key={s.id}>
                      <div className="shipment-card-top">
                        <span className="shipment-card-ambassador">{s.ambassador_name}</span>
                        <span className="shipment-card-date">{new Date(s.shipped_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className="shipment-card-materials">{s.materials.map((m: any) => `${m.quantity} ${MATERIAL_OPTIONS.find(o => o.key === m.item)?.label || m.item}`).join(', ')}</div>
                      <div className="shipment-card-tracking">Tracking: {s.tracking_number}</div>
                    </div>
                  ))}
                </div>
              </>
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
              <div className="form-group"><label className="form-label">Sampling Type</label><select name="samplingType" value={formData.samplingType} onChange={handleInputChange} className="form-input"><option value="">Select Sampling Type</option>{dropdownOptions.samplingType.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Product Purchase Required</label><select name="productPurchase" value={formData.productPurchase} onChange={handleInputChange} className="form-input"><option value="">Select Option</option>{dropdownOptions.productPurchase.length > 0 ? dropdownOptions.productPurchase.map(p => <option key={p} value={p}>{p}</option>) : (<><option value="Yes">Yes</option><option value="No">No</option></>)}</select></div>
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
