import React from 'react';
const sizes = { sm: { padding: '8px 16px', fontSize: 'var(--text-sm)', height: 36 }, md: { padding: '10px 20px', fontSize: 'var(--text-base)', height: 44 }, lg: { padding: '14px 28px', fontSize: 'var(--text-lg)', height: 52 } };
const variants = {
  primary: { background: 'var(--color-primary)', color: '#fff', border: '1px solid transparent' },
  gradient: { background: 'var(--gradient-primary)', color: '#fff', border: '1px solid transparent' },
  secondary: { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' },
  outline: { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border-strong)' },
  ghost: { background: 'transparent', color: 'var(--text)', border: '1px solid transparent' },
  destructive: { background: 'var(--color-error)', color: '#fff', border: '1px solid transparent' },
};
export function Button({ children, variant = 'primary', size = 'md', icon, iconRight, disabled, style, ...rest }) {
  const s = sizes[size]; const v = variants[variant];
  const [hover, setHover] = React.useState(false);
  return (
    <button
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontFamily: 'var(--font-sans)', fontWeight: 600, borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all var(--dur-base) var(--ease-out)',
        boxShadow: variant === 'primary' || variant === 'gradient' ? 'var(--shadow-sm)' : 'none',
        opacity: disabled ? 0.5 : 1,
        transform: hover && !disabled ? 'translateY(-1px)' : 'none',
        filter: hover && !disabled ? 'brightness(1.06)' : 'none',
        ...s, ...v, ...style,
      }}
      {...rest}
    >
      {icon}{children}{iconRight}
    </button>
  );
}
