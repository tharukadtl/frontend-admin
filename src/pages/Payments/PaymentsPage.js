import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── API ──────────────────────────────────────────────────────────────────────
const API   = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const tok   = () => localStorage.getItem('accessToken');
const req   = (method, path, body) =>
    fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: body ? JSON.stringify(body) : undefined,
    }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });
const get  = p     => req('GET',  p);
const post = (p,b) => req('POST', p, b);

// ─── Palette — rich midnight ledger ───────────────────────────────────────────
const P = {
  bg:       '#0C0E12',
  panel:    '#131720',
  surface:  '#1A2132',
  lift:     '#1F2A3E',
  border:   '#273448',
  border2:  '#1D2838',
  text:     '#E8EFF8',
  muted:    '#6B829C',
  dim:      '#3E5270',
  gold:     '#F5C542',
  goldD:    '#B8901E',
  goldL:    '#2A1F05',
  emerald:  '#10D080',
  emeraldD: '#0A8050',
  emeraldL: '#071E14',
  rose:     '#F04060',
  roseD:    '#A02040',
  roseL:    '#1E080E',
  sky:      '#3BB0F0',
  skyL:     '#0A1E30',
  amber:    '#F09030',
  amberL:   '#201408',
  white:    '#FFFFFF',
};

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  DRAFT:                 { label: 'Pending Review',  bg: P.goldL,    color: P.gold,    dot: P.gold    },
  FINAL:                 { label: 'Final / Billed',  bg: P.emeraldL, color: P.emerald, dot: P.emerald },
  NOT_APPROVED:          { label: 'Not Approved',    bg: P.roseL,    color: P.rose,    dot: P.rose    },
  DISPUTED:              { label: 'Disputed',        bg: P.amberL,   color: P.amber,   dot: P.amber   },
  PENDING_CLIENT_REVIEW: { label: 'Awaiting Client', bg: P.skyL,     color: P.sky,     dot: P.sky     },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtLKR  = v => v != null
    ? `LKR ${Number(v).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';
const fmtDate = d => d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
const fmtDT   = d => d
    ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';
const timeAgo = d => {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MICRO-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const StatusPill = ({ status }) => {
  const c = STATUS_CFG[status] || STATUS_CFG.PENDING;
  return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
        background: c.bg, color: c.color, border: `1px solid ${c.color}44`,
        letterSpacing: 0.3, whiteSpace: 'nowrap',
      }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: c.dot, boxShadow: `0 0 5px ${c.dot}`,
        display: 'inline-block',
      }} />
        {c.label}
    </span>
  );
};

const Avatar = ({ name, size = 32, gradient = `linear-gradient(135deg, ${P.goldD}, ${P.gold})` }) => (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: gradient,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800, color: P.bg,
      fontFamily: 'Playfair Display, serif',
    }}>
      {name?.charAt(0)?.toUpperCase() || '?'}
    </div>
);

const Skeleton = ({ h = 14, w = '100%', r = 6, mb = 0 }) => (
    <div style={{
      height: h, width: w, borderRadius: r, marginBottom: mb,
      background: `linear-gradient(90deg, ${P.surface} 25%, ${P.lift} 50%, ${P.surface} 75%)`,
      backgroundSize: '400% 100%', animation: 'pay-shimmer 1.4s ease infinite',
    }} />
);

const Divider = ({ my = 16 }) => (
    <div style={{ height: 1, background: P.border, margin: `${my}px 0` }} />
);

// ─── Button ──────────────────────────────────────────────────────────────────
const Btn = ({ children, variant = 'ghost', onClick, disabled = false, full = false, sx = {} }) => {
  const [hov, setHov] = useState(false);
  const v = {
    ghost:   { bg: 'transparent',  hbg: P.lift,      color: P.text,    border: P.border  },
    primary: { bg: P.goldD,        hbg: '#9A7018',   color: P.bg,      border: P.gold    },
    approve: { bg: P.emeraldD,     hbg: '#077048',   color: P.white,   border: P.emerald },
    reject:  { bg: P.roseD,        hbg: '#801830',   color: P.white,   border: P.rose    },
    amber:   { bg: P.amberL,       hbg: '#301C08',   color: P.amber,   border: P.amber   },
  }[variant] || {};
  return (
      <button
          onClick={onClick} disabled={disabled}
          onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
            background: hov ? v.hbg : v.bg, border: `1.5px solid ${v.border}`,
            color: v.color, transition: 'all 0.13s', whiteSpace: 'nowrap',
            fontFamily: 'IBM Plex Mono, monospace',
            width: full ? '100%' : undefined, ...sx,
          }}
      >
        {children}
      </button>
  );
};

// ─── Input ───────────────────────────────────────────────────────────────────
const Input = ({ value, onChange, placeholder, type = 'text', sx = {} }) => (
    <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: P.surface, border: `1.5px solid ${P.border}`,
          borderRadius: 8, padding: '9px 12px', fontSize: 13, color: P.text,
          outline: 'none', width: '100%',
          fontFamily: 'IBM Plex Mono, monospace',
          transition: 'border-color 0.13s', ...sx,
        }}
        onFocus={e => e.target.style.borderColor = P.gold}
        onBlur={e => e.target.style.borderColor = P.border}
    />
);

// ─── Textarea ─────────────────────────────────────────────────────────────────
const Textarea = ({ value, onChange, placeholder, rows = 3 }) => (
    <textarea
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={rows}
        style={{
          background: P.surface, border: `1.5px solid ${P.border}`,
          borderRadius: 8, padding: '9px 12px', fontSize: 13, color: P.text,
          outline: 'none', width: '100%', resize: 'vertical',
          fontFamily: 'IBM Plex Mono, monospace',
          transition: 'border-color 0.13s',
        }}
        onFocus={e => e.target.style.borderColor = P.gold}
        onBlur={e => e.target.style.borderColor = P.border}
    />
);

// ─── Toast ───────────────────────────────────────────────────────────────────
const Toast = ({ msg, type, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3400);
    return () => clearTimeout(t);
  }, [onDone]);
  const col = type === 'success' ? P.emerald : type === 'error' ? P.rose : P.amber;
  return (
      <div style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 3000,
        background: P.panel, border: `2px solid ${col}`,
        borderRadius: 12, padding: '12px 20px',
        boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px ${col}22`,
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 13, color: P.text, maxWidth: 380,
        animation: 'pay-toastin 0.22s ease',
        fontFamily: 'IBM Plex Mono, monospace',
      }}>
      <span style={{ fontSize: 18 }}>
        {type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️'}
      </span>
        {msg}
      </div>
  );
};

// ─── Section label ────────────────────────────────────────────────────────────
const SectionLabel = ({ children, action }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 10,
    }}>
    <span style={{
      fontSize: 10, fontWeight: 800, color: P.muted,
      letterSpacing: 1.2, textTransform: 'uppercase',
      fontFamily: 'IBM Plex Mono, monospace',
    }}>
      {children}
    </span>
      {action}
    </div>
);

// ─── Amount chip ─────────────────────────────────────────────────────────────
const AmountChip = ({ label, value, color = P.text, large = false }) => (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: large ? '14px 20px' : '10px 14px',
      background: P.surface, borderRadius: 10, border: `1px solid ${P.border}`,
      minWidth: large ? 140 : 100,
    }}>
      <div style={{
        fontSize: large ? 20 : 15, fontWeight: 800, color,
        fontFamily: 'Playfair Display, serif', letterSpacing: -0.5,
      }}>
        {fmtLKR(value)}
      </div>
      <div style={{ fontSize: 10, color: P.muted, marginTop: 3, letterSpacing: 0.5 }}>
        {label}
      </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT REVIEW PANEL — right side detail view
// ═══════════════════════════════════════════════════════════════════════════════
function ReviewPanel({ payment, onApprove, onReject, onClose }) {
  const [notes,         setNotes]         = useState('');
  const [rejectReason,  setRejectReason]  = useState('');
  const [adjustedAmt,   setAdjustedAmt]   = useState('');
  const [mode,          setMode]          = useState(null); // 'approve'|'reject'|'adjust'
  const [loading,       setLoading]       = useState(false);
  const [photoIdx,      setPhotoIdx]      = useState(0);

  useEffect(() => {
    if (payment) {
      setNotes('');
      setRejectReason('');
      setAdjustedAmt(payment.totalChargeableAmount ?? '');
      setMode(null);
      setPhotoIdx(0);
    }
  }, [payment?.id]);

  if (!payment) return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100%', color: P.muted, gap: 12,
      }}>
        <div style={{ fontSize: 52 }}>💳</div>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Playfair Display, serif' }}>
          Select a payment to review
        </div>
        <div style={{ fontSize: 12 }}>Click any pending item from the left panel</div>
      </div>
  );

  const isPending  = payment.status === 'DRAFT';
  const photos     = [];
  const materials  = [];
  const labourItems= [];

  const handleApprove = async () => {
    setLoading(true);
    try {
      const patch = (p, b) =>
        fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8080'}${p}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
          body: JSON.stringify(b),
        }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });
      await patch(`/api/payments/${payment.id}/review`, {
        decision: 'APPROVED',
        adjustedAmount: adjustedAmt ? Number(adjustedAmt) : null,
        reason: notes || null,
      });
      onApprove('Payment approved successfully', 'success');
    } catch { onApprove('Approval failed', 'error'); }
    finally { setLoading(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setLoading(true);
    try {
      const patch = (p, b) =>
        fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8080'}${p}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
          body: JSON.stringify(b),
        }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });
      await patch(`/api/payments/${payment.id}/review`, {
        decision: 'REJECTED',
        reason: rejectReason,
      });
      onReject('Payment rejected', 'warning');
    } catch { onReject('Rejection failed', 'error'); }
    finally { setLoading(false); }
  };

  const totalChargeable = Number(payment.totalAmount)         || 0;
  const totalFOCamt     = Number(payment.materialsFocTotal)   || 0;
  const grandTotal      = totalFOCamt + totalChargeable;

  return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${P.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{
                fontSize: 13, fontWeight: 800, color: P.gold,
                fontFamily: 'IBM Plex Mono, monospace',
              }}>
                #{payment.id}
              </span>
                <StatusPill status={payment.status} />
                {payment.urgency === 'URGENT' && (
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 4,
                      background: P.roseL, color: P.rose, fontWeight: 800,
                      border: `1px solid ${P.rose}44`,
                    }}>
                  🔴 URGENT
                </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: P.muted }}>
                Submitted {timeAgo(payment.submittedAt || payment.createdAt)}
              </div>
            </div>
            <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', color: P.muted,
                  fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
                }}
                onMouseEnter={e => e.target.style.color = P.text}
                onMouseLeave={e => e.target.style.color = P.muted}
            >×</button>
          </div>

          {/* Submitter */}
          {payment.teamLeadName && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                background: P.surface, border: `1px solid ${P.border}`,
                marginTop: 12,
              }}>
                <Avatar name={payment.teamLeadName} size={34} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: P.text }}>
                    {payment.teamLeadName}
                  </div>
                  <div style={{ fontSize: 11, color: P.muted }}>
                    Team Lead · Job #{payment.jobNumber || payment.jobId}
                  </div>
                </div>
                {payment.faultNumber && (
                    <div style={{
                      marginLeft: 'auto', padding: '4px 10px',
                      borderRadius: 6, background: P.skyL,
                      border: `1px solid ${P.sky}44`,
                      fontSize: 11, color: P.sky, fontWeight: 700,
                    }}>
                      Fault #{payment.faultNumber}
                    </div>
                )}
              </div>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>

          {/* Amount summary */}
          <SectionLabel>Billing Summary</SectionLabel>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <AmountChip label="FOC Amount"       value={totalFOCamt}     color={P.emerald} />
            <AmountChip label="Chargeable"        value={totalChargeable} color={P.gold} />
            <AmountChip label="Grand Total"       value={grandTotal}      color={P.text} large />
            {payment.approvedAmount != null && (
                <AmountChip label="Approved Amount" value={payment.approvedAmount} color={P.sky} />
            )}
          </div>

          {/* Work photos */}
          {photos.length > 0 && (
              <>
                <SectionLabel>
                  Work Photos ({photos.length})
                </SectionLabel>
                <div style={{ marginBottom: 20 }}>
                  {/* Main photo */}
                  <div style={{
                    width: '100%', height: 200, borderRadius: 10, overflow: 'hidden',
                    background: P.surface, border: `1px solid ${P.border}`,
                    marginBottom: 8, position: 'relative',
                  }}>
                    <img
                        src={photos[photoIdx]?.url || photos[photoIdx]}
                        alt={`Work photo ${photoIdx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.style.display = 'none'; }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 8, right: 8,
                      background: 'rgba(0,0,0,0.7)', borderRadius: 6,
                      padding: '3px 8px', fontSize: 11, color: P.text,
                    }}>
                      {photoIdx + 1} / {photos.length}
                    </div>
                  </div>
                  {/* Thumbnails */}
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                    {photos.map((ph, i) => (
                        <div
                            key={i}
                            onClick={() => setPhotoIdx(i)}
                            style={{
                              width: 56, height: 56, borderRadius: 7, overflow: 'hidden',
                              cursor: 'pointer', flexShrink: 0,
                              border: `2px solid ${i === photoIdx ? P.gold : P.border}`,
                              transition: 'border-color 0.13s',
                            }}
                        >
                          <img
                              src={ph?.url || ph}
                              alt={`thumb ${i + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={e => { e.target.style.display = 'none'; }}
                          />
                        </div>
                    ))}
                  </div>
                </div>
              </>
          )}

          {/* Materials table */}
          {materials.length > 0 && (
              <>
                <SectionLabel>Materials Used ({materials.length})</SectionLabel>
                <div style={{
                  border: `1px solid ${P.border}`, borderRadius: 10,
                  overflow: 'hidden', marginBottom: 20,
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                    <tr style={{ background: P.surface }}>
                      {['Material', 'Qty', 'Unit Price', 'Total', 'Type'].map((h, i) => (
                          <th key={i} style={{
                            padding: '8px 12px', textAlign: 'left',
                            fontSize: 10, fontWeight: 800, color: P.muted,
                            letterSpacing: 0.6, borderBottom: `1px solid ${P.border}`,
                            fontFamily: 'IBM Plex Mono, monospace',
                          }}>{h}</th>
                      ))}
                    </tr>
                    </thead>
                    <tbody>
                    {materials.map((m, i) => {
                      const isFOC = m.isFoc || m.isFOC;
                      return (
                          <tr key={i} style={{
                            borderBottom: i < materials.length - 1
                                ? `1px solid ${P.border2}` : 'none',
                          }}>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: P.text, fontWeight: 600 }}>
                              {m.materialName || m.name || '—'}
                            </td>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: P.muted }}>
                              {m.quantityUsed || m.quantity || 1}
                            </td>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: P.muted }}>
                              {fmtLKR(m.unitPrice)}
                            </td>
                            <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 700, color: P.text }}>
                              {fmtLKR(m.totalCost || m.subtotal)}
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                          <span style={{
                            fontSize: 10, padding: '2px 7px', borderRadius: 4,
                            fontWeight: 800,
                            background: isFOC ? P.emeraldL : P.goldL,
                            color: isFOC ? P.emerald : P.gold,
                            border: `1px solid ${isFOC ? P.emerald : P.gold}44`,
                          }}>
                            {isFOC ? 'FOC' : 'Charge'}
                          </span>
                            </td>
                          </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
              </>
          )}

          {/* Labour */}
          {labourItems.length > 0 && (
              <>
                <SectionLabel>Labour Charges</SectionLabel>
                <div style={{
                  border: `1px solid ${P.border}`, borderRadius: 10,
                  overflow: 'hidden', marginBottom: 20,
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                    <tr style={{ background: P.surface }}>
                      {['Description', 'Duration', 'Rate', 'Amount', 'Type'].map((h, i) => (
                          <th key={i} style={{
                            padding: '8px 12px', textAlign: 'left',
                            fontSize: 10, fontWeight: 800, color: P.muted,
                            letterSpacing: 0.6, borderBottom: `1px solid ${P.border}`,
                            fontFamily: 'IBM Plex Mono, monospace',
                          }}>{h}</th>
                      ))}
                    </tr>
                    </thead>
                    <tbody>
                    {labourItems.map((l, i) => (
                        <tr key={i} style={{
                          borderBottom: i < labourItems.length - 1
                              ? `1px solid ${P.border2}` : 'none',
                        }}>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: P.text }}>
                            {l.description || 'Labour'}
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: P.muted }}>
                            {l.hours || l.durationHours || '—'}h
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: P.muted }}>
                            {fmtLKR(l.ratePerHour || l.hourlyRate)}
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 700, color: P.text }}>
                            {fmtLKR(l.amount || l.totalAmount)}
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 4,
                          fontWeight: 800,
                          background: l.isFoc ? P.emeraldL : P.goldL,
                          color: l.isFoc ? P.emerald : P.gold,
                          border: `1px solid ${l.isFoc ? P.emerald : P.gold}44`,
                        }}>
                          {l.isFoc ? 'FOC' : 'Charge'}
                        </span>
                          </td>
                        </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              </>
          )}

          {/* Justification */}
          {(payment.materialJustification || payment.workSummary) && (
              <>
                <SectionLabel>Justification / Work Summary</SectionLabel>
                <div style={{
                  padding: '12px 14px', borderRadius: 8,
                  background: P.surface, border: `1px solid ${P.border}`,
                  fontSize: 13, color: P.muted, lineHeight: 1.6,
                  fontStyle: 'italic', marginBottom: 20,
                }}>
                  "{payment.materialJustification || payment.workSummary}"
                </div>
              </>
          )}

          {/* Signature */}
          {payment.customerSignatureUrl && (
              <>
                <SectionLabel>Customer Signature</SectionLabel>
                <div style={{
                  borderRadius: 8, overflow: 'hidden',
                  border: `1px solid ${P.border}`,
                  marginBottom: 20, background: P.white,
                }}>
                  <img
                      src={payment.customerSignatureUrl}
                      alt="Customer signature"
                      style={{ width: '100%', maxHeight: 80, objectFit: 'contain', padding: 8 }}
                      onError={e => { e.target.style.display = 'none'; }}
                  />
                </div>
              </>
          )}

          {/* Previous reviewer notes */}
          {payment.reviewerNotes && (
              <>
                <SectionLabel>Previous Review Notes</SectionLabel>
                <div style={{
                  padding: '12px 14px', borderRadius: 8,
                  background: P.surface, border: `1px solid ${P.border}`,
                  fontSize: 12, color: P.text, lineHeight: 1.6, marginBottom: 20,
                }}>
                  {payment.reviewerNotes}
                </div>
              </>
          )}

          {/* Rejection reason (if already rejected) */}
          {payment.rejectionReason && (
              <>
                <SectionLabel>Rejection Reason</SectionLabel>
                <div style={{
                  padding: '12px 14px', borderRadius: 8,
                  background: P.roseL, border: `1px solid ${P.rose}44`,
                  fontSize: 12, color: P.rose, lineHeight: 1.6, marginBottom: 20,
                }}>
                  {payment.rejectionReason}
                </div>
              </>
          )}
        </div>

        {/* Action footer */}
        {isPending && (
            <div style={{
              padding: '16px 24px',
              borderTop: `1px solid ${P.border}`,
              background: P.panel,
              flexShrink: 0,
            }}>
              {/* Mode: none — show action buttons */}
              {!mode && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn variant="approve" onClick={() => setMode('approve')} sx={{ flex: 1 }}>
                      ✅ Approve
                    </Btn>
                    <Btn variant="amber" onClick={() => setMode('adjust')} sx={{ flex: 1 }}>
                      ✏️ Adjust & Approve
                    </Btn>
                    <Btn variant="reject" onClick={() => setMode('reject')} sx={{ flex: 1 }}>
                      ❌ Reject
                    </Btn>
                  </div>
              )}

              {/* Mode: approve */}
              {mode === 'approve' && (
                  <div>
                    <div style={{
                      padding: '10px 12px', borderRadius: 8,
                      background: P.emeraldL, border: `1px solid ${P.emerald}44`,
                      fontSize: 12, color: P.emerald, marginBottom: 12,
                    }}>
                      ✅ Approving {fmtLKR(totalChargeable)} chargeable amount
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: P.muted, fontWeight: 800, marginBottom: 5, letterSpacing: 0.6 }}>
                        APPROVAL NOTES (optional)
                      </div>
                      <Textarea value={notes} onChange={setNotes} placeholder="Optional notes for the team lead…" rows={2} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn variant="ghost" onClick={() => setMode(null)} sx={{ flex: 0 }}>← Back</Btn>
                      <Btn variant="approve" onClick={handleApprove} disabled={loading} sx={{ flex: 1 }}>
                        {loading ? '⏳ Processing…' : '✅ Confirm Approval'}
                      </Btn>
                    </div>
                  </div>
              )}

              {/* Mode: adjust */}
              {mode === 'adjust' && (
                  <div>
                    <div style={{
                      padding: '10px 12px', borderRadius: 8,
                      background: P.amberL, border: `1px solid ${P.amber}44`,
                      fontSize: 12, color: P.amber, marginBottom: 12,
                    }}>
                      ✏️ Override the chargeable amount before approving
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: P.muted, fontWeight: 800, marginBottom: 5, letterSpacing: 0.6 }}>
                          ORIGINAL AMOUNT
                        </div>
                        <div style={{
                          padding: '9px 12px', borderRadius: 8, background: P.surface,
                          border: `1px solid ${P.border}`, fontSize: 13, color: P.muted,
                          fontFamily: 'IBM Plex Mono, monospace',
                        }}>
                          {fmtLKR(totalChargeable)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: P.amber, fontWeight: 800, marginBottom: 5, letterSpacing: 0.6 }}>
                          ADJUSTED AMOUNT (LKR)
                        </div>
                        <Input
                            type="number" value={adjustedAmt}
                            onChange={setAdjustedAmt}
                            placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: P.muted, fontWeight: 800, marginBottom: 5, letterSpacing: 0.6 }}>
                        REASON FOR ADJUSTMENT *
                      </div>
                      <Textarea value={notes} onChange={setNotes} placeholder="Explain why the amount was adjusted…" rows={2} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn variant="ghost" onClick={() => setMode(null)} sx={{ flex: 0 }}>← Back</Btn>
                      <Btn
                          variant="amber"
                          onClick={handleApprove}
                          disabled={loading || !adjustedAmt || !notes.trim()}
                          sx={{ flex: 1 }}
                      >
                        {loading ? '⏳ Processing…' : '✏️ Approve with Adjustment'}
                      </Btn>
                    </div>
                  </div>
              )}

              {/* Mode: reject */}
              {mode === 'reject' && (
                  <div>
                    <div style={{
                      padding: '10px 12px', borderRadius: 8,
                      background: P.roseL, border: `1px solid ${P.rose}44`,
                      fontSize: 12, color: P.rose, marginBottom: 12,
                    }}>
                      ❌ Team lead will be notified with your reason
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: P.muted, fontWeight: 800, marginBottom: 5, letterSpacing: 0.6 }}>
                        REJECTION REASON *
                      </div>
                      <Textarea
                          value={rejectReason} onChange={setRejectReason}
                          placeholder="Explain why this payment is being rejected…"
                          rows={2}
                      />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: P.muted, fontWeight: 800, marginBottom: 5, letterSpacing: 0.6 }}>
                        ADDITIONAL NOTES (optional)
                      </div>
                      <Input value={notes} onChange={setNotes} placeholder="Further context…" />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn variant="ghost" onClick={() => setMode(null)} sx={{ flex: 0 }}>← Back</Btn>
                      <Btn
                          variant="reject"
                          onClick={handleReject}
                          disabled={loading || !rejectReason.trim()}
                          sx={{ flex: 1 }}
                      >
                        {loading ? '⏳ Processing…' : '❌ Confirm Rejection'}
                      </Btn>
                    </div>
                  </div>
              )}
            </div>
        )}
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT LIST ITEM
// ═══════════════════════════════════════════════════════════════════════════════
function PaymentListItem({ payment, selected, onClick }) {
  const totalChargeable = Number(payment.totalAmount)       || 0;
  const totalFOC        = Number(payment.materialsFocTotal) || 0;
  const isPending       = payment.status === 'DRAFT';

  return (
      <div
          onClick={onClick}
          style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${P.border2}`,
            background: selected ? P.lift : 'transparent',
            cursor: 'pointer', transition: 'background 0.12s',
            borderLeft: `3px solid ${selected
                ? P.gold
                : isPending
                    ? P.gold + '44'
                    : 'transparent'}`,
            position: 'relative',
          }}
          onMouseEnter={e => { if (!selected) e.currentTarget.style.background = P.surface; }}
          onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar
                name={payment.teamLeadName}
                size={30}
                gradient={`linear-gradient(135deg, #3A2A00, ${P.gold}88)`}
            />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: P.text }}>
                {payment.teamLeadName || 'Team Lead'}
              </div>
              <div style={{ fontSize: 10, color: P.muted }}>
                #{payment.id} · {timeAgo(payment.submittedAt || payment.createdAt)}
              </div>
            </div>
          </div>
          <StatusPill status={payment.status} />
        </div>

        {/* Amount row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <div style={{
            fontSize: 16, fontWeight: 800, color: P.gold,
            fontFamily: 'Playfair Display, serif',
          }}>
            {fmtLKR(totalChargeable)}
          </div>
          {totalFOC > 0 && (
              <div style={{ fontSize: 11, color: P.emerald }}>
                + {fmtLKR(totalFOC)} FOC
              </div>
          )}
          {payment.urgency === 'URGENT' && (
              <span style={{
                marginLeft: 'auto', fontSize: 10, padding: '1px 6px',
                borderRadius: 4, background: P.roseL, color: P.rose,
                fontWeight: 800, border: `1px solid ${P.rose}44`,
              }}>URGENT</span>
          )}
        </div>

        {/* Footer row */}
        {(payment.faultNumber || payment.jobNumber) && (
            <div style={{ fontSize: 10, color: P.muted }}>
              {payment.faultNumber && `Fault #${payment.faultNumber}`}
              {payment.jobNumber && ` · Job #${payment.jobNumber}`}
            </div>
        )}

        {/* Selected indicator dot */}
        {selected && (
            <div style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              width: 6, height: 6, borderRadius: '50%', background: P.gold,
            }} />
        )}
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORY TABLE
// ═══════════════════════════════════════════════════════════════════════════════
function HistoryTab({ onToast }) {
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [fStatus,  setFStatus]  = useState('ALL');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await get('/api/payments/all');
      const list = Array.isArray(d) ? d : d?.content || [];
      setHistory(list);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = history.filter(p => {
    const q = search.toLowerCase();
    if (q && !(
        String(p.id).includes(q) ||
        p.teamLeadName?.toLowerCase().includes(q) ||
        p.paymentNumber?.toLowerCase().includes(q)
    )) return false;
    if (fStatus !== 'ALL' && p.status !== fStatus) return false;
    return true;
  });

  // Stats
  const approved = history.filter(p => p.status === 'FINAL').length;
  const rejected = history.filter(p => p.status === 'NOT_APPROVED').length;
  const totalRev  = history
      .filter(p => p.status === 'FINAL')
      .reduce((s, p) => s + (Number(p.totalAmount) || 0), 0);
  const rate = history.length > 0
      ? ((approved / history.length) * 100).toFixed(0)
      : 0;

  return (
      <div>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Payments', value: history.length, color: P.text },
            { label: 'Approved',       value: approved,       color: P.emerald },
            { label: 'Rejected',       value: rejected,       color: P.rose },
            { label: 'Approval Rate',  value: `${rate}%`,     color: P.sky },
            { label: 'Total Revenue',  value: fmtLKR(totalRev), color: P.gold },
          ].map((s, i) => (
              <div key={i} style={{
                padding: '12px 18px', borderRadius: 10,
                background: P.surface, border: `1px solid ${P.border}`,
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <div style={{
                  fontSize: 20, fontWeight: 800, color: s.color,
                  fontFamily: 'Playfair Display, serif',
                }}>{s.value}</div>
                <div style={{ fontSize: 10, color: P.muted }}>{s.label}</div>
              </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
          <span style={{
            position: 'absolute', left: 10, top: '50%',
            transform: 'translateY(-50%)', color: P.muted, fontSize: 14,
          }}>🔍</span>
            <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by ID or team lead name…"
                style={{
                  width: '100%', background: P.surface,
                  border: `1.5px solid ${P.border}`, borderRadius: 8,
                  padding: '8px 12px 8px 30px', color: P.text, fontSize: 12,
                  outline: 'none', fontFamily: 'IBM Plex Mono, monospace',
                }}
                onFocus={e => e.target.style.borderColor = P.gold}
                onBlur={e => e.target.style.borderColor = P.border}
            />
          </div>
          {['ALL', 'DRAFT', 'FINAL', 'NOT_APPROVED'].map(s => (
              <button
                  key={s}
                  onClick={() => setFStatus(s)}
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: 'none',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: fStatus === s ? P.gold : P.surface,
                    color: fStatus === s ? P.bg : P.muted,
                    transition: 'all 0.12s',
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
              >{s}</button>
          ))}
          <Btn variant="ghost" onClick={load}>🔄</Btn>
        </div>

        {/* Table */}
        <div style={{
          background: P.surface, border: `1px solid ${P.border}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
            <tr style={{ borderBottom: `2px solid ${P.border}` }}>
              {['ID', 'Team Lead', 'Fault/Job', 'Chargeable', 'FOC', 'Status', 'Submitted', 'Reviewed By'].map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 14px', textAlign: 'left', background: P.panel,
                    fontSize: 10, fontWeight: 800, color: P.muted, letterSpacing: 0.6,
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}>{h}</th>
              ))}
            </tr>
            </thead>
            <tbody>
            {loading ? (
                [...Array(6)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(8)].map((_, j) => (
                          <td key={j} style={{ padding: '12px 14px', borderBottom: `1px solid ${P.border2}` }}>
                            <Skeleton h={12} />
                          </td>
                      ))}
                    </tr>
                ))
            ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{
                    padding: '48px 24px', textAlign: 'center',
                    color: P.muted, fontSize: 13,
                  }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>💳</div>
                    No payment history found
                  </td>
                </tr>
            ) : (
                filtered.map((p, i) => (
                    <tr
                        key={p.id || i}
                        onClick={() => setSelected(selected?.id === p.id ? null : p)}
                        style={{
                          borderBottom: `1px solid ${P.border2}`,
                          cursor: 'pointer', transition: 'background 0.1s',
                          background: selected?.id === p.id ? P.lift : 'transparent',
                          animation: `pay-fadein 0.25s ease ${i * 0.02}s both`,
                        }}
                        onMouseEnter={e => { if (selected?.id !== p.id) e.currentTarget.style.background = P.surface2 || '#1A2132'; }}
                        onMouseLeave={e => { if (selected?.id !== p.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 800, color: P.gold }}>#{p.id}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Avatar name={p.teamLeadName} size={24} />
                          <span style={{ fontSize: 12, color: P.text }}>
                        {p.teamLeadName || '—'}
                      </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: P.muted }}>
                        {p.faultNumber ? `F#${p.faultNumber}` : '—'}
                        {p.jobNumber ? ` / J#${p.jobNumber}` : ''}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: P.gold }}>
                        {fmtLKR(p.totalAmount)}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: P.emerald }}>
                        {fmtLKR(p.materialsFocTotal)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <StatusPill status={p.status} />
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: P.muted }}>
                        {fmtDate(p.submittedAt || p.createdAt)}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: P.muted }}>
                        {p.approvedByName || '—'}
                      </td>
                    </tr>
                ))
            )}
            </tbody>
          </table>
        </div>

        {/* Inline detail expansion for history rows */}
        {selected && (
            <div style={{
              marginTop: 12, background: P.surface,
              border: `1px solid ${P.border}`, borderRadius: 12,
              animation: 'pay-fadein 0.22s ease',
            }}>
              <div style={{
                padding: '14px 20px', borderBottom: `1px solid ${P.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
            <span style={{
              fontSize: 13, fontWeight: 700, color: P.text,
              fontFamily: 'Playfair Display, serif',
            }}>
              Payment #{selected.id} Detail
            </span>
                <button
                    onClick={() => setSelected(null)}
                    style={{ background: 'none', border: 'none', color: P.muted, fontSize: 18, cursor: 'pointer' }}
                >×</button>
              </div>
              <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: P.muted, fontWeight: 800, marginBottom: 4 }}>REVIEWER NOTES</div>
                  <div style={{ fontSize: 12, color: P.text, lineHeight: 1.6 }}>
                    {selected.reviewerNotes || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: P.muted, fontWeight: 800, marginBottom: 4 }}>REJECTION REASON</div>
                  <div style={{ fontSize: 12, color: selected.rejectionReason ? P.rose : P.muted }}>
                    {selected.rejectionReason || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: P.muted, fontWeight: 800, marginBottom: 4 }}>REVIEWED AT</div>
                  <div style={{ fontSize: 12, color: P.text }}>{fmtDT(selected.reviewedAt)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: P.muted, fontWeight: 800, marginBottom: 4 }}>APPROVED AMOUNT</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: P.gold, fontFamily: 'Playfair Display, serif' }}>
                    {fmtLKR(selected.approvedAmount || selected.totalChargeableAmount)}
                  </div>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPUTE REVIEW PANEL — right side detail view for the Bill Dispute queue
// (SRS 5.5.2.1 / FR-32). Mirrors ReviewPanel's structure + adjust-mode form.
// ═══════════════════════════════════════════════════════════════════════════════
function DisputePanel({ payment, onAmend, onClose }) {
  const [foc,           setFoc]           = useState('');
  const [chargeable,    setChargeable]    = useState('');
  const [labour,        setLabour]        = useState('');
  const [justification, setJustification] = useState('');
  const [mode,          setMode]          = useState(null); // null | 'amend'
  const [loading,       setLoading]       = useState(false);

  // Prefill the three adjustable line items with the bill's current values,
  // mirroring ReviewPanel's adjust-mode which seeds adjustedAmt from the current value.
  useEffect(() => {
    if (payment) {
      setFoc(payment.materialsFocTotal ?? '');
      setChargeable(payment.materialsChargeableTotal ?? '');
      setLabour(payment.labourCharge ?? '');
      setJustification('');
      setMode(null);
    }
  }, [payment?.id]);

  // Photos are served from the backend's static /uploads/** route, not the /api host.
  const resolvePhotoUrl = (p) => {
    const path = typeof p === 'string' ? p : (p?.url || p?.path || '');
    if (!path) return '';
    return /^https?:\/\//i.test(path) ? path : `${API}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  if (!payment) return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100%', color: P.muted, gap: 12,
      }}>
        <div style={{ fontSize: 52 }}>⚖️</div>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Playfair Display, serif' }}>
          Select a dispute to review
        </div>
        <div style={{ fontSize: 12 }}>Click any disputed bill from the left panel</div>
      </div>
  );

  const handleAmend = async () => {
    if (!justification.trim()) return;
    setLoading(true);
    try {
      const patch = (p, b) =>
        fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8080'}${p}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
          body: JSON.stringify(b),
        }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });
      await patch(`/api/payments/${payment.id}/amend`, {
        materialsFocTotal:        foc        !== '' ? Number(foc)        : null,
        materialsChargeableTotal: chargeable !== '' ? Number(chargeable) : null,
        labourCharge:             labour     !== '' ? Number(labour)     : null,
        justification,
      });
      onAmend('Bill amended and resent to client', 'success');
    } catch { onAmend('Amendment failed', 'error'); }
    finally { setLoading(false); }
  };

  const focAmt        = Number(payment.materialsFocTotal)        || 0;
  const chargeableAmt = Number(payment.materialsChargeableTotal) || 0;
  const labourAmt     = Number(payment.labourCharge)            || 0;
  const totalAmt      = Number(payment.totalAmount)             || 0;
  const photo         = payment.disputePhotoUrl;

  return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${P.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{
                  fontSize: 13, fontWeight: 800, color: P.gold,
                  fontFamily: 'IBM Plex Mono, monospace',
                }}>
                  #{payment.id}
                </span>
                <StatusPill status={payment.status} />
              </div>
              <div style={{ fontSize: 11, color: P.muted }}>
                Disputed {timeAgo(payment.disputedAt || payment.updatedAt)}
              </div>
            </div>
            <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', color: P.muted,
                  fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
                }}
                onMouseEnter={e => e.target.style.color = P.text}
                onMouseLeave={e => e.target.style.color = P.muted}
            >×</button>
          </div>

          {/* Submitter */}
          {payment.teamLeadName && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                background: P.surface, border: `1px solid ${P.border}`,
                marginTop: 12,
              }}>
                <Avatar name={payment.teamLeadName} size={34} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: P.text }}>
                    {payment.teamLeadName}
                  </div>
                  <div style={{ fontSize: 11, color: P.muted }}>
                    Team Lead · Job #{payment.jobNumber || payment.jobId}
                  </div>
                </div>
                {payment.faultNumber && (
                    <div style={{
                      marginLeft: 'auto', padding: '4px 10px',
                      borderRadius: 6, background: P.skyL,
                      border: `1px solid ${P.sky}44`,
                      fontSize: 11, color: P.sky, fontWeight: 700,
                    }}>
                      Fault #{payment.faultNumber}
                    </div>
                )}
              </div>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>

          {/* Client's reported issue */}
          <SectionLabel>Client's Reported Issue</SectionLabel>
          <div style={{
            padding: '12px 14px', borderRadius: 8,
            background: P.amberL, border: `1px solid ${P.amber}44`,
            marginBottom: 20,
          }}>
            {payment.disputeCategory && (
                <div style={{
                  display: 'inline-block', marginBottom: payment.disputeDescription ? 8 : 0,
                  padding: '3px 10px', borderRadius: 6,
                  background: P.amber + '22', color: P.amber,
                  fontSize: 11, fontWeight: 800, letterSpacing: 0.3,
                }}>
                  {payment.disputeCategory}
                </div>
            )}
            {payment.disputeDescription && (
                <div style={{ fontSize: 13, color: P.text, lineHeight: 1.6, fontStyle: 'italic' }}>
                  "{payment.disputeDescription}"
                </div>
            )}
            {!payment.disputeCategory && !payment.disputeDescription && (
                <div style={{ fontSize: 12, color: P.muted }}>No details provided by the client.</div>
            )}
          </div>

          {/* Photo evidence */}
          {photo && (
              <>
                <SectionLabel>Photo Evidence</SectionLabel>
                <div style={{
                  width: '100%', height: 200, borderRadius: 10, overflow: 'hidden',
                  background: P.surface, border: `1px solid ${P.border}`,
                  marginBottom: 20,
                }}>
                  <img
                      src={resolvePhotoUrl(photo)}
                      alt="Dispute evidence"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; }}
                  />
                </div>
              </>
          )}

          {/* Original bill breakdown */}
          <SectionLabel>Original Bill Breakdown</SectionLabel>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <AmountChip label="Materials FOC"        value={focAmt}        color={P.emerald} />
            <AmountChip label="Materials Chargeable" value={chargeableAmt} color={P.gold} />
            <AmountChip label="Labour"               value={labourAmt}     color={P.text} />
            <AmountChip label="Total"                value={totalAmt}      color={P.text} large />
          </div>

          {/* Amendment history hint */}
          {payment.amendmentJustification && (
              <>
                <SectionLabel>Last Amendment Justification</SectionLabel>
                <div style={{
                  padding: '12px 14px', borderRadius: 8,
                  background: P.surface, border: `1px solid ${P.border}`,
                  fontSize: 12, color: P.muted, lineHeight: 1.6,
                  fontStyle: 'italic', marginBottom: 20,
                }}>
                  "{payment.amendmentJustification}"
                  {payment.amendedByName && (
                      <div style={{ marginTop: 6, fontStyle: 'normal', fontSize: 11, color: P.dim }}>
                        — {payment.amendedByName}{payment.amendedAt ? ` · ${fmtDT(payment.amendedAt)}` : ''}
                      </div>
                  )}
                </div>
              </>
          )}
        </div>

        {/* Action footer — amend & resend */}
        <div style={{
          padding: '16px 24px',
          borderTop: `1px solid ${P.border}`,
          background: P.panel,
          flexShrink: 0,
        }}>
          {!mode && (
              <Btn variant="amber" onClick={() => setMode('amend')} full>
                ✏️ Amend Bill & Resend to Client
              </Btn>
          )}

          {mode === 'amend' && (
              <div>
                <div style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: P.amberL, border: `1px solid ${P.amber}44`,
                  fontSize: 12, color: P.amber, marginBottom: 12,
                }}>
                  ✏️ Adjust the line items, then resend the amended bill to the client
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: P.muted, fontWeight: 800, marginBottom: 5, letterSpacing: 0.6 }}>
                      MATERIALS FOC (LKR)
                    </div>
                    <Input type="number" value={foc} onChange={setFoc} placeholder="0.00" />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: P.muted, fontWeight: 800, marginBottom: 5, letterSpacing: 0.6 }}>
                      MATERIALS CHARGEABLE (LKR)
                    </div>
                    <Input type="number" value={chargeable} onChange={setChargeable} placeholder="0.00" />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: P.muted, fontWeight: 800, marginBottom: 5, letterSpacing: 0.6 }}>
                      LABOUR CHARGE (LKR)
                    </div>
                    <Input type="number" value={labour} onChange={setLabour} placeholder="0.00" />
                  </div>
                </div>
                <div style={{
                  fontSize: 11, color: P.muted, marginBottom: 10,
                }}>
                  New total (chargeable + labour):{' '}
                  <span style={{ color: P.gold, fontWeight: 800 }}>
                    {fmtLKR((Number(chargeable) || 0) + (Number(labour) || 0))}
                  </span>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: P.muted, fontWeight: 800, marginBottom: 5, letterSpacing: 0.6 }}>
                    JUSTIFICATION *
                  </div>
                  <Textarea
                      value={justification} onChange={setJustification}
                      placeholder="Explain the amendment for the client and the audit trail…"
                      rows={2}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="ghost" onClick={() => setMode(null)} sx={{ flex: 0 }}>← Back</Btn>
                  <Btn
                      variant="amber"
                      onClick={handleAmend}
                      disabled={loading || !justification.trim()}
                      sx={{ flex: 1 }}
                  >
                    {loading ? '⏳ Processing…' : '📤 Resend to Client'}
                  </Btn>
                </div>
              </div>
          )}
        </div>
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPUTE QUEUE TAB — dedicated queue for Client-reported disputes (SRS 5.5.2.1)
// Live filter over /api/payments/all → status === 'DISPUTED' (mirrors HistoryTab's
// client-side filtering; no dedicated backend list endpoint).
// ═══════════════════════════════════════════════════════════════════════════════
function DisputesTab({ onToast }) {
  const [disputes, setDisputes] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [search,   setSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await get('/api/payments/all');
      const list = (Array.isArray(d) ? d : d?.content || [])
          .filter(p => p.status === 'DISPUTED');
      setDisputes(list);
      setSelected(prev => list.find(p => p.id === prev?.id) || null);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = disputes.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return String(p.id).includes(q) ||
        p.teamLeadName?.toLowerCase().includes(q) ||
        p.paymentNumber?.toLowerCase().includes(q);
  });

  // After amend: re-fetch (the amended bill is now PENDING_CLIENT_REVIEW and drops
  // out of the DISPUTED filter) and advance to the next remaining dispute.
  const handleAmend = useCallback((msg, type) => {
    onToast(msg, type);
    load().then(() => {
      setSelected(prev => {
        const next = disputes.find(p => p.id !== prev?.id && p.status === 'DISPUTED');
        return next || null;
      });
    });
  }, [load, disputes, onToast]);

  return (
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* Left panel — dispute queue */}
        <div style={{
          width: 360, flexShrink: 0,
          borderRight: `1px solid ${P.border}`,
          display: 'flex', flexDirection: 'column',
          background: P.panel, overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${P.border}`, flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 9, top: '50%',
                transform: 'translateY(-50%)', color: P.muted, fontSize: 13,
              }}>🔍</span>
              <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by ID or name…"
                  style={{
                    width: '100%', background: P.surface,
                    border: `1.5px solid ${P.border}`, borderRadius: 8,
                    padding: '7px 10px 7px 28px', color: P.text, fontSize: 11,
                    outline: 'none', fontFamily: 'IBM Plex Mono, monospace',
                  }}
                  onFocus={e => e.target.style.borderColor = P.gold}
                  onBlur={e => e.target.style.borderColor = P.border}
              />
            </div>
          </div>

          {/* Queue list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...Array(4)].map((_, i) => (
                      <div key={i} style={{
                        padding: 14, background: P.surface, borderRadius: 10,
                        border: `1px solid ${P.border}`,
                      }}>
                        <Skeleton h={12} w="60%" mb={8} />
                        <Skeleton h={18} w="45%" mb={6} />
                        <Skeleton h={10} w="80%" />
                      </div>
                  ))}
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: P.muted, fontSize: 13 }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>⚖️</div>
                  <div style={{ fontWeight: 700, fontFamily: 'Playfair Display, serif' }}>
                    No Disputes
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    No bills are currently disputed
                  </div>
                </div>
            ) : (
                filtered.map((p, i) => (
                    <div key={p.id || i} style={{ animation: `pay-fadein 0.25s ease ${i * 0.04}s both` }}>
                      <PaymentListItem
                          payment={p}
                          selected={selected?.id === p.id}
                          onClick={() => setSelected(p)}
                      />
                    </div>
                ))
            )}
          </div>

          <div style={{
            padding: '10px 16px', borderTop: `1px solid ${P.border}`,
            fontSize: 11, color: P.muted, flexShrink: 0,
          }}>
            {filtered.length} dispute{filtered.length !== 1 ? 's' : ''} in queue
          </div>
        </div>

        {/* Right panel — dispute detail + amendment form */}
        <div style={{ flex: 1, background: P.panel, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <DisputePanel
              payment={selected}
              onAmend={handleAmend}
              onClose={() => setSelected(null)}
          />
        </div>
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function PaymentsPage() {
  const [tab,      setTab]      = useState('pending');
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [toast,    setToast]    = useState(null);
  const [search,   setSearch]   = useState('');
  const [sortBy,   setSortBy]   = useState('newest');

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const d = await get('/api/payments/pending');
      const list = Array.isArray(d) ? d : d?.content || [];
      setPayments(list);
      if (list.length > 0 && !selected) setSelected(list[0]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'pending') loadPending();
  }, [tab, loadPending]);

  const sorted = [...payments]
      .filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        return String(p.id).includes(q) ||
            p.teamLeadName?.toLowerCase().includes(q) ||
            p.paymentNumber?.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sortBy === 'newest')  return new Date(b.createdAt) - new Date(a.createdAt);
        if (sortBy === 'oldest')  return new Date(a.createdAt) - new Date(b.createdAt);
        if (sortBy === 'highest') return (b.totalChargeableAmount||0) - (a.totalChargeableAmount||0);
        if (sortBy === 'urgent')  return (b.urgency==='URGENT'?1:0) - (a.urgency==='URGENT'?1:0);
        return 0;
      });

  // After approve/reject: reload and advance to next
  const handleAction = useCallback((msg, type) => {
    showToast(msg, type);
    loadPending().then(() => {
      setSelected(prev => {
        const next = payments.find(p => p.id !== prev?.id && p.status === 'DRAFT');
        return next || null;
      });
    });
  }, [loadPending, payments, showToast]);

  // Inject CSS
  useEffect(() => {
    const id = 'pay-page-css';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
      @keyframes pay-shimmer  { 0%{background-position:200% 0}100%{background-position:-200% 0} }
      @keyframes pay-fadein   { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
      @keyframes pay-toastin  { from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none} }
      .pay-page * { box-sizing:border-box; font-family:'IBM Plex Mono',monospace; }
      ::-webkit-scrollbar{width:4px;height:4px}
      ::-webkit-scrollbar-track{background:${P.bg}}
      ::-webkit-scrollbar-thumb{background:${P.border};border-radius:4px}
    `;
    document.head.appendChild(s);
  }, []);

  const pendingCount = payments.length;

  return (
      <div className="pay-page" style={{
        background: P.bg, minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ── Top header ─────────────────────────────────────────────────── */}
        <div style={{
          padding: '20px 28px 0',
          borderBottom: `1px solid ${P.border}`,
          background: P.panel,
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: 16,
          }}>
            <div>
              <h1 style={{
                margin: 0, fontSize: 22, fontWeight: 800, color: P.text,
                fontFamily: 'Playfair Display, serif', letterSpacing: -0.3,
              }}>
                Payment Review
              </h1>
              <div style={{ fontSize: 11, color: P.muted, marginTop: 3 }}>
                {pendingCount} pending · Review, approve or reject field payment submissions
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={loadPending}>🔄 Refresh</Btn>
              {pendingCount > 0 && (
                  <div style={{
                    padding: '8px 16px', borderRadius: 8,
                    background: P.goldL, border: `1px solid ${P.gold}44`,
                    fontSize: 12, fontWeight: 800, color: P.gold,
                  }}>
                    ⏳ {pendingCount} pending
                  </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {[
              { id: 'pending',  label: `⏳ Pending Review (${pendingCount})` },
              { id: 'disputes', label: '⚖️ Bill Disputes' },
              { id: 'history',  label: '📋 Payment History' },
            ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding: '10px 20px', border: 'none', cursor: 'pointer',
                  background: 'none', fontSize: 12, fontWeight: 700,
                  color: tab === t.id ? P.gold : P.muted,
                  borderBottom: `2px solid ${tab === t.id ? P.gold : 'transparent'}`,
                  marginBottom: -1, transition: 'all 0.13s',
                  fontFamily: 'IBM Plex Mono, monospace',
                }}>
                  {t.label}
                </button>
            ))}
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        {tab === 'history' ? (
            <div style={{ padding: '24px 28px', flex: 1, overflowY: 'auto' }}>
              <HistoryTab onToast={showToast} />
            </div>
        ) : tab === 'disputes' ? (
            <DisputesTab onToast={showToast} />
        ) : (
            /* ── Split panel layout ──────────────────────────────────────── */
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

              {/* Left panel — queue */}
              <div style={{
                width: 360, flexShrink: 0,
                borderRight: `1px solid ${P.border}`,
                display: 'flex', flexDirection: 'column',
                background: P.panel, overflow: 'hidden',
              }}>
                {/* Queue toolbar */}
                <div style={{
                  padding: '14px 16px',
                  borderBottom: `1px solid ${P.border}`,
                  flexShrink: 0,
                }}>
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                <span style={{
                  position: 'absolute', left: 9, top: '50%',
                  transform: 'translateY(-50%)', color: P.muted, fontSize: 13,
                }}>🔍</span>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by ID or name…"
                        style={{
                          width: '100%', background: P.surface,
                          border: `1.5px solid ${P.border}`, borderRadius: 8,
                          padding: '7px 10px 7px 28px', color: P.text, fontSize: 11,
                          outline: 'none', fontFamily: 'IBM Plex Mono, monospace',
                        }}
                        onFocus={e => e.target.style.borderColor = P.gold}
                        onBlur={e => e.target.style.borderColor = P.border}
                    />
                  </div>
                  <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                      style={{
                        width: '100%', background: P.surface,
                        border: `1.5px solid ${P.border}`, borderRadius: 8,
                        padding: '7px 10px', color: P.text, fontSize: 11,
                        outline: 'none', cursor: 'pointer',
                        fontFamily: 'IBM Plex Mono, monospace',
                      }}
                  >
                    <option value="newest">Sort: Newest First</option>
                    <option value="oldest">Sort: Oldest First</option>
                    <option value="highest">Sort: Highest Amount</option>
                    <option value="urgent">Sort: Urgent First</option>
                  </select>
                </div>

                {/* Queue list */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {loading ? (
                      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[...Array(4)].map((_, i) => (
                            <div key={i} style={{
                              padding: 14, background: P.surface, borderRadius: 10,
                              border: `1px solid ${P.border}`,
                            }}>
                              <Skeleton h={12} w="60%" mb={8} />
                              <Skeleton h={18} w="45%" mb={6} />
                              <Skeleton h={10} w="80%" />
                            </div>
                        ))}
                      </div>
                  ) : sorted.length === 0 ? (
                      <div style={{
                        padding: 40, textAlign: 'center',
                        color: P.muted, fontSize: 13,
                      }}>
                        <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                        <div style={{ fontWeight: 700, fontFamily: 'Playfair Display, serif' }}>
                          Queue Empty
                        </div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          All payments reviewed
                        </div>
                      </div>
                  ) : (
                      sorted.map((p, i) => (
                          <div
                              key={p.id || i}
                              style={{ animation: `pay-fadein 0.25s ease ${i * 0.04}s both` }}
                          >
                            <PaymentListItem
                                payment={p}
                                selected={selected?.id === p.id}
                                onClick={() => setSelected(p)}
                            />
                          </div>
                      ))
                  )}
                </div>

                {/* Queue footer */}
                <div style={{
                  padding: '10px 16px', borderTop: `1px solid ${P.border}`,
                  fontSize: 11, color: P.muted, flexShrink: 0,
                }}>
                  {sorted.length} payment{sorted.length !== 1 ? 's' : ''} in queue
                </div>
              </div>

              {/* Right panel — detail */}
              <div style={{ flex: 1, background: P.panel, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <ReviewPanel
                    payment={selected}
                    onApprove={handleAction}
                    onReject={handleAction}
                    onClose={() => setSelected(null)}
                />
              </div>
            </div>
        )}

        {/* Toast */}
        {toast && (
            <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />
        )}
      </div>
  );
}