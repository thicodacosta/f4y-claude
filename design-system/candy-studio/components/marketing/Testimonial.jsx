import React from 'react';
export function Testimonial({ quote, name, role, avatar }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 28, fontFamily: 'var(--font-sans)', boxShadow: 'var(--shadow-xs)' }}>
      <p style={{ fontSize: 'var(--text-lg)', color: 'var(--text)', lineHeight: 1.6, margin: '0 0 20px' }}>&ldquo;{quote}&rdquo;</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: avatar || 'var(--gradient-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--text-sm)' }}>{name?.[0]}</div>
        <div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text)' }}>{name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{role}</div>
        </div>
      </div>
    </div>
  );
}
