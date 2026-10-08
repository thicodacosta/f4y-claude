import React from 'react';
export function Sidebar({ logo, sections = [], activeId, footer }) {
  return (
    <aside style={{ width: 240, height: '100%', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
      <div style={{ padding: '20px 20px 8px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text)' }}>{logo}</div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {sections.map((sec, si) => (
          <div key={si} style={{ marginBottom: 16 }}>
            {sec.title && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '6px 10px' }}>{sec.title}</div>}
            {sec.items.map(it => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', fontWeight: 500, color: activeId === it.id ? 'var(--color-primary)' : 'var(--text)', background: activeId === it.id ? 'var(--color-primary-subtle)' : 'transparent', cursor: 'pointer' }}>
                {it.icon}{it.label}
              </div>
            ))}
          </div>
        ))}
      </div>
      {footer && <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>{footer}</div>}
    </aside>
  );
}
