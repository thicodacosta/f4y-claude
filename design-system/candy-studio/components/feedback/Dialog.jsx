import React from 'react';
export function Dialog({ title, description, children, onClose, footer }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 440, background: 'var(--bg)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)', padding: 28, fontFamily: 'var(--font-sans)' }}>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{title}</div>
        {description && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 8 }}>{description}</div>}
        {children && <div style={{ marginTop: 16 }}>{children}</div>}
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>{footer}</div>}
      </div>
    </div>
  );
}
