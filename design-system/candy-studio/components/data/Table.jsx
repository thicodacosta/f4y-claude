import React from 'react';
export function Table({ columns = [], rows = [] }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--surface)' }}>
            {columns.map((c, i) => <th key={i} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid var(--border)' }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ borderBottom: ri < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
              {r.map((cell, ci) => <td key={ci} style={{ padding: '14px 16px', fontSize: 'var(--text-sm)', color: 'var(--text)' }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
