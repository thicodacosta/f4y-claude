import React from 'react';
export function Tag({ children, onRemove }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text)' }}>
      {children}
      {onRemove && <span onClick={onRemove} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>×</span>}
    </span>
  );
}
