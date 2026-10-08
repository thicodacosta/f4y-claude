import React from 'react';
export function Navbar({ logo, links = [], actions }) {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, fontFamily: 'var(--font-sans)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--text)' }}>{logo}</div>
      <div style={{ display: 'flex', gap: 28 }}>
        {links.map((l, i) => <a key={i} href={l.href || '#'} style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-muted)' }}>{l.label}</a>)}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>{actions}</div>
    </nav>
  );
}
