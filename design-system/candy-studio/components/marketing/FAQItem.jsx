import React from 'react';
export function FAQItem({ question, answer, defaultOpen }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '20px 0', fontFamily: 'var(--font-sans)' }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text)' }}>{question}</span>
        <span style={{ color: 'var(--text-muted)', transform: open ? 'rotate(45deg)' : 'none', transition: 'transform var(--dur-base) var(--ease-out)' }}>+</span>
      </div>
      {open && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 12 }}>{answer}</p>}
    </div>
  );
}
