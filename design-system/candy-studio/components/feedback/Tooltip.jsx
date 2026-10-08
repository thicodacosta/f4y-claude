import React from 'react';
export function Tooltip({ children, label }) {
  const [show, setShow] = React.useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && <span style={{ position: 'absolute', bottom: '125%', left: '50%', transform: 'translateX(-50%)', background: 'var(--zinc-900)', color: '#fff', fontSize: 'var(--text-xs)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-md)' }}>{label}</span>}
    </span>
  );
}
