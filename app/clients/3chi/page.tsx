"use client";
import { useState, useEffect } from "react";
import "../dashboard.css";
import { useDashboardTheme, ThemeToggle } from "../components/theme";
import { UserButton } from "@clerk/nextjs";
import AdminDashboardLink from "../components/AdminDashboardLink";

const TARGET_BRAND = "3CHI";

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
  
  // PDF Loading States
  const [isExportingDashboard, setIsExportingDashboard] = useState(false);
  const [isExportingRecap, setIsExportingRecap] = useState(false);

  // Modal States
  const [changeModal, setChangeModal] = useState({ isOpen: false, type: "", event: null as any, notes: "" });
  const [selectedRecap, setSelectedRecap] = useState<any>(null);

  const [formData, setFormData] = useState({
    storeName: "", address: "", date: "", startTime: "", endTime: "", notes: "", market: "", brand: "", samplingType: "", productPurchase: "", products: ""
  });

  const [dropdownOptions, setDropdownOptions] = useState({
    market: [] as string[],
    brand: [] as string[],
    samplingType: [] as string[],
    productPurchase: [] as string[],
    products: [] as string[]
  });

  const [metrics, setMetrics] = useState({
    sampled: 0, sold: 0, activations: 0, conversion: 0,
    markets: [] as any[], upcoming: [] as any[], previous: [] as any[], intel: [] as any[]
  });

  const ITEMS_PER_PAGE = 6;
  const [visibleUpcoming, setVisibleUpcoming] = useState(ITEMS_PER_PAGE);
  const [visiblePrevious, setVisiblePrevious] = useState(ITEMS_PER_PAGE);

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

  useEffect(() => { fetchClientData(); }, []);

  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const res = await fetch('/api/dropdown-data?client=3CHI');
        if (res.ok) {
          const data = await res.json();
          setDropdownOptions(data);
        }
      } catch (error) {
        console.error("Error fetching dropdown data:", error);
      }
    };
    fetchDropdownData();
  }, []);

  const fetchPhotos = async (force = false) => {
    if (photoLoading || (!force && eventPhotos.length > 0)) return;
    if (force) setEventPhotos([]);
    setPhotoLoading(true);
    try {
      const res = await fetch('/api/photos?client=3chi');
      const data = await res.json();
      if (data.events) setEventPhotos(data.events);
    } catch {}
    setPhotoLoading(false);
  };

  useEffect(() => { if (activeSection === 'intel') fetchPhotos(); }, [activeSection]);

  // --- PDF GENERATION FUNCTIONS ---
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
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: themeColor("--surface", "#ffffff") });
      
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
        setFormData({ storeName: "", address: "", date: "", startTime: "", endTime: "", notes: "", market: "", brand: "", samplingType: "", productPurchase: "", products: "" });
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
    if (val && val.toString().startsWith('http')) {
      return <a href={val} target="_blank" rel="noopener noreferrer" style={{color: 'var(--ink)', fontWeight: '700', textDecoration: 'underline'}}>View Link / File ↗</a>;
    }
    return val;
  };

  return (
    <div className="dashboard-wrapper" data-theme={theme}>

      {/* CHANGE REQUEST MODAL (UPCOMING) */}
      {changeModal.isOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setChangeModal({isOpen: false, type: "", event: null, notes: ""})}}>
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

      {lightboxPhoto && (
        <div className="lightbox-overlay" onClick={() => setLightboxPhoto(null)}>
          <button className="lightbox-close" onClick={() => setLightboxPhoto(null)}>✕</button>
          <img src={lightboxPhoto} alt="Event photo" className="lightbox-img" onClick={e => e.stopPropagation()} />
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

      <div className="sidebar" data-html2canvas-ignore="true">
        <img src="/brand/greenline-icon-canopy.svg" alt="" className="sidebar-icon" />
        <p className="sidebar-logo">Greenline Activations</p>
        <p className="sidebar-brand">{TARGET_BRAND}</p>
        <AdminDashboardLink />
        <p className="nav-label">Menu</p>
        <a className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveSection('dashboard')}><span className="icon">📊</span> Dashboard</a>
        <a className={`nav-item ${activeSection === 'calendar' ? 'active' : ''}`} onClick={() => setActiveSection('calendar')}><span className="icon">📅</span> Activation Calendar</a>
        <a className={`nav-item ${activeSection === 'intel' ? 'active' : ''}`} onClick={() => setActiveSection('intel')}><span className="icon">🔍</span> Market Intel</a>
        <a className={`nav-item ${activeSection === 'request' ? 'active' : ''}`} onClick={() => setActiveSection('request')}><span className="icon">➕</span> Request Activation</a>
        <a href="/profiles" className="nav-item"><span className="icon">👥</span> View BA Profiles</a>
      </div>

      <div className="main" id="dashboard-export-area">
        <div className="topbar">
          <div className="topbar-left">
            <h1>
              Activation Dashboard 
              <div style={{display: 'flex', gap: '8px', marginTop: '10px'}} data-html2canvas-ignore="true">
                <button className="btn-action-primary" onClick={fetchClientData}>↻ Sync Data</button>
                <button className="btn-action-primary" onClick={downloadDashboardReport} disabled={isExportingDashboard}>
                  {isExportingDashboard ? "Generating PDF..." : "⬇ Export Dashboard"}
                </button>
              </div>
            </h1>
            <p style={{marginTop: '4px', marginBottom: '2px'}}>Welcome back, Peter</p>
            <p style={{marginTop: '2px'}}>Live data from Supabase</p>
          </div>
          <div className="topbar-right" data-html2canvas-ignore="true">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
                <p style={{fontSize: '12px', color: 'var(--muted)', gridColumn: '1/-1'}}>No upcoming activations scheduled.</p>
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
                <p style={{fontSize: '12px', color: 'var(--muted)', gridColumn: '1/-1'}}>No previous activations found.</p>
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
            {metrics.intel.length === 0 && <p style={{fontSize: '12px', color: 'var(--muted)'}}>No intel gathered yet.</p>}
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

        {/* REQUEST TAB */}
        <div className={`section ${activeSection === 'request' ? 'active' : ''}`} data-html2canvas-ignore="true">
          <div className="card">
            <div className="card-header"><div><p className="card-title">Request Activation</p></div></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Market</label><select name="market" value={formData.market} onChange={handleInputChange} className="form-input"><option value="">Select Market</option>{dropdownOptions.market.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Brand</label><select name="brand" value={formData.brand} onChange={handleInputChange} className="form-input"><option value="">Select Brand</option>{dropdownOptions.brand.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Store Name</label><input type="text" name="storeName" value={formData.storeName} onChange={handleInputChange} className="form-input" placeholder="e.g. Total Wine" /></div>
              <div className="form-group"><label className="form-label">Store Address</label><input type="text" name="address" value={formData.address} onChange={handleInputChange} className="form-input" placeholder="e.g. 123 Main St, Orlando, FL" /></div>
              <div className="form-group"><label className="form-label">Preferred Date</label><input type="date" name="date" value={formData.date} onChange={handleInputChange} className="form-input" /></div>
              <div className="form-group"><label className="form-label">Time (From - To)</label><div className="time-inputs"><input type="time" name="startTime" value={formData.startTime} onChange={handleInputChange} className="form-input" style={{flex: 1}} /><span>-</span><input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} className="form-input" style={{flex: 1}} /></div></div>
              <div className="form-group"><label className="form-label">Sampling Type</label><select name="samplingType" value={formData.samplingType} onChange={handleInputChange} className="form-input"><option value="">Select Sampling Type</option>{dropdownOptions.samplingType.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Product Purchase Required</label><select name="productPurchase" value={formData.productPurchase} onChange={handleInputChange} className="form-input"><option value="">Select Option</option>{dropdownOptions.productPurchase.length > 0 ? dropdownOptions.productPurchase.map(p => <option key={p} value={p}>{p}</option>) : [<option key="Yes" value="Yes">Yes</option>, <option key="No" value="No">No</option>]}</select></div>

              <div className="form-group full">
                <label className="form-label">Products</label>
                <select name="products" value={formData.products} onChange={handleInputChange} className="form-input"><option value="">Select Products</option>{dropdownOptions.products.map(p => <option key={p} value={p}>{p}</option>)}</select>
              </div>

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
