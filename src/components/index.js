import React from 'react';

// ── KpiCard ──────────────────────────────────────────────────────────────────
export function KpiCard({ title, value, icon, color = '#1a237e', sub }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '20px 24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderLeft: `4px solid ${color}`,
      minWidth: 180, flex: 1
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#222' }}>{value ?? '—'}</div>
          {sub && <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{sub}</div>}
        </div>
        <span style={{ fontSize: 32 }}>{icon}</span>
      </div>
    </div>
  );
}

// ── DataTable ─────────────────────────────────────────────────────────────────
export function DataTable({ columns, data, onRowClick }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#999' }}>
        No records found.
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            {columns.map(col => (
              <th key={col.key} style={{
                padding: '10px 14px', textAlign: 'left',
                fontWeight: 600, color: '#333', whiteSpace: 'nowrap',
                borderBottom: '2px solid #e0e0e0'
              }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id ?? i}
              onClick={() => onRowClick && onRowClick(row)}
              style={{
                borderBottom: '1px solid #f0f0f0',
                cursor: onRowClick ? 'pointer' : 'default',
                background: i % 2 === 0 ? '#fff' : '#fafafa'
              }}
              onMouseEnter={e => { if (onRowClick) e.currentTarget.style.background = '#e8eaf6'; }}
              onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'; }}>
              {columns.map(col => (
                <td key={col.key} style={{ padding: '10px 14px', color: '#444' }}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  PENDING:     { bg: '#fff3e0', text: '#e65100' },
  OPEN:        { bg: '#e3f2fd', text: '#0d47a1' },
  REPORTED:    { bg: '#e3f2fd', text: '#0d47a1' },
  ASSIGNED:    { bg: '#e8eaf6', text: '#283593' },
  IN_PROGRESS: { bg: '#e0f2f1', text: '#004d40' },
  ON_HOLD:     { bg: '#fff9c4', text: '#f57f17' },
  HOLD:        { bg: '#fff9c4', text: '#f57f17' },
  COMPLETED:   { bg: '#e8f5e9', text: '#1b5e20' },
  BILLED:      { bg: '#e8f5e9', text: '#1b5e20' },
  APPROVED:    { bg: '#e8f5e9', text: '#1b5e20' },
  REJECTED:    { bg: '#ffebee', text: '#b71c1c' },
  CANCELLED:   { bg: '#fce4ec', text: '#880e4f' },
  ACTIVE:      { bg: '#e8f5e9', text: '#1b5e20' },
  INACTIVE:    { bg: '#f5f5f5', text: '#757575' },
  LOW_STOCK:   { bg: '#fff3e0', text: '#e65100' },
  OUT_OF_STOCK:{ bg: '#ffebee', text: '#b71c1c' },
  IN_STOCK:    { bg: '#e8f5e9', text: '#1b5e20' },
};

export function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || { bg: '#f5f5f5', text: '#333' };
  return (
    <span style={{
      background: colors.bg, color: colors.text,
      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600
    }}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

// ── PageHeader ────────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      marginBottom: 24
    }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, color: '#1a237e' }}>{title}</h1>
        {subtitle && <p style={{ margin: '4px 0 0', color: '#666', fontSize: 14 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10 }}>{actions}</div>}
    </div>
  );
}

// ── Btn ───────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, color = '#1a237e', small, disabled, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      background: disabled ? '#ccc' : color, color: '#fff',
      border: 'none', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
      padding: small ? '6px 14px' : '9px 20px',
      fontSize: small ? 12 : 14, fontWeight: 600
    }}>
      {children}
    </button>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: '#fff', borderRadius: 10, width, maxWidth: '95vw',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #eee',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, color: '#1a237e' }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20,
            cursor: 'pointer', color: '#666', lineHeight: 1
          }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

// ── FormField ─────────────────────────────────────────────────────────────────
export function FormField({ label, children, required }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#333' }}>
        {label}{required && <span style={{ color: '#c62828' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

export const inputStyle = {
  width: '100%', padding: '8px 12px', border: '1px solid #ddd',
  borderRadius: 6, fontSize: 14, boxSizing: 'border-box', outline: 'none'
};
