import React from 'react';
export function Switch({ checked, onChange, ...rest }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange && onChange(!checked)} style={{ width: 40, height: 24, borderRadius: 999, border: 'none', padding: 2, background: checked ? 'var(--color-primary)' : 'var(--zinc-300)', cursor: 'pointer', transition: 'background var(--dur-base) var(--ease-out)' }} {...rest}>
      <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: 'var(--shadow-sm)', transform: checked ? 'translateX(16px)' : 'translateX(0)', transition: 'transform var(--dur-base) var(--ease-spring)' }} />
    </button>
  );
}
