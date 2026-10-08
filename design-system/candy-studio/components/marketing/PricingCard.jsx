import React from 'react';
export function PricingCard({ name, price, period = '/mo', description, features = [], highlighted, cta = 'Get started' }) {
  return (
    <div style={{ flex: 1, borderRadius: 'var(--radius-xl)', padding: 32, fontFamily: 'var(--font-sans)',
      background: highlighted ? 'var(--zinc-950)' : 'var(--bg)', color: highlighted ? '#fff' : 'var(--text)',
      border: highlighted ? 'none' : '1px solid var(--border)', boxShadow: highlighted ? 'var(--shadow-xl)' : 'var(--shadow-xs)',
      transform: highlighted ? 'translateY(-8px)' : 'none' }}>
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: highlighted ? 'var(--zinc-400)' : 'var(--text-muted)' }}>{name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '12px 0' }}>
        <span style={{ fontSize: 'var(--text-5xl)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{price}</span>
        <span style={{ fontSize: 'var(--text-sm)', color: highlighted ? 'var(--zinc-400)' : 'var(--text-muted)' }}>{period}</span>
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: highlighted ? 'var(--zinc-400)' : 'var(--text-muted)', marginBottom: 24 }}>{description}</div>
      <button style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', border: 'none', fontWeight: 600, marginBottom: 24, cursor: 'pointer',
        background: highlighted ? 'var(--gradient-primary)' : 'var(--surface-2)', color: highlighted ? '#fff' : 'var(--text)' }}>{cta}</button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {features.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 'var(--text-sm)', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--color-accent)' }}>✓</span>{f}
          </div>
        ))}
      </div>
    </div>
  );
}
