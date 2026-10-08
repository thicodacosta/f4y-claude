import React from 'react';
export function Hero({ eyebrow, title, subtitle, actions }) {
  return (
    <section style={{ textAlign: 'center', padding: '96px 24px', background: 'var(--gradient-mesh), var(--bg)', fontFamily: 'var(--font-sans)' }}>
      {eyebrow && <div style={{ display: 'inline-flex', padding: '6px 14px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary-subtle)', color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 20 }}>{eyebrow}</div>}
      <h1 style={{ fontSize: 'var(--font-display-size)', fontWeight: 700, letterSpacing: 'var(--tracking-tighter)', color: 'var(--text)', margin: '0 0 20px', lineHeight: 1.05, maxWidth: 800, marginInline: 'auto' }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 'var(--text-lg)', color: 'var(--text-muted)', maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.6 }}>{subtitle}</p>}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>{actions}</div>
    </section>
  );
}
