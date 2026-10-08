import React from 'react';
export function Breadcrumb({ items = [] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span>/</span>}
          <span style={{ color: i === items.length - 1 ? 'var(--text)' : 'var(--text-muted)', fontWeight: i === items.length - 1 ? 600 : 400 }}>{it}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
