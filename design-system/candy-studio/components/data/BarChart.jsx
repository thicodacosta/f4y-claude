import React from 'react';
export function BarChart({ data = [], height = 160 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height, fontFamily: 'var(--font-sans)' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ width: '100%', height: (d.value / max) * (height - 24), borderRadius: '6px 6px 0 0', background: 'var(--gradient-primary)' }} />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}
