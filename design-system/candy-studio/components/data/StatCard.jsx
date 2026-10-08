import React from 'react';
export function StatCard({ label, value, delta, deltaTone = 'success', icon }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20, fontFamily: 'var(--font-sans)', boxShadow: 'var(--shadow-xs)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
        {icon && <span style={{ color: 'var(--color-primary)' }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)', marginTop: 8 }}>{value}</div>
      {delta && <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: deltaTone === 'success' ? 'var(--color-success-strong)' : 'var(--color-error-strong)', marginTop: 6 }}>{delta}</div>}
    </div>
  );
}
