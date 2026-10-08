import React from 'react';
export function Input({ error, icon, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {icon && <span style={{ position: 'absolute', left: 14, color: 'var(--text-muted)', display: 'flex' }}>{icon}</span>}
      <input
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          width: '100%', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--text)',
          padding: icon ? '11px 14px 11px 40px' : '11px 14px', borderRadius: 'var(--radius-md)',
          border: '1px solid ' + (error ? 'var(--color-error)' : focus ? 'var(--color-primary)' : 'var(--border)'),
          outline: 'none', background: 'var(--bg)', transition: 'all var(--dur-fast) var(--ease-out)',
          boxShadow: focus ? 'var(--shadow-glow-primary)' : 'none', ...style,
        }}
        {...rest}
      />
    </div>
  );
}
