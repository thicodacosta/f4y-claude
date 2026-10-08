import React from 'react';
export function Pagination({ page = 1, totalPages = 1, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)' }}>
      <button onClick={() => onChange && onChange(Math.max(1, page - 1))} style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer' }}>‹</button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 7).map(p => (
        <button key={p} onClick={() => onChange && onChange(p)} style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid ' + (p === page ? 'var(--color-primary)' : 'var(--border)'), background: p === page ? 'var(--color-primary)' : 'var(--bg)', color: p === page ? '#fff' : 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>{p}</button>
      ))}
      <button onClick={() => onChange && onChange(Math.min(totalPages, page + 1))} style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer' }}>›</button>
    </div>
  );
}
