import React from 'react';
export function Card({ children, style, hoverable }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
      background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24,
      boxShadow: hoverable && hover ? 'var(--shadow-md)' : 'var(--shadow-xs)',
      transform: hoverable && hover ? 'translateY(-2px)' : 'none',
      transition: 'all var(--dur-base) var(--ease-out)', fontFamily: 'var(--font-sans)', ...style,
    }}>{children}</div>
  );
}
