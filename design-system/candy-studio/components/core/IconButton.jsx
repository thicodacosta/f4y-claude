import React from 'react';
export function IconButton({ children, variant = 'ghost', size = 'md', ...rest }) {
  const dim = { sm: 32, md: 40, lg: 48 }[size];
  const [hover, setHover] = React.useState(false);
  const bg = variant === 'ghost' ? (hover ? 'var(--surface-2)' : 'transparent') : (hover ? 'var(--color-primary-hover)' : 'var(--color-primary)');
  return (
    <button onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
      width: dim, height: dim, borderRadius: 'var(--radius-md)', border: variant === 'outline' ? '1px solid var(--border-strong)' : '1px solid transparent',
      background: bg, color: variant === 'ghost' || variant === 'outline' ? 'var(--text)' : '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all var(--dur-fast) var(--ease-out)',
    }} {...rest}>{children}</button>
  );
}
