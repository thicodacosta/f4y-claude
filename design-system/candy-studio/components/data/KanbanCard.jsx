import React from 'react';
export function KanbanCard({ title, tag, tagTone = 'primary', assignee, due }) {
  const tones = { primary: 'var(--color-primary-subtle)', success: 'var(--color-success-subtle)', warning: 'var(--color-warning-subtle)' };
  const fgs = { primary: 'var(--color-primary)', success: 'var(--color-success-strong)', warning: 'var(--color-warning-strong)' };
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, fontFamily: 'var(--font-sans)', boxShadow: 'var(--shadow-xs)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {tag && <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-full)', background: tones[tagTone], color: fgs[tagTone] }}>{tag}</span>}
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{due}</span>
        {assignee && <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--gradient-primary)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{assignee}</span>}
      </div>
    </div>
  );
}
