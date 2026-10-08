import React from 'react';
export function Select({ children, style, ...rest }) {
  return (
    <select style={{ width: '100%', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--text)', padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg)', outline: 'none', ...style }} {...rest}>{children}</select>
  );
}
