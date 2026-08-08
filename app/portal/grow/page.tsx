"use client";
import { useState } from "react";
import { UserButton } from "@clerk/nextjs";

export default function GrowPortal() {
  const [form, setForm] = useState({ repName: "", accountName: "", city: "", visitDate: "", isNewAccount: false, sku: "", qtyOrdered: "", unitWholesale: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const lineTotal = (Number(form.qtyOrdered)||0) * (Number(form.unitWholesale)||0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => {
    const t = e.target as HTMLInputElement;
    setForm(prev => ({ ...prev, [t.name]: t.type==="checkbox" ? t.checked : t.value }));
  };

  const submit = async () => {
    if (!form.repName||!form.accountName||!form.visitDate) { alert("Please fill in Rep Name, Account Name, and Visit Date."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/grow/visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, qtyOrdered: Number(form.qtyOrdered), unitWholesale: Number(form.unitWholesale) }) });
      const data = await res.json();
      if (res.ok) { setMessage("✅ Visit submitted. HubSpot deal created."); setForm({ repName: "", accountName: "", city: "", visitDate: "", isNewAccount: false, sku: "", qtyOrdered: "", unitWholesale: "", notes: "" }); }
      else { setMessage(`❌ Error: ${data.error||"Unknown error"}`); }
    } catch { setMessage("❌ Network error."); }
    setSubmitting(false);
    setTimeout(() => setMessage(""), 7000);
  };

  return (
    <div className="pw">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800,900,500&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .pw { --ink: #0a0a0a; --bone: #faf0ea; --gold: #d97706; --gold-pale: #fef3c7; --white: #fff; --muted: #767672; --shadow: 4px 4px 0 0 #0a0a0a; font-family: 'Manrope', sans-serif; min-height: 100vh; background: var(--bone); color: var(--ink); }
        .pw-header { background: var(--ink); padding: 20px 32px; display: flex; align-items: center; justify-content: space-between; }
        .pw-header-left { display: flex; align-items: center; gap: 14px; }
        .pw-icon { width: 30px; height: 30px; border-radius: 6px; display: block; flex-shrink: 0; }
        .pw-logo { font-size: 10px; font-weight: 700; color: rgba(250,240,234,0.45); letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 3px; }
        .pw-title { font-family: 'Cabinet Grotesk', sans-serif; font-size: 20px; font-weight: 800; color: var(--bone); letter-spacing: -0.02em; }
        .pw-body { max-width: 760px; margin: 40px auto; padding: 0 24px; }
        .pw-card { background: var(--white); border: 2px solid var(--ink); padding: 32px; box-shadow: var(--shadow); margin-bottom: 20px; }
        .pw-section-title { font-family: 'Cabinet Grotesk', sans-serif; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid var(--ink); }
        .pw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .pw-full { grid-column: 1 / -1; }
        .pw-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink); margin-bottom: 6px; display: block; }
        .pw-input { font-family: 'Manrope', sans-serif; font-size: 13px; font-weight: 500; padding: 10px 14px; border: 2px solid var(--ink); width: 100%; background: var(--white); color: var(--ink); outline: none; transition: all 0.15s; }
        .pw-input:focus { box-shadow: 3px 3px 0 0 var(--ink); transform: translate(-2px,-2px); }
        .pw-textarea { resize: vertical; min-height: 90px; }
        .pw-checkbox-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 2px solid var(--ink); cursor: pointer; background: var(--white); transition: background 0.15s; }
        .pw-checkbox-row.checked { background: var(--gold-pale); }
        .pw-checkbox { width: 18px; height: 18px; border: 2px solid var(--ink); appearance: none; cursor: pointer; flex-shrink: 0; position: relative; background: var(--white); }
        .pw-checkbox:checked { background: var(--gold); }
        .pw-checkbox:checked::after { content: '✓'; position: absolute; top: -2px; left: 2px; font-size: 13px; font-weight: 700; color: var(--white); }
        .pw-checkbox-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
        .pw-total { background: var(--gold-pale); border: 2px solid var(--ink); padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; }
        .pw-total-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); }
        .pw-total-value { font-family: 'Cabinet Grotesk', sans-serif; font-size: 28px; font-weight: 800; color: var(--ink); }
        .pw-btn { font-family: 'Cabinet Grotesk', sans-serif; font-size: 13px; font-weight: 700; background: var(--ink); color: var(--bone); border: 2px solid var(--ink); padding: 14px 32px; cursor: pointer; box-shadow: var(--shadow); transition: all 0.15s; text-transform: uppercase; letter-spacing: 0.08em; width: 100%; margin-top: 4px; }
        .pw-btn:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 0 var(--ink); }
        .pw-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .pw-msg { padding: 14px 16px; border: 2px solid var(--ink); font-size: 13px; font-weight: 600; margin-top: 14px; box-shadow: 3px 3px 0 0 var(--ink); background: var(--gold-pale); }
        @media (max-width: 600px) { .pw-grid { grid-template-columns: 1fr; } .pw-body { padding: 0 16px; margin: 20px auto; } }
      `}} />
      <div className="pw-header">
        <div className="pw-header-left">
          <img src="/brand/greenline-icon-canopy.svg" alt="" className="pw-icon" />
          <div><p className="pw-logo">Greenline Activations — Team Portal</p><p className="pw-title">GROW · Post-Visit Sales Recap</p></div>
        </div>
        <UserButton />
      </div>
      <div className="pw-body">
        <div className="pw-card">
          <p className="pw-section-title">Visit Details</p>
          <div className="pw-grid">
            <div><label className="pw-label">Sales Rep Name *</label><input className="pw-input" name="repName" value={form.repName} onChange={handleChange} placeholder="e.g. Jordan Smith" /></div>
            <div><label className="pw-label">Visit Date *</label><input className="pw-input" type="date" name="visitDate" value={form.visitDate} onChange={handleChange} /></div>
            <div><label className="pw-label">Account / Store Name *</label><input className="pw-input" name="accountName" value={form.accountName} onChange={handleChange} placeholder="e.g. Total Wine & More" /></div>
            <div><label className="pw-label">City / Market</label><input className="pw-input" name="city" value={form.city} onChange={handleChange} placeholder="e.g. Orlando, FL" /></div>
            <div className="pw-full"><label className="pw-label">Account Status</label><div className={`pw-checkbox-row ${form.isNewAccount?"checked":""}`} onClick={()=>setForm(prev=>({...prev,isNewAccount:!prev.isNewAccount}))}><input className="pw-checkbox" type="checkbox" name="isNewAccount" checked={form.isNewAccount} onChange={handleChange} /><span className="pw-checkbox-label">New Account — first order with this location</span></div></div>
          </div>
        </div>
        <div className="pw-card">
          <p className="pw-section-title">Order Details</p>
          <div className="pw-grid">
            <div><label className="pw-label">SKU / Product</label><input className="pw-input" name="sku" value={form.sku} onChange={handleChange} placeholder="e.g. GRW-GUMMY-100MG" /></div>
            <div><label className="pw-label">Cases Ordered (Qty)</label><input className="pw-input" type="number" min="0" name="qtyOrdered" value={form.qtyOrdered} onChange={handleChange} placeholder="0" /></div>
            <div><label className="pw-label">Unit Wholesale Price ($ / case)</label><input className="pw-input" type="number" min="0" step="0.01" name="unitWholesale" value={form.unitWholesale} onChange={handleChange} placeholder="0.00" /></div>
            <div style={{display:'flex',alignItems:'flex-end'}}><div className="pw-total" style={{width:'100%'}}><span className="pw-total-label">Line Total</span><span className="pw-total-value">${lineTotal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div></div>
          </div>
        </div>
        <div className="pw-card">
          <p className="pw-section-title">Visit Notes</p>
          <div><label className="pw-label">Notes / Recap</label><textarea className="pw-input pw-textarea" name="notes" value={form.notes} onChange={handleChange} placeholder="Buyer feedback, shelf placement, competitor observations..." /></div>
          <button className="pw-btn" onClick={submit} disabled={submitting}>{submitting?"Submitting...":"Submit Visit Recap"}</button>
          {message&&<div className="pw-msg">{message}</div>}
        </div>
      </div>
    </div>
  );
}
