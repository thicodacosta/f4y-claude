import React from 'react';
export function Textarea({ style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <textarea onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} style={{ width: '100%', minHeight: 96, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--text)', padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '1px solid ' + (focus ? 'var(--color-primary)' : 'var(--border)'), outline: 'none', resize: 'vertical', boxShadow: focus ? 'var(--shadow-glow-primary)' : 'none', ...style }} {...rest} />
  );
}
