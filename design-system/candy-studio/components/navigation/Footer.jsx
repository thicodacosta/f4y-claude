import React from 'react';
export function Footer({ logo, columns = [], bottom }) {
  return (
    <footer style={{ padding: '64px 32px 32px', borderTop: '1px solid var(--border)', fontFamily: 'var(--font-sans)', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', gap: 64, maxWidth: 1280, margin: '0 auto', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--text)' }}>{logo}</div>
        {columns.map((c, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.title}</div>
            {c.links.map((l, li) => <a key={li} href="#" style={{ fontSize: 'var(--text-sm)', color: 'var(--text)' }}>{l}</a>)}
          </div>
        ))}
      </div>
      {bottom && <div style={{ maxWidth: 1280, margin: '40px auto 0', paddingTop: 20, borderTop: '1px solid var(--border)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{bottom}</div>}
    </footer>
  );
}
