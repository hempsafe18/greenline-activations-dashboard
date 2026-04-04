"use client";
import { useState } from "react";

export default function PliftDashboard() {
  const [activations, setActivations] = useState(20);
  const cost = 4500;
  const greenlineCostPerActivation = 225;

  return (
    <div style={{ maxWidth: '800px', margin: '3rem auto', padding: '2rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#10B981' }}>Plift Dashboard</h1>
      <hr style={{ marginBottom: '2rem', borderColor: '#e5e7eb' }}/>
      
      <h2>Sprint ROI Calculator</h2>
      <div style={{ marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Number of Activations:</label>
        <input 
          type="number" 
          value={activations} 
          onChange={(e) => setActivations(Number(e.target.value))}
          style={{ padding: '0.5rem', width: '100px', borderRadius: '4px', border: '1px solid #d1d5db' }}
        />
        <p style={{ marginTop: '1rem' }}>Fixed Sprint Cost: <strong>${cost}</strong></p>
        <p>Greenline Cost per Activation: <strong>${greenlineCostPerActivation}</strong></p>
      </div>

      <div style={{ display: 'flex', gap: '2rem' }}>
        <div style={{ flex: 1, padding: '1.5rem', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '1px solid #10B981' }}>
          <h3 style={{ color: '#065f46' }}>Estimated Results</h3>
          <p>Consumers Reached: <strong>{activations * 150}</strong></p>
          <p>Est. Units Moved: <strong>{activations * 25}</strong></p>
        </div>
      </div>
    </div>
  );
}
