import React from 'react';
const icons = { success: '✓', error: '!', info: 'i' };
const colors = { success: 'var(--color-success)', error: 'var(--color-error)', info: 'var(--color-primary)' };
export function Toast({ title, description, tone = 'success', onClose }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: 340, padding: 16, borderRadius: 'var(--radius-lg)', background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', fontFamily: 'var(--font-sans)' }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: colors[tone], color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icons[tone]}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        {description && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>}
      </div>
      {onClose && <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>×</span>}
    </div>
  );
}
