import React from 'react';
export function Radio({ label, checked, onChange, ...rest }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text)' }}>
      <span style={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid ' + (checked ? 'var(--color-primary)' : 'var(--border-strong)'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {checked && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--color-primary)' }} />}
      </span>
      <input type="radio" checked={checked} onChange={onChange} style={{ display: 'none' }} {...rest} />
      {label}
    </label>
  );
}
