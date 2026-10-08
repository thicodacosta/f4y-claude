import React from 'react';
export function TimelineItem({ date, title, description, isLast }) {
  return (
    <div style={{ display: 'flex', gap: 20, fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 4 }} />
        {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
      </div>
      <div style={{ paddingBottom: 32 }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{date}</div>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{title}</div>
        {description && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>{description}</p>}
      </div>
    </div>
  );
}
