import React from 'react';
export function Tabs({ tabs = [], active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-sans)' }}>
      {tabs.map(t => (
        <div key={t.id} onClick={() => onChange && onChange(t.id)} style={{ padding: '10px 16px', fontSize: 'var(--text-sm)', fontWeight: 600, color: active === t.id ? 'var(--color-primary)' : 'var(--text-muted)', borderBottom: '2px solid ' + (active === t.id ? 'var(--color-primary)' : 'transparent'), cursor: 'pointer', transition: 'all var(--dur-fast) var(--ease-out)' }}>{t.label}</div>
      ))}
    </div>
  );
}
