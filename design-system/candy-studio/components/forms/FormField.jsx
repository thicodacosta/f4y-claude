import React from 'react';
export function FormField({ label, hint, error, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-sans)' }}>
      {label && <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)' }}>{label}{required && <span style={{ color: 'var(--color-error)' }}> *</span>}</label>}
      {children}
      {error ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)' }}>{error}</span> : hint ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{hint}</span> : null}
    </div>
  );
}
