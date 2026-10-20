"use client";
import { useState, useEffect } from "react";
import "./dashboard.css";
import { UserButton } from "@clerk/nextjs";
import AdminDashboardLink from "../components/AdminDashboardLink";
import NotificationStaff from "../components/NotificationStaff";
import Link from "next/link";

const TARGET_BRAND = "AMIGOS";
const THEME_KEY = "greenline-dashboard-theme";

const RECAP_DISPLAY_FIELDS: { key: string; label: string; long?: boolean }[] = [
  { key: 'sampling_type', label: 'Sampling Type' },
  { key: 'products_featured', label: 'Products Featured', long: true },
  { key: 'consumers_approached', label: 'Consumers Approached' },
  { key: 'consumers_sampled', label: 'Consumers Sampled' },
  { key: 'consumers_sampled_50mg', label: 'Sampled the 50mg Can' },
  { key: 'estimated_units_sold', label: 'Estimated Units Sold' },
  { key: 'top_performing_flavor', label: 'Top Performing SKU' },
  { key: 'consumer_objections', label: 'Consumer Objections', long: true },
  { key: 'product_in_stock', label: 'Product In Stock' },
  { key: 'shelf_placement', label: 'Shelf Placement' },
  { key: 'units_start', label: 'Units at Start' },
  { key: 'units_end', label: 'Units at End' },
  // Cocktails (Key Lime Margarita, Watermelon Mojito, Cherry Limeade) only
  // ever come in 10mg -- the *_50mg cocktail fields below are from recaps
  // collected 2026-09-17, before Amigos corrected that 50mg is actually a
  // separate soda line. Left in so older recaps still display correctly;
  // no new recap will ever populate them. Sodas (Strawberry, Pineapple,
  // Grape, Lemon Lime) are sampled only at independent accounts (not Total
  // Wine), each in both 10mg and 50mg. See greenline-team-portal's
  // CHANGELOG (2026-09-17 and 2026-09-18) for the schema this reads.
  { key: 'units_start_key_lime', label: 'Key Lime (10mg) - Units Start' },
  { key: 'units_end_key_lime', label: 'Key Lime (10mg) - Units End' },
  { key: 'units_sold_key_lime_10mg', label: 'Key Lime (10mg) - Units Sold' },
  { key: 'units_start_key_lime_50mg', label: 'Key Lime (50mg) - Units Start' },
  { key: 'units_end_key_lime_50mg', label: 'Key Lime (50mg) - Units End' },
  { key: 'units_sold_key_lime_50mg', label: 'Key Lime (50mg) - Units Sold' },
  { key: 'units_start_cherry_limeade', label: 'Cherry Limeade (10mg) - Units Start' },
  { key: 'units_end_cherry_limeade', label: 'Cherry Limeade (10mg) - Units End' },
  { key: 'units_sold_cherry_limeade_10mg', label: 'Cherry Limeade (10mg) - Units Sold' },
  { key: 'units_start_cherry_limeade_50mg', label: 'Cherry Limeade (50mg) - Units Start' },
  { key: 'units_end_cherry_limeade_50mg', label: 'Cherry Limeade (50mg) - Units End' },
  { key: 'units_sold_cherry_limeade_50mg', label: 'Cherry Limeade (50mg) - Units Sold' },
  { key: 'units_start_watermelon_mojito', label: 'Watermelon Mojito (10mg) - Units Start' },
  { key: 'units_end_watermelon_mojito', label: 'Watermelon Mojito (10mg) - Units End' },
  { key: 'units_sold_watermelon_mojito_10mg', label: 'Watermelon Mojito (10mg) - Units Sold' },
  { key: 'units_start_watermelon_mojito_50mg', label: 'Watermelon Mojito (50mg) - Units Start' },
  { key: 'units_end_watermelon_mojito_50mg', label: 'Watermelon Mojito (50mg) - Units End' },
  { key: 'units_sold_watermelon_mojito_50mg', label: 'Watermelon Mojito (50mg) - Units Sold' },
  { key: 'units_start_strawberry_soda_10mg', label: 'Strawberry Soda (10mg) - Units Start' },
  { key: 'units_end_strawberry_soda_10mg', label: 'Strawberry Soda (10mg) - Units End' },
  { key: 'units_sold_strawberry_soda_10mg', label: 'Strawberry Soda (10mg) - Units Sold' },
  { key: 'units_start_strawberry_soda_50mg', label: 'Strawberry Soda (50mg) - Units Start' },
  { key: 'units_end_strawberry_soda_50mg', label: 'Strawberry Soda (50mg) - Units End' },
  { key: 'units_sold_strawberry_soda_50mg', label: 'Strawberry Soda (50mg) - Units Sold' },
  { key: 'units_start_pineapple_soda_10mg', label: 'Pineapple Soda (10mg) - Units Start' },
  { key: 'units_end_pineapple_soda_10mg', label: 'Pineapple Soda (10mg) - Units End' },
  { key: 'units_sold_pineapple_soda_10mg', label: 'Pineapple Soda (10mg) - Units Sold' },
  { key: 'units_start_pineapple_soda_50mg', label: 'Pineapple Soda (50mg) - Units Start' },
  { key: 'units_end_pineapple_soda_50mg', label: 'Pineapple Soda (50mg) - Units End' },
  { key: 'units_sold_pineapple_soda_50mg', label: 'Pineapple Soda (50mg) - Units Sold' },
  { key: 'units_start_grape_soda_10mg', label: 'Grape Soda (10mg) - Units Start' },
  { key: 'units_end_grape_soda_10mg', label: 'Grape Soda (10mg) - Units End' },
  { key: 'units_sold_grape_soda_10mg', label: 'Grape Soda (10mg) - Units Sold' },
  { key: 'units_start_grape_soda_50mg', label: 'Grape Soda (50mg) - Units Start' },
  { key: 'units_end_grape_soda_50mg', label: 'Grape Soda (50mg) - Units End' },
  { key: 'units_sold_grape_soda_50mg', label: 'Grape Soda (50mg) - Units Sold' },
  { key: 'units_start_lemon_lime_soda_10mg', label: 'Lemon Lime Soda (10mg) - Units Start' },
  { key: 'units_end_lemon_lime_soda_10mg', label: 'Lemon Lime Soda (10mg) - Units End' },
  { key: 'units_sold_lemon_lime_soda_10mg', label: 'Lemon Lime Soda (10mg) - Units Sold' },
  { key: 'units_start_lemon_lime_soda_50mg', label: 'Lemon Lime Soda (50mg) - Units Start' },
  { key: 'units_end_lemon_lime_soda_50mg', label: 'Lemon Lime Soda (50mg) - Units End' },
  { key: 'units_sold_lemon_lime_soda_50mg', label: 'Lemon Lime Soda (50mg) - Units Sold' },
  { key: 'price_displayed', label: 'Price Displayed' },
  { key: 'price_10mg_4pk', label: 'Price (10mg 4pk)' },
  { key: 'price_50mg_4pk', label: 'Price (50mg 4pk)' },
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
  // Light (bone) is the default; dark is opt-in and remembered per browser.
  // Storage can throw (private mode, blocked site data), so the page must work without it.
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    try { if (localStorage.getItem(THEME_KEY) === "dark") setTheme("dark"); } catch {}
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  };
  // html2canvas paints its own background, so read the live theme token for PDF exports.
  const themeColor = (name: string, fallback: string) =>
    getComputedStyle(document.querySelector(".dashboard-wrapper") ?? document.body).getPropertyValue(name).trim() || fallback;
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
    storeName: "", address: "", date: "", startTime: "", endTime: "", notes: "",
    market: "", brand: "", samplingType: "", productPurchase: "", products: ""
  });

  const [dropdownOptions, setDropdownOptions] = useState({
    market: [] as string[],
    brand: [] as string[],
    samplingType: [] as string[],
    productPurchase: [] as string[],
    products: [] as string[]
  });

  const [independentLocations, setIndependentLocations] = useState<{storeName:string; address:string; city:string}[]>([]);

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

  // --- SHIPMENT ENTRY (log sample cases + swag sent directly to an ambassador) ---
  const MATERIAL_OPTIONS = [
    { key: 'tablecloth', label: 'Table Cloth' },
    { key: 'standee', label: 'Standee' },
    { key: 'ice_bucket', label: 'Ice Bucket' },
    { key: 'stickers', label: 'Stickers' },
  ];

  const [shipmentData, setShipmentData] = useState<{
    ambassadors: { id: string; full_name: string; city: string | null; state: string | null; street_address: string | null; address_line_2: string | null; zip_code: string | null }[];
    skus: { sku: string; flavor_name: string; cans_per_case: number; potency_mg?: number | null }[];
    events: { id: string; title: string; event_date: string; city: string | null }[];
    recentShipments: any[];
  }>({ ambassadors: [], skus: [], events: [], recentShipments: [] });
  const [shipmentLoading, setShipmentLoading] = useState(false);
  const [shipmentForm, setShipmentForm] = useState({
    user_id: "", event_id: "", tracking_number: "",
    shipped_at: new Date().toISOString().split("T")[0], notes: "",
  });
  const [flavorLines, setFlavorLines] = useState<{ sku: string; cases_sent: string }[]>([{ sku: "", cases_sent: "" }]);
  const [materialQty, setMaterialQty] = useState<Record<string, string>>({});
  const [ambassadorQuery, setAmbassadorQuery] = useState("");
  const [showAmbassadorList, setShowAmbassadorList] = useState(false);
  const [shipmentSubmitting, setShipmentSubmitting] = useState(false);
  const [shipmentError, setShipmentError] = useState("");
  const [shipmentResult, setShipmentResult] = useState<{ ambassadorName: string; balances: any[]; materials: { item: string; quantity: number }[] } | null>(null);

  const fetchShipmentData = async () => {
    setShipmentLoading(true);
    try {
      const res = await fetch(`/api/shipments?client=${encodeURIComponent(TARGET_BRAND)}`);
      if (res.ok) setShipmentData(await res.json());
    } catch (e) { console.error('Failed to fetch shipment data', e); }
    setShipmentLoading(false);
  };

  useEffect(() => { if (activeSection === 'shipment') fetchShipmentData(); }, [activeSection]);

  // Deep link support so a "Log a Shipment" email can jump straight to this tab, e.g.
  // /clients/amigos?section=shipment
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

  const updateFlavorLine = (index: number, patch: Partial<{ sku: string; cases_sent: string }>) => {
    setFlavorLines(prev => prev.map((line, i) => i === index ? { ...line, ...patch } : line));
  };
  const addFlavorLine = () => setFlavorLines(prev => prev.length < shipmentData.skus.length ? [...prev, { sku: "", cases_sent: "" }] : prev);
  const removeFlavorLine = (index: number) => setFlavorLines(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  const skusAlreadyPicked = (excludeIndex: number) => new Set(flavorLines.filter((_, i) => i !== excludeIndex).map(l => l.sku).filter(Boolean));
  const canHintFor = (line: { sku: string; cases_sent: string }) => {
    const sku = shipmentData.skus.find(s => s.sku === line.sku);
    return sku && Number(line.cases_sent) > 0 ? { cans: Number(line.cases_sent) * sku.cans_per_case, perCase: sku.cans_per_case } : null;
  };

  const submitShipment = async () => {
    setShipmentError("");
    const items = flavorLines.filter(l => l.sku && l.cases_sent);
    const materials = MATERIAL_OPTIONS
      .filter(m => Number(materialQty[m.key]) > 0)
      .map(m => ({ item: m.key, quantity: Number(materialQty[m.key]) }));

    if (!shipmentForm.user_id || !shipmentForm.tracking_number || !shipmentForm.shipped_at) {
      setShipmentError("Please fill out recipient, tracking number, and ship date.");
      return;
    }
    // A half-filled flavor line (flavor without cases, or cases without flavor) would be
    // silently dropped, so flag it instead. Flavors themselves are optional: supplies-only
    // shipments are common.
    if (flavorLines.some(l => Boolean(l.sku) !== Boolean(l.cases_sent))) {
      setShipmentError("Finish or remove the flavor line: each one needs a flavor and a case count.");
      return;
    }
    if (items.length === 0 && materials.length === 0) {
      setShipmentError("Add at least one flavor or material to ship.");
      return;
    }
    setShipmentSubmitting(true);
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...shipmentForm, event_id: shipmentForm.event_id || null, items, materials, client: TARGET_BRAND }),
      });
      const data = await res.json();
      if (res.ok) {
        const ambassadorName = shipmentData.ambassadors.find(a => a.id === shipmentForm.user_id)?.full_name || 'Ambassador';
        setShipmentResult({ ambassadorName, balances: data.balances || [], materials });
        setShipmentForm({ user_id: "", event_id: "", tracking_number: "", shipped_at: new Date().toISOString().split("T")[0], notes: "" });
        setFlavorLines([{ sku: "", cases_sent: "" }]);
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
    email: 'var(--canopy-pale)', alert: 'var(--street)', update: 'var(--tint-blue)', announcement: 'var(--tint-amber)'
  };
  const emailStatusColor: Record<string, string> = {
    delivered: 'var(--canopy-pale)', sent: 'var(--tint-blue)', failed: 'var(--street-pale)', pending: 'var(--tint-amber)'
  };

  useEffect(() => { fetchClientData(); fetchNotifications(); }, []);

  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const res = await fetch('/api/dropdown-data?client=AMIGOS');
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

  useEffect(() => {
    const fetchIndependentLocations = async () => {
      try {
        const res = await fetch(`/api/event-templates?client=${encodeURIComponent(TARGET_BRAND)}`);
        if (res.ok) { const data = await res.json(); setIndependentLocations(data.locations || []); }
      } catch (error) { console.error('Failed to fetch independent locations', error); }
    };
    fetchIndependentLocations();
  }, []);

  const fetchPhotos = async (force = false) => {
    if (photoLoading || (!force && eventPhotos.length > 0)) return;
    if (force) setEventPhotos([]);
    setPhotoLoading(true);
    try {
      const res = await fetch('/api/photos?client=amigos');
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

  const applyIndependentLocation = (storeName: string) => {
    const loc = independentLocations.find(l => l.storeName === storeName);
    if (!loc) return;
    setFormData(f => ({ ...f, storeName: loc.storeName, address: loc.address, market: loc.city || f.market }));
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
    <div className="dashboard-wrapper" data-theme={theme}>

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
      {lightboxPhoto && (
        <div className="lightbox-overlay" onClick={() => setLightboxPhoto(null)}>
          <button className="lightbox-close" onClick={() => setLightboxPhoto(null)}>✕</button>
          <img src={lightboxPhoto} alt="Event photo" className="lightbox-img" onClick={e => e.stopPropagation()} />
        </div>
      )}

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
        <a className={`nav-item ${activeSection === 'shipment' ? 'active' : ''}`} onClick={() => setActiveSection('shipment')}><span className="icon">📦</span> Log Shipment</a>
        <Link href="/profiles" className="nav-item"><span className="icon">👥</span> View BA Profiles</Link>
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
                <button className="btn-action-primary" onClick={fetchClientData}>↻ Sync Data</button>
                <button className="btn-action-primary" onClick={downloadDashboardReport} disabled={isExportingDashboard}>
                  {isExportingDashboard ? "Generating PDF..." : "⬇ Export Dashboard"}
                </button>
              </div>
            </h1>
            <p style={{marginTop: '4px', marginBottom: '2px'}}>Welcome back, David</p>
            <p style={{marginTop: '2px'}}>Live connected to Google Sheets</p>
          </div>
          <div className="topbar-right" data-html2canvas-ignore="true">
            <button
              className="btn-action-primary theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={theme === "dark" ? "Light theme" : "Dark theme"}
            >{theme === "dark" ? "☀" : "☾"}</button>
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
                            background: notifTypeColor[n.type?.toLowerCase()] || 'var(--surface-2)',
                            color: 'var(--ink)'
                          }}
                        >
                          {n.type || 'general'}
                        </span>
                        {n.email_status && (
                          <span
                            className="notif-email-status"
                            style={{ background: emailStatusColor[n.email_status?.toLowerCase()] || 'var(--surface-2)', color: 'var(--ink)' }}
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
                    <NotificationStaff metadata={n.metadata} />
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
              {independentLocations.length > 0 && (
                <div className="form-group full">
                  <label className="form-label">Quick Select: Independent Retail Location</label>
                  <select className="form-input" value="" onChange={e => applyIndependentLocation(e.target.value)}>
                    <option value="">— Choose a recent location to autofill —</option>
                    {independentLocations.map(loc => (
                      <option key={loc.storeName} value={loc.storeName}>{loc.storeName}{loc.city ? ` (${loc.city})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group"><label className="form-label">Store Name</label><input type="text" name="storeName" value={formData.storeName} onChange={handleInputChange} className="form-input" placeholder="e.g. Big C Liquor" /></div>
              <div className="form-group"><label className="form-label">Store Address</label><input type="text" name="address" value={formData.address} onChange={handleInputChange} className="form-input" placeholder="e.g. 123 Main St, Orlando, FL" /></div>
              <div className="form-group"><label className="form-label">Market</label><select name="market" value={formData.market} onChange={handleInputChange} className="form-input"><option value="">Select Market</option>{dropdownOptions.market.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Brand</label><select name="brand" value={formData.brand} onChange={handleInputChange} className="form-input"><option value="">Select Brand</option>{dropdownOptions.brand.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Preferred Date</label><input type="date" name="date" value={formData.date} onChange={handleInputChange} className="form-input" /></div>
              <div className="form-group"><label className="form-label">Sampling Type</label><select name="samplingType" value={formData.samplingType} onChange={handleInputChange} className="form-input"><option value="">Select Sampling Type</option>{dropdownOptions.samplingType.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Time (From - To)</label><div className="time-inputs"><input type="time" name="startTime" value={formData.startTime} onChange={handleInputChange} className="form-input" style={{flex: 1}} /><span>-</span><input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} className="form-input" style={{flex: 1}} /></div></div>
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

        {/* SHIPMENT TAB */}
        <div className={`section ${activeSection === 'shipment' ? 'active' : ''}`} data-html2canvas-ignore="true">
          <div className="card">
            <div className="card-header">
              <div>
                <p className="card-title">Log a Sample Shipment</p>
                <p className="card-sub">Record what you've shipped directly to an ambassador — flavors and swag — so their sample balance stays accurate.</p>
              </div>
            </div>

            {shipmentLoading && <p style={{fontSize: '12px', color: 'var(--muted)'}}>Loading ambassadors and flavors…</p>}

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
                <label className="form-label">Flavors (optional, up to {shipmentData.skus.length || 3})</label>
                <div className="flavor-lines">
                  {flavorLines.map((line, i) => {
                    const hint = canHintFor(line);
                    const taken = skusAlreadyPicked(i);
                    return (
                      <div className="flavor-line" key={i}>
                        <div className="flavor-line-top">
                          <select
                            className="form-input"
                            value={line.sku}
                            onChange={(e) => updateFlavorLine(i, { sku: e.target.value })}
                          >
                            <option value="">No flavor (supplies only)</option>
                            {shipmentData.skus.filter(s => !taken.has(s.sku) || s.sku === line.sku).map(s => (
                              <option key={s.sku} value={s.sku}>{s.potency_mg ? `${s.flavor_name} · ${s.potency_mg}mg` : s.flavor_name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="flavor-line-remove"
                            onClick={() => removeFlavorLine(i)}
                            disabled={flavorLines.length === 1}
                            aria-label="Remove flavor"
                          >✕</button>
                        </div>
                        <div className="flavor-line-cases">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            className="form-input"
                            placeholder="Cases"
                            value={line.cases_sent}
                            onChange={(e) => updateFlavorLine(i, { cases_sent: e.target.value })}
                          />
                          {hint && <p className="can-hint">= <strong>{hint.cans}</strong> cans ({hint.perCase}/case)</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {flavorLines.length < shipmentData.skus.length && (
                  <button type="button" className="btn-action-primary" style={{marginTop: '8px'}} onClick={addFlavorLine}>+ Add Another Flavor</button>
                )}
              </div>

              <div className="form-group full">
                <label className="form-label">Materials Included (Optional)</label>
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
                <label className="form-label">Tour Date (Optional)</label>
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
              <div className="balance-card">
                <p className="balance-card-title">✅ Shipment logged for {shipmentResult.ambassadorName}</p>
                {shipmentResult.balances.length > 0 ? (
                  shipmentResult.balances.map((b: any) => (
                    <div key={b.sku} style={{marginBottom: '10px'}}>
                      <div className="balance-stat-row"><span>{b.flavor_name}</span><span></span></div>
                      <div className="balance-stat-row"><span>Total Cans Sent</span><span>{b.total_cans_sent}</span></div>
                      <div className="balance-stat-row"><span>Total Cans Used</span><span>{b.total_cans_used}</span></div>
                      <div className="balance-stat-row"><span>Updated Cans Remaining</span><span className="balance-stat-value">{b.calculated_cans_remaining}</span></div>
                    </div>
                  ))
                ) : (
                  <p style={{fontSize: '12px', margin: 0}}>Shipment saved. Balance will appear once the ambassador reports usage.</p>
                )}
                {shipmentResult.materials.length > 0 && (
                  <p style={{fontSize: '12px', marginTop: '8px', marginBottom: 0}}>
                    Also included: {shipmentResult.materials.map(m => `${m.quantity} ${MATERIAL_OPTIONS.find(o => o.key === m.item)?.label || m.item}`).join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="card" style={{marginTop: '14px'}}>
            <div className="card-header"><div><p className="card-title">Recent Shipments</p><p className="card-sub">Last 25 shipments logged to your ambassadors</p></div></div>
            {shipmentData.recentShipments.length === 0 ? (
              <p style={{fontSize: '12px', color: 'var(--muted)'}}>No shipments logged yet.</p>
            ) : (
              <>
                <div className="shipment-table-wrap">
                  <table className="shipment-table">
                    <thead>
                      <tr><th>Date</th><th>Ambassador</th><th>Flavors</th><th>Materials</th><th>Tracking #</th></tr>
                    </thead>
                    <tbody>
                      {shipmentData.recentShipments.map((s: any) => (
                        <tr key={s.key}>
                          <td>{new Date(s.shipped_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td>{s.ambassador_name}</td>
                          <td>{s.flavors.map((f: any) => `${f.flavor_name} ×${f.cases_sent}`).join(', ')}</td>
                          <td>{s.materials.length > 0 ? s.materials.map((m: any) => `${m.quantity} ${MATERIAL_OPTIONS.find(o => o.key === m.item)?.label || m.item}`).join(', ') : '—'}</td>
                          <td>{s.tracking_number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="shipment-cards">
                  {shipmentData.recentShipments.map((s: any) => (
                    <div className="shipment-card" key={s.key}>
                      <div className="shipment-card-top">
                        <span className="shipment-card-ambassador">{s.ambassador_name}</span>
                        <span className="shipment-card-date">{new Date(s.shipped_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className="shipment-card-flavors">{s.flavors.map((f: any) => `${f.flavor_name} ×${f.cases_sent}`).join(', ')}</div>
                      {s.materials.length > 0 && (
                        <div className="shipment-card-materials">+ {s.materials.map((m: any) => `${m.quantity} ${MATERIAL_OPTIONS.find(o => o.key === m.item)?.label || m.item}`).join(', ')}</div>
                      )}
                      <div className="shipment-card-tracking">Tracking: {s.tracking_number}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
