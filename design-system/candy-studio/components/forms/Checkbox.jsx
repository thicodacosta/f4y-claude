import React from 'react';
export function Checkbox({ label, checked, onChange, ...rest }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text)' }}>
      <span style={{ width: 18, height: 18, borderRadius: 6, border: '1px solid ' + (checked ? 'var(--color-primary)' : 'var(--border-strong)'), background: checked ? 'var(--color-primary)' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--dur-fast) var(--ease-out)' }}>
        {checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ display: 'none' }} {...rest} />
      {label}
    </label>
  );
}
