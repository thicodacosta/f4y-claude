import React from 'react';
export function Calendar({ month = 'July 2026', days = [], events = {} }) {
  const grid = days.length ? days : Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <div style={{ fontFamily: 'var(--font-sans)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20, background: 'var(--bg)' }}>
      <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 12, color: 'var(--text)' }}>{month}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {grid.map(d => (
          <div key={d} style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', color: 'var(--text)', background: events[d] ? 'var(--color-primary-subtle)' : 'transparent', fontWeight: events[d] ? 700 : 400 }}>
            {d}{events[d] && <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-primary)', marginTop: 2 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
