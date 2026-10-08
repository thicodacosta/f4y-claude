import React from 'react';
const tones = {
  neutral: { bg: 'var(--surface-2)', fg: 'var(--text)' },
  primary: { bg: 'var(--color-primary-subtle)', fg: 'var(--color-primary)' },
  success: { bg: 'var(--color-success-subtle)', fg: 'var(--color-success-strong)' },
  warning: { bg: 'var(--color-warning-subtle)', fg: 'var(--color-warning-strong)' },
  error: { bg: 'var(--color-error-subtle)', fg: 'var(--color-error-strong)' },
};
export function Badge({ children, tone = 'neutral', dot }) {
  const t = tones[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--radius-full)', background: t.bg, color: t.fg, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.fg }} />}
      {children}
    </span>
  );
}
