import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── API ──────────────────────────────────────────────────────────────────────
const API   = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const token = () => localStorage.getItem('accessToken');
const req   = (method, path, body) =>
    fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
      body: body ? JSON.stringify(body) : undefined,
    }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });
const get  = p     => req('GET',  p);
const post = (p,b) => req('POST', p, b);
const put  = (p,b) => req('PUT',  p, b);

// ─── Design tokens — warm industrial palette ──────────────────────────────────
const T = {
  bg:       '#F7F4EF',
  bg2:      '#EDE9E2',
  surface:  '#FFFFFF',
  border:   '#D5CFC5',
  border2:  '#E8E3DB',
  text:     '#1C1A17',
  muted:    '#7C7568',
  accent:   '#C8501A',        // terracotta
  accentL:  '#F0E0D6',
  navy:     '#1E3A5F',
  navyL:    '#D8E4F0',
  green:    '#2A6B3C',
  greenL:   '#D4EAD9',
  orange:   '#C47B0C',
  orangeL:  '#FBF0D6',
  red:      '#C0392B',
  redL:     '#F9DDD9',
  white:    '#FFFFFF',
  black:    '#1C1A17',
};

// ─── Stock status config ──────────────────────────────────────────────────────
const STOCK_STATUS = {
  IN_STOCK:    { label:'In Stock',    bg:T.greenL,  color:T.green,  border:'#86CAAC' },
  LOW_STOCK:   { label:'Low Stock',   bg:T.orangeL, color:T.orange, border:'#E2B55C' },
  CRITICAL:    { label:'Critical',    bg:T.redL,    color:T.red,    border:'#E09090' },
  OUT_OF_STOCK:{ label:'Out of Stock',bg:T.redL,    color:T.red,    border:'#E09090' },
};

const VEH_STATUS = {
  AVAILABLE: { label:'Available', bg:T.greenL,  color:T.green  },
  IN_USE:    { label:'In Use',    bg:T.navyL,   color:T.navy   },
  MAINTENANCE:{ label:'Service',  bg:T.orangeL, color:T.orange },
  INACTIVE:  { label:'Inactive',  bg:T.bg2,     color:T.muted  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt     = d => d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtLKR  = v => v != null ? `LKR ${Number(v).toLocaleString('en-LK',{minimumFractionDigits:2})}` : '—';
const timeAgo = d => {
  if (!d) return '—';
  const s = Math.floor((Date.now()-new Date(d))/1000);
  if (s<60) return `${s}s ago`;
  if (s<3600) return `${Math.floor(s/60)}m ago`;
  if (s<86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED MICRO-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const Badge = ({ label, bg, color, border }) => (
    <span style={{
      display:'inline-flex', alignItems:'center', padding:'3px 9px',
      borderRadius:20, fontSize:11, fontWeight:700,
      background:bg, color, border:`1px solid ${border||color+'44'}`,
      letterSpacing:0.3, whiteSpace:'nowrap',
    }}>{label}</span>
);

const Skeleton = ({ h=14, w='100%', r=6 }) => (
    <div style={{
      height:h, width:w, borderRadius:r,
      background:`linear-gradient(90deg,${T.bg2} 25%,${T.border} 50%,${T.bg2} 75%)`,
      backgroundSize:'400% 100%', animation:'inv-shimmer 1.4s ease infinite',
    }} />
);

const StockBar = ({ current, max, status }) => {
  const pct   = max > 0 ? Math.min((current/max)*100, 100) : 0;
  const color = status==='IN_STOCK' ? T.green
      : status==='LOW_STOCK' ? T.orange
          : T.red;
  return (
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ flex:1, height:6, background:T.bg2, borderRadius:4, overflow:'hidden', minWidth:60 }}>
          <div style={{
            height:'100%', width:`${pct}%`, borderRadius:4,
            background:color, transition:'width 0.6s ease',
          }} />
        </div>
        <span style={{ fontSize:11, fontWeight:700, color, minWidth:28, textAlign:'right' }}>
        {current}
      </span>
      </div>
  );
};

const Toast = ({ msg, type, onDone }) => {
  useEffect(() => { const t=setTimeout(onDone,3200); return ()=>clearTimeout(t); },[onDone]);
  const col = type==='success' ? T.green : type==='error' ? T.red : T.orange;
  return (
      <div style={{
        position:'fixed', bottom:28, right:28, zIndex:2000,
        background:T.surface, border:`2px solid ${col}`,
        borderRadius:12, padding:'12px 20px', fontSize:13,
        color:T.text, boxShadow:`0 8px 32px rgba(0,0,0,0.15)`,
        display:'flex', alignItems:'center', gap:10, maxWidth:380,
        animation:'inv-toastin 0.22s ease', fontFamily:'Fraunces,serif',
      }}>
      <span style={{ fontSize:18 }}>
        {type==='success'?'✅':type==='error'?'❌':'⚠️'}
      </span>
        {msg}
      </div>
  );
};

const Modal = ({ open, onClose, title, subtitle, width=640, children }) => {
  useEffect(() => {
    const fn = e => e.key==='Escape' && onClose();
    if (open) document.addEventListener('keydown',fn);
    return () => document.removeEventListener('keydown',fn);
  },[open,onClose]);
  if (!open) return null;
  return (
      <div
          onClick={e=>e.target===e.currentTarget&&onClose()}
          style={{
            position:'fixed',inset:0,zIndex:1000,
            background:'rgba(28,26,23,0.7)', backdropFilter:'blur(3px)',
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:24, animation:'inv-fadein 0.18s ease',
          }}
      >
        <div style={{
          background:T.surface, borderRadius:16, width:'100%', maxWidth:width,
          maxHeight:'90vh', display:'flex', flexDirection:'column',
          boxShadow:'0 24px 64px rgba(0,0,0,0.22)',
          border:`1px solid ${T.border}`,
          animation:'inv-slidein 0.2s ease',
        }}>
          <div style={{
            padding:'20px 24px 16px', borderBottom:`1px solid ${T.border}`,
            display:'flex', alignItems:'flex-start', justifyContent:'space-between',
            flexShrink:0,
          }}>
            <div>
              <div style={{ fontWeight:800, fontSize:17, color:T.text, fontFamily:'Fraunces,serif' }}>
                {title}
              </div>
              {subtitle && <div style={{ fontSize:12, color:T.muted, marginTop:3 }}>{subtitle}</div>}
            </div>
            <button
                onClick={onClose}
                style={{
                  background:'none',border:'none',color:T.muted,fontSize:22,
                  cursor:'pointer', lineHeight:1, padding:'0 4px', transition:'color 0.12s',
                }}
                onMouseEnter={e=>e.target.style.color=T.text}
                onMouseLeave={e=>e.target.style.color=T.muted}
            >×</button>
          </div>
          <div style={{ overflowY:'auto', flex:1 }}>{children}</div>
        </div>
      </div>
  );
};

const Btn = ({ children, variant='outline', onClick, disabled=false, style:sx={} }) => {
  const [hov, setHov] = useState(false);
  const map = {
    primary:{ bg:T.accent,  hov:'#A83E13', color:T.white, border:T.accent },
    navy:   { bg:T.navy,    hov:'#162D4A', color:T.white, border:T.navy  },
    outline:{ bg:'transparent', hov:T.bg2, color:T.text,  border:T.border },
    danger: { bg:T.redL,    hov:'#F0CECA', color:T.red,   border:T.red   },
    success:{ bg:T.greenL,  hov:'#BFE0C9', color:T.green, border:T.green },
    warning:{ bg:T.orangeL, hov:'#F5E0AB', color:T.orange,border:T.orange},
  };
  const v = map[variant]||map.outline;
  return (
      <button
          onClick={onClick} disabled={disabled}
          onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
          style={{
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:700,
            cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.5:1,
            background:hov?v.hov:v.bg, border:`1.5px solid ${v.border}`,
            color:v.color, transition:'all 0.13s', whiteSpace:'nowrap',
            fontFamily:'Fraunces,serif', letterSpacing:0.2, ...sx,
          }}
      >{children}</button>
  );
};

const Field = ({ label, children }) => (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <label style={{ fontSize:11, fontWeight:800, color:T.muted, letterSpacing:0.6, textTransform:'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
);

const TextInput = ({ value, onChange, placeholder, type='text', style:sx={} }) => (
    <input
        type={type} value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background:T.bg, border:`1.5px solid ${T.border}`, borderRadius:8,
          padding:'9px 12px', fontSize:13, color:T.text, outline:'none',
          fontFamily:'Fraunces,serif', transition:'border-color 0.13s', ...sx,
        }}
        onFocus={e=>e.target.style.borderColor=T.accent}
        onBlur={e=>e.target.style.borderColor=T.border}
    />
);

const SelectInput = ({ value, onChange, children, style:sx={} }) => (
    <select
        value={value} onChange={e=>onChange(e.target.value)}
        style={{
          background:T.bg, border:`1.5px solid ${T.border}`, borderRadius:8,
          padding:'9px 12px', fontSize:13, color:T.text, outline:'none',
          cursor:'pointer', fontFamily:'Fraunces,serif', transition:'border-color 0.13s', ...sx,
        }}
        onFocus={e=>e.target.style.borderColor=T.accent}
        onBlur={e=>e.target.style.borderColor=T.border}
    >{children}</select>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ADJUST STOCK MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function AdjustStockModal({ material, open, onClose, onSuccess }) {
  const [qty,   setQty]   = useState('');
  const [type,  setType]  = useState('RESTOCK');
  const [reason,setReason]= useState('');
  const [loading,setLoading]=useState(false);

  useEffect(()=>{ if(open){ setQty(''); setType('RESTOCK'); setReason(''); } },[open]);

  const submit = async () => {
    if (!qty || !reason.trim()) return;
    setLoading(true);
    try {
      const change = type==='RESTOCK'||type==='RETURN'||type==='INITIAL_STOCK'
          ? Math.abs(Number(qty))
          : -Math.abs(Number(qty));
      await post('/api/inventory/stock/adjust', {
        materialId: material.materialId,
        quantityChange: change,
        transactionType: type,
        reason: reason,
        reference: `ADJ-${Date.now()}`,
      });
      onSuccess(`Stock adjusted: ${change>0?'+':''}${change} units`, 'success');
      onClose();
    } catch(e) { onSuccess('Stock adjustment failed','error'); }
    finally { setLoading(false); }
  };

  const isAdd = ['RESTOCK','RETURN','INITIAL_STOCK'].includes(type);

  return (
      <Modal open={open} onClose={onClose} width={480}
             title="Adjust Stock"
             subtitle={material ? `${material.materialName} · SKU: ${material.sku}` : ''}
      >
        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>
          {material && (
              <div style={{
                display:'grid', gridTemplateColumns:'1fr 1fr', gap:10,
                background:T.bg, borderRadius:10, padding:14,
                border:`1px solid ${T.border}`,
              }}>
                <div>
                  <div style={{ fontSize:10, color:T.muted, fontWeight:700, marginBottom:3 }}>CURRENT STOCK</div>
                  <div style={{ fontSize:22, fontWeight:800, color:T.text, fontFamily:'Fraunces,serif' }}>
                    {material.currentStock}
                    <span style={{ fontSize:12, color:T.muted, marginLeft:4 }}>{material.unit}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:10, color:T.muted, fontWeight:700, marginBottom:3 }}>UNIT PRICE</div>
                  <div style={{ fontSize:14, fontWeight:700, color:T.navy, fontFamily:'Fraunces,serif' }}>
                    {fmtLKR(material.unitPrice)}
                  </div>
                </div>
              </div>
          )}

          <Field label="Transaction Type">
            <SelectInput value={type} onChange={setType}>
              <option value="RESTOCK">📦 Restock — Add inventory</option>
              <option value="MANUAL_ADJUSTMENT">✏️ Manual Adjustment</option>
              <option value="DAMAGE">💥 Damage / Lost</option>
              <option value="RETURN">↩️ Return to Stock</option>
              <option value="INITIAL_STOCK">🆕 Initial Stock Entry</option>
            </SelectInput>
          </Field>

          <Field label={`Quantity${isAdd ? ' to Add' : ' to Remove'}`}>
            <div style={{ position:'relative' }}>
            <span style={{
              position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
              fontSize:16, fontWeight:800,
              color: isAdd ? T.green : T.red,
            }}>
              {isAdd ? '+' : '−'}
            </span>
              <TextInput
                  type="number" value={qty} onChange={setQty}
                  placeholder="0"
                  style={{ paddingLeft:28 }}
              />
            </div>
            {qty && material && (
                <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>
                  New stock will be: <b style={{ color: isAdd ? T.green : T.red }}>
                  {Math.max(0, (material.currentStock||0) + (isAdd?+qty:-qty))} {material.unit}
                </b>
                </div>
            )}
          </Field>

          <Field label="Reason *">
            <TextInput value={reason} onChange={setReason} placeholder="Describe reason for adjustment…" />
          </Field>

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', paddingTop:4 }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn
                variant={isAdd ? 'success' : 'danger'}
                onClick={submit}
                disabled={!qty || !reason.trim() || loading}
            >
              {loading ? '⏳ Saving…' : `${isAdd?'➕ Add':'➖ Remove'} Stock`}
            </Btn>
          </div>
        </div>
      </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD / EDIT MATERIAL MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function MaterialFormModal({ material, open, onClose, onSuccess }) {
  const isEdit = !!material;
  const [form, setForm] = useState({
    name:'', sku:'', category:'GENERAL', unit:'pcs',
    unitPrice:'', isFoc:false, stockQuantity:'',
    minThreshold:'10', maxThreshold:'500', reorderQuantity:'50',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(isEdit ? {
        name: material.materialName || '',
        sku: material.sku || '',
        category: material.category || 'GENERAL',
        unit: material.unit || 'pcs',
        unitPrice: material.unitPrice || '',
        isFoc: material.isFOC || false,
        stockQuantity: material.currentStock || '',
        minThreshold: material.minThreshold || '10',
        maxThreshold: material.maxThreshold || '500',
        reorderQuantity: material.reorderQuantity || '50',
      } : {
        name:'', sku:'', category:'GENERAL', unit:'pcs',
        unitPrice:'', isFoc:false, stockQuantity:'',
        minThreshold:'10', maxThreshold:'500', reorderQuantity:'50',
      });
    }
  }, [open, material]);

  const f = (key) => (v) => setForm(p => ({ ...p, [key]:v }));

  const submit = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const body = {
        name: form.name, sku: form.sku,
        category: { name: form.category },
        unit: form.unit,
        unitPrice: Number(form.unitPrice) || 0,
        isFoc: form.isFoc,
        stockQuantity: Number(form.stockQuantity) || 0,
        minThreshold: Number(form.minThreshold) || 10,
        maxThreshold: Number(form.maxThreshold) || 500,
        reorderQuantity: Number(form.reorderQuantity) || 50,
        isActive: true,
      };
      if (isEdit) {
        await put(`/api/inventory/materials/${material.materialId}`, body);
        onSuccess('Material updated successfully', 'success');
      } else {
        await post('/api/inventory/materials', body);
        onSuccess('Material added successfully', 'success');
      }
      onClose();
    } catch(e) { onSuccess(isEdit ? 'Update failed' : 'Add failed', 'error'); }
    finally { setLoading(false); }
  };

  return (
      <Modal open={open} onClose={onClose} width={580}
             title={isEdit ? 'Edit Material' : 'Add New Material'}
             subtitle={isEdit ? `SKU: ${material?.sku}` : 'Add a new item to inventory'}
      >
        <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Field label="Material Name *">
            <TextInput value={form.name} onChange={f('name')} placeholder="e.g. CAT6 Cable" style={{ gridColumn:'1/-1' }} />
          </Field>
          <Field label="SKU">
            <TextInput value={form.sku} onChange={f('sku')} placeholder="Auto-generated if blank" />
          </Field>
          <Field label="Category">
            <SelectInput value={form.category} onChange={f('category')}>
              {['GENERAL','CABLES','CONNECTORS','TOOLS','FIBER','BROADBAND','TELEPHONE','TELEVISION'].map(c=>(
                  <option key={c} value={c}>{c}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Unit">
            <SelectInput value={form.unit} onChange={f('unit')}>
              {['pcs','m','kg','l','box','roll','set','pair'].map(u=>(
                  <option key={u} value={u}>{u}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Unit Price (LKR)">
            <TextInput type="number" value={form.unitPrice} onChange={f('unitPrice')} placeholder="0.00" />
          </Field>
          <Field label="Initial Stock Qty">
            <TextInput type="number" value={form.stockQuantity} onChange={f('stockQuantity')} placeholder="0" />
          </Field>
          <Field label="Min Threshold">
            <TextInput type="number" value={form.minThreshold} onChange={f('minThreshold')} placeholder="10" />
          </Field>
          <Field label="Reorder Qty">
            <TextInput type="number" value={form.reorderQuantity} onChange={f('reorderQuantity')} placeholder="50" />
          </Field>

          {/* FOC toggle full width */}
          <div style={{
            gridColumn:'1/-1', display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'12px 16px', borderRadius:10, background:T.bg,
            border:`1.5px solid ${form.isFoc ? T.green : T.border}`,
            cursor:'pointer', transition:'border-color 0.15s',
          }} onClick={()=>setForm(p=>({...p,isFoc:!p.isFoc}))}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:T.text }}>Free of Charge (FOC)</div>
              <div style={{ fontSize:11, color:T.muted }}>Material is provided at no cost to the customer</div>
            </div>
            {/* Toggle switch */}
            <div style={{
              width:42, height:24, borderRadius:12, position:'relative',
              background: form.isFoc ? T.green : T.border,
              transition:'background 0.2s', flexShrink:0,
            }}>
              <div style={{
                position:'absolute', top:3, left: form.isFoc ? 21 : 3,
                width:18, height:18, borderRadius:'50%', background:T.white,
                transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)',
              }} />
            </div>
          </div>

          <div style={{ gridColumn:'1/-1', display:'flex', gap:10, justifyContent:'flex-end', paddingTop:4 }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={submit} disabled={!form.name.trim() || loading}>
              {loading ? '⏳ Saving…' : isEdit ? '💾 Save Changes' : '➕ Add Material'}
            </Btn>
          </div>
        </div>
      </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIAL REQUEST APPROVAL MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function RequestApprovalModal({ request, open, onClose, onSuccess }) {
  const [notes,   setNotes]   = useState('');
  const [reason,  setReason]  = useState('');
  const [action,  setAction]  = useState(null); // 'approve' | 'reject'
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ if(open){ setNotes(''); setReason(''); setAction(null); } },[open]);

  const submit = async () => {
    setLoading(true);
    try {
      if (action === 'approve') {
        await post(`/api/inventory/material-requests/${request.id}/approve`, {
          notes, notifyRequester: true,
        });
        onSuccess('Request approved — stock deducted', 'success');
      } else {
        await post(`/api/inventory/material-requests/${request.id}/reject`, {
          reason, notes, notifyRequester: true,
        });
        onSuccess('Request rejected', 'warning');
      }
      onClose();
    } catch(e) { onSuccess('Action failed','error'); }
    finally { setLoading(false); }
  };

  if (!request) return null;

  return (
      <Modal open={open} onClose={onClose} width={620}
             title={`Review Request ${request.requestNumber}`}
             subtitle={`From ${request.requesterName} · ${timeAgo(request.submittedAt)}`}
      >
        <div style={{ padding:'20px 24px' }}>

          {/* Requester info */}
          <div style={{
            display:'flex', alignItems:'center', gap:12, marginBottom:16,
            padding:14, background:T.bg, borderRadius:10, border:`1px solid ${T.border}`,
          }}>
            <div style={{
              width:40, height:40, borderRadius:'50%', flexShrink:0,
              background:`linear-gradient(135deg, ${T.navy}, #2E6BAD)`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:16, fontWeight:800, color:T.white, fontFamily:'Fraunces,serif',
            }}>
              {request.requesterName?.charAt(0)||'?'}
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{request.requesterName}</div>
              <div style={{ fontSize:12, color:T.muted }}>{request.requesterRole} · {request.requesterPhone}</div>
            </div>
            {request.urgency === 'URGENT' && (
                <span style={{
                  marginLeft:'auto', padding:'4px 10px', borderRadius:20,
                  background:T.redL, color:T.red, border:`1px solid ${T.red}44`,
                  fontSize:11, fontWeight:800,
                }}>🔴 URGENT</span>
            )}
          </div>

          {/* Items table */}
          <div style={{ fontSize:12, fontWeight:800, color:T.muted, letterSpacing:0.6, textTransform:'uppercase', marginBottom:8 }}>
            Requested Items
          </div>
          <div style={{
            border:`1px solid ${T.border}`, borderRadius:10, overflow:'hidden', marginBottom:16,
          }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
              <tr style={{ background:T.bg2 }}>
                {['Material','SKU','Qty','Unit Price','Subtotal','Stock'].map((h,i)=>(
                    <th key={i} style={{
                      padding:'8px 12px', textAlign:'left', fontSize:10,
                      fontWeight:800, color:T.muted, letterSpacing:0.5,
                      borderBottom:`1px solid ${T.border}`,
                    }}>{h}</th>
                ))}
              </tr>
              </thead>
              <tbody>
              {(request.items||[]).map((item,i)=>(
                  <tr key={i} style={{ borderBottom:i<(request.items.length-1)?`1px solid ${T.border2}`:'none' }}>
                    <td style={{ padding:'10px 12px', fontSize:13, fontWeight:600, color:T.text }}>
                      {item.materialName}
                      {item.isFOC && (
                          <span style={{ marginLeft:6, fontSize:10, padding:'1px 5px', borderRadius:4, background:T.greenL, color:T.green }}>FOC</span>
                      )}
                    </td>
                    <td style={{ padding:'10px 12px', fontSize:11, color:T.muted }}>{item.sku||'—'}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontWeight:700, color:T.navy }}>{item.requestedQuantity}</td>
                    <td style={{ padding:'10px 12px', fontSize:12, color:T.muted }}>{fmtLKR(item.unitPrice)}</td>
                    <td style={{ padding:'10px 12px', fontSize:12, fontWeight:700, color:T.text }}>{fmtLKR(item.subtotal)}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <div style={{
                          width:8, height:8, borderRadius:'50%',
                          background: (item.availableStock||0)>=item.requestedQuantity ? T.green : T.red,
                        }} />
                        <span style={{ fontSize:11, color:T.muted }}>{item.availableStock||0}</span>
                      </div>
                    </td>
                  </tr>
              ))}
              </tbody>
            </table>
            <div style={{
              padding:'10px 12px', background:T.bg, borderTop:`1px solid ${T.border}`,
              display:'flex', justifyContent:'space-between', alignItems:'center',
            }}>
            <span style={{ fontSize:12, color:T.muted }}>
              {request.totalItems} items · {request.totalQuantity} units
            </span>
              <span style={{ fontSize:14, fontWeight:800, color:T.text, fontFamily:'Fraunces,serif' }}>
              Est. {fmtLKR(request.totalEstimatedCost)}
            </span>
            </div>
          </div>

          {/* Requester notes */}
          {request.requesterNotes && (
              <div style={{
                padding:12, background:T.bg, borderRadius:8, border:`1px solid ${T.border}`,
                marginBottom:16, fontSize:12, color:T.muted,
              }}>
                <b style={{ color:T.text }}>Note: </b>{request.requesterNotes}
              </div>
          )}

          {/* Action choice */}
          {!action ? (
              <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:4 }}>
                <Btn variant="success" onClick={()=>setAction('approve')} style={{ flex:1, justifyContent:'center', padding:'10px' }}>
                  ✅ Approve Request
                </Btn>
                <Btn variant="danger" onClick={()=>setAction('reject')} style={{ flex:1, justifyContent:'center', padding:'10px' }}>
                  ❌ Reject Request
                </Btn>
              </div>
          ) : (
              <div style={{
                padding:14, borderRadius:10,
                background: action==='approve' ? T.greenL : T.redL,
                border:`1px solid ${action==='approve' ? T.green : T.red}44`,
              }}>
                <div style={{ fontSize:13, fontWeight:700, color:action==='approve'?T.green:T.red, marginBottom:12 }}>
                  {action==='approve' ? '✅ Approving this request' : '❌ Rejecting this request'}
                </div>
                {action === 'reject' && (
                    <div style={{ marginBottom:12 }}>
                      <label style={{ fontSize:11, fontWeight:800, color:T.muted, display:'block', marginBottom:5 }}>
                        REJECTION REASON *
                      </label>
                      <TextInput value={reason} onChange={setReason} placeholder="Why is this being rejected?" style={{ width:'100%' }} />
                    </div>
                )}
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, fontWeight:800, color:T.muted, display:'block', marginBottom:5 }}>
                    ADMIN NOTES (optional)
                  </label>
                  <TextInput value={notes} onChange={setNotes} placeholder="Additional notes…" style={{ width:'100%' }} />
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <Btn variant="outline" onClick={()=>setAction(null)}>← Back</Btn>
                  <Btn
                      variant={action==='approve'?'success':'danger'}
                      onClick={submit}
                      disabled={(action==='reject'&&!reason.trim())||loading}
                      style={{ flex:1, justifyContent:'center' }}
                  >
                    {loading ? '⏳ Processing…' : action==='approve' ? '✅ Confirm Approval' : '❌ Confirm Rejection'}
                  </Btn>
                </div>
              </div>
          )}
        </div>
      </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIALS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function MaterialsTab({ onToast }) {
  const [levels,   setLevels]   = useState([]);
  const [alerts,   setAlerts]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [fStatus,  setFStatus]  = useState('ALL');
  const [fFoc,     setFFoc]     = useState('ALL');
  const [adjMat,   setAdjMat]   = useState(null);
  const [editMat,  setEditMat]  = useState(null);
  const [addOpen,  setAddOpen]  = useState(false);
  const [viewMode, setViewMode] = useState('list'); // list | grid
  const [showAlertsPanel, setShowAlertsPanel] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, a] = await Promise.all([
        get('/api/inventory/stock/levels'),
        get('/api/inventory/stock/low-stock-alerts'),
      ]);
      setLevels(Array.isArray(l) ? l : []);
      setAlerts(a);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(()=>{ load(); },[load]);

  const filtered = levels.filter(m => {
    const q = search.toLowerCase();
    if (q && !(
        m.materialName?.toLowerCase().includes(q) ||
        m.sku?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q)
    )) return false;
    if (fStatus !== 'ALL' && m.stockStatus !== fStatus) return false;
    if (fFoc === 'FOC' && !m.isFOC) return false;
    if (fFoc === 'CHARGEABLE' && m.isFOC) return false;
    return true;
  });

  return (
      <div>
        {/* Low stock alerts banner */}
        {alerts && alerts.totalAlerts > 0 && showAlertsPanel && (
            <div style={{
              background:T.redL, border:`2px solid ${T.red}55`,
              borderRadius:12, padding:'14px 18px', marginBottom:20,
              animation:'inv-fadein 0.3s ease',
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:20 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize:14, fontWeight:800, color:T.red, fontFamily:'Fraunces,serif' }}>
                      {alerts.totalAlerts} Low Stock Alert{alerts.totalAlerts!==1?'s':''}
                    </div>
                    <div style={{ fontSize:12, color:T.muted }}>
                      {alerts.outOfStockCount} out of stock · {alerts.criticalCount} critical · {alerts.warningCount} warning
                      &nbsp;·&nbsp; Estimated reorder cost: <b>{fmtLKR(alerts.totalReorderCost)}</b>
                    </div>
                  </div>
                </div>
                <button
                    onClick={()=>setShowAlertsPanel(false)}
                    style={{ background:'none',border:'none',cursor:'pointer',color:T.muted,fontSize:18 }}
                >×</button>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {(alerts.alerts||[]).slice(0,6).map((a,i)=>(
                    <div key={i} style={{
                      padding:'6px 12px', borderRadius:8,
                      background:T.surface, border:`1px solid ${T.red}44`,
                      fontSize:11, display:'flex', alignItems:'center', gap:6,
                    }}>
                      <span>{a.alertIcon}</span>
                      <span style={{ fontWeight:700, color:T.text }}>{a.materialName}</span>
                      <span style={{ color:a.alertColor, fontWeight:700 }}>{a.currentStock} left</span>
                    </div>
                ))}
                {alerts.alerts?.length > 6 && (
                    <div style={{
                      padding:'6px 12px', borderRadius:8,
                      background:T.bg2, border:`1px solid ${T.border}`,
                      fontSize:11, color:T.muted,
                    }}>
                      +{alerts.alerts.length-6} more
                    </div>
                )}
              </div>
            </div>
        )}

        {/* Toolbar */}
        <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:1, minWidth:200 }}>
            <span style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:T.muted,fontSize:14 }}>🔍</span>
            <input
                value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search materials by name, SKU, category…"
                style={{
                  width:'100%', background:T.surface, border:`1.5px solid ${T.border}`,
                  borderRadius:8, padding:'9px 12px 9px 30px',
                  color:T.text, fontSize:12, outline:'none', fontFamily:'Fraunces,serif',
                }}
                onFocus={e=>e.target.style.borderColor=T.accent}
                onBlur={e=>e.target.style.borderColor=T.border}
            />
          </div>
          <SelectInput value={fStatus} onChange={setFStatus} style={{ minWidth:130 }}>
            <option value="ALL">All Status</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="CRITICAL">Critical</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </SelectInput>
          <SelectInput value={fFoc} onChange={setFFoc} style={{ minWidth:140 }}>
            <option value="ALL">FOC + Chargeable</option>
            <option value="FOC">FOC Only</option>
            <option value="CHARGEABLE">Chargeable Only</option>
          </SelectInput>
          <div style={{ display:'flex', border:`1.5px solid ${T.border}`, borderRadius:8, overflow:'hidden' }}>
            {['list','grid'].map(m=>(
                <button key={m}
                        onClick={()=>setViewMode(m)}
                        style={{
                          padding:'7px 12px', fontSize:14, cursor:'pointer', border:'none',
                          background: viewMode===m ? T.accent : T.surface,
                          color: viewMode===m ? T.white : T.muted,
                          transition:'all 0.12s',
                        }}
                >
                  {m==='list' ? '☰' : '⊞'}
                </button>
            ))}
          </div>
          <Btn variant="primary" onClick={()=>setAddOpen(true)}>➕ Add Material</Btn>
          <Btn variant="outline" onClick={load}>🔄 Refresh</Btn>
        </div>

        {/* Summary stats */}
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          {[
            { label:'Total Items', value:levels.length, color:T.navy },
            { label:'In Stock',    value:levels.filter(m=>m.stockStatus==='IN_STOCK').length, color:T.green },
            { label:'Low/Critical',value:levels.filter(m=>['LOW_STOCK','CRITICAL','OUT_OF_STOCK'].includes(m.stockStatus)).length, color:T.red },
            { label:'FOC Items',   value:levels.filter(m=>m.isFOC).length, color:T.orange },
            { label:'Total Value', value:fmtLKR(levels.reduce((s,m)=>(s+(m.totalValue||0)),0)), color:T.accent },
          ].map((s,i)=>(
              <div key={i} style={{
                padding:'10px 16px', borderRadius:10, background:T.surface,
                border:`1px solid ${T.border}`, display:'flex', flexDirection:'column', gap:2,
                boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
              }}>
                <div style={{ fontSize:18, fontWeight:800, color:s.color, fontFamily:'Fraunces,serif' }}>{s.value}</div>
                <div style={{ fontSize:10, color:T.muted, fontWeight:700, letterSpacing:0.4 }}>{s.label}</div>
              </div>
          ))}
        </div>

        {/* List View */}
        {viewMode === 'list' && (
            <div style={{
              background:T.surface, border:`1px solid ${T.border}`, borderRadius:12,
              overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                <tr style={{ borderBottom:`2px solid ${T.border}` }}>
                  {['Material','SKU','Category','Stock Level','Price','FOC','Status','Actions'].map((h,i)=>(
                      <th key={i} style={{
                        padding:'11px 14px', textAlign:'left', background:T.bg,
                        fontSize:10, fontWeight:800, color:T.muted, letterSpacing:0.6,
                      }}>{h}</th>
                  ))}
                </tr>
                </thead>
                <tbody>
                {loading ? (
                    [...Array(6)].map((_,i)=>(
                        <tr key={i}>
                          {[...Array(8)].map((_,j)=>(
                              <td key={j} style={{ padding:'12px 14px', borderBottom:`1px solid ${T.border2}` }}>
                                <Skeleton h={13} />
                              </td>
                          ))}
                        </tr>
                    ))
                ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding:'48px 24px', textAlign:'center', color:T.muted, fontSize:14 }}>
                        <div style={{ fontSize:36, marginBottom:10 }}>📦</div>
                        No materials match filters
                      </td>
                    </tr>
                ) : filtered.map((m,i)=>{
                  const ss = STOCK_STATUS[m.stockStatus] || STOCK_STATUS.IN_STOCK;
                  return (
                      <tr key={m.materialId||i} style={{
                        borderBottom:`1px solid ${T.border2}`,
                        transition:'background 0.1s',
                        animation:`inv-fadein 0.25s ease ${i*0.02}s both`,
                      }}
                          onMouseEnter={e=>{[...e.currentTarget.querySelectorAll('td')].forEach(td=>td.style.background=T.bg);}}
                          onMouseLeave={e=>{[...e.currentTarget.querySelectorAll('td')].forEach(td=>td.style.background='');}}
                      >
                        <td style={{ padding:'12px 14px' }}>
                          <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{m.materialName}</div>
                          <div style={{ fontSize:10, color:T.muted }}>{m.unit}</div>
                        </td>
                        <td style={{ padding:'12px 14px', fontSize:11, color:T.muted, fontFamily:'monospace' }}>
                          {m.sku||'—'}
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                      <span style={{
                        fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5,
                        background:T.bg2, color:T.muted, border:`1px solid ${T.border}`,
                      }}>
                        {m.category||'GENERAL'}
                      </span>
                        </td>
                        <td style={{ padding:'12px 14px', minWidth:140 }}>
                          <StockBar current={m.currentStock||0} max={m.maxThreshold||100} status={m.stockStatus} />
                          <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>
                            Min: {m.minThreshold} · Max: {m.maxThreshold}
                          </div>
                        </td>
                        <td style={{ padding:'12px 14px', fontSize:12, fontWeight:700, color:T.navy }}>
                          {fmtLKR(m.unitPrice)}
                        </td>
                        <td style={{ padding:'12px 14px', textAlign:'center' }}>
                          {m.isFOC ? (
                              <span style={{
                                fontSize:10, padding:'2px 7px', borderRadius:5,
                                background:T.greenL, color:T.green, fontWeight:700,
                                border:`1px solid ${T.green}44`,
                              }}>FOC</span>
                          ) : (
                              <span style={{
                                fontSize:10, padding:'2px 7px', borderRadius:5,
                                background:T.navyL, color:T.navy, fontWeight:700,
                                border:`1px solid ${T.navy}44`,
                              }}>Charge</span>
                          )}
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                          <Badge label={ss.label} bg={ss.bg} color={ss.color} border={ss.border} />
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <Btn variant="outline" onClick={()=>setAdjMat(m)} style={{ padding:'5px 10px', fontSize:11 }}>
                              📊 Adjust
                            </Btn>
                            <Btn variant="outline" onClick={()=>setEditMat(m)} style={{ padding:'5px 10px', fontSize:11 }}>
                              ✏️ Edit
                            </Btn>
                          </div>
                        </td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && (
            <div style={{
              display:'grid',
              gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))',
              gap:14,
            }}>
              {loading ? (
                  [...Array(8)].map((_,i)=>(
                      <div key={i} style={{
                        background:T.surface, borderRadius:12, padding:16,
                        border:`1px solid ${T.border}`,
                        display:'flex', flexDirection:'column', gap:10,
                      }}>
                        <Skeleton h={14} w="70%" />
                        <Skeleton h={10} w="40%" />
                        <Skeleton h={6} r={3} />
                        <Skeleton h={28} r={8} />
                      </div>
                  ))
              ) : filtered.map((m,i)=>{
                const ss = STOCK_STATUS[m.stockStatus] || STOCK_STATUS.IN_STOCK;
                return (
                    <div key={m.materialId||i} style={{
                      background:T.surface, borderRadius:12, padding:16,
                      border:`1px solid ${T.border}`,
                      boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
                      transition:'all 0.15s', cursor:'default',
                      animation:`inv-fadein 0.3s ease ${i*0.03}s both`,
                    }}
                         onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,0.1)';e.currentTarget.style.borderColor=T.accent+'66';}}
                         onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)';e.currentTarget.style.borderColor=T.border;}}
                    >
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:800, color:T.text, fontFamily:'Fraunces,serif', lineHeight:1.3 }}>
                            {m.materialName}
                          </div>
                          <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>
                            {m.sku} · {m.unit}
                          </div>
                        </div>
                        {m.isFOC && (
                            <span style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background:T.greenL, color:T.green, fontWeight:800 }}>
                      FOC
                    </span>
                        )}
                      </div>

                      <StockBar current={m.currentStock||0} max={m.maxThreshold||100} status={m.stockStatus} />

                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'8px 0' }}>
                        <Badge label={ss.label} bg={ss.bg} color={ss.color} border={ss.border} />
                        <span style={{ fontSize:13, fontWeight:800, color:T.navy, fontFamily:'Fraunces,serif' }}>
                    {fmtLKR(m.unitPrice)}
                  </span>
                      </div>

                      <div style={{ display:'flex', gap:6, marginTop:4 }}>
                        <Btn variant="outline" onClick={()=>setAdjMat(m)} style={{ flex:1, justifyContent:'center', padding:'6px', fontSize:11 }}>
                          📊 Adjust
                        </Btn>
                        <Btn variant="outline" onClick={()=>setEditMat(m)} style={{ flex:1, justifyContent:'center', padding:'6px', fontSize:11 }}>
                          ✏️ Edit
                        </Btn>
                      </div>
                    </div>
                );
              })}
            </div>
        )}

        {/* Modals */}
        <AdjustStockModal
            material={adjMat} open={!!adjMat}
            onClose={()=>{ setAdjMat(null); load(); }}
            onSuccess={onToast}
        />
        <MaterialFormModal
            material={editMat} open={!!editMat || addOpen}
            onClose={()=>{ setEditMat(null); setAddOpen(false); load(); }}
            onSuccess={onToast}
        />
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUESTS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function RequestsTab({ onToast }) {
  const [requests, setRequests] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [fStatus,  setFStatus]  = useState('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await get('/api/inventory/material-requests/pending');
      setRequests(r);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(()=>{ load(); },[load]);

  const items = requests?.requests || [];

  return (
      <div>
        {/* Summary banner */}
        {requests && (
            <div style={{
              display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20,
            }}>
              {[
                { label:'Pending Requests', value:requests.totalPending, color:T.orange, icon:'⏳' },
                { label:'Urgent',           value:requests.urgentCount,  color:T.red,    icon:'🔴' },
                { label:'Normal',           value:requests.normalCount,  color:T.navy,   icon:'📋' },
                { label:'Est. Value',       value:fmtLKR(requests.totalEstimatedValue), color:T.accent, icon:'💰' },
              ].map((s,i)=>(
                  <div key={i} style={{
                    padding:'14px 18px', borderRadius:12, background:T.surface,
                    border:`1px solid ${T.border}`,
                    display:'flex', alignItems:'center', gap:12,
                    boxShadow:'0 1px 6px rgba(0,0,0,0.05)',
                  }}>
                    <span style={{ fontSize:24 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontSize:22, fontWeight:800, color:s.color, fontFamily:'Fraunces,serif' }}>{s.value}</div>
                      <div style={{ fontSize:11, color:T.muted }}>{s.label}</div>
                    </div>
                  </div>
              ))}
            </div>
        )}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.text, fontFamily:'Fraunces,serif' }}>
            Pending Approval Queue
          </div>
          <Btn variant="outline" onClick={load}>🔄 Refresh</Btn>
        </div>

        {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[...Array(4)].map((_,i)=>(
                  <div key={i} style={{ background:T.surface, borderRadius:12, padding:18, border:`1px solid ${T.border}` }}>
                    <Skeleton h={14} w="40%" r={6} />
                    <div style={{ marginTop:10 }}><Skeleton h={10} r={5} /></div>
                  </div>
              ))}
            </div>
        ) : items.length === 0 ? (
            <div style={{
              textAlign:'center', padding:'60px 24px',
              background:T.surface, borderRadius:12, border:`1px solid ${T.border}`,
            }}>
              <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
              <div style={{ fontSize:16, fontWeight:800, color:T.text, fontFamily:'Fraunces,serif' }}>
                All Clear!
              </div>
              <div style={{ fontSize:13, color:T.muted, marginTop:4 }}>
                No pending material requests
              </div>
            </div>
        ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {items.map((req,i)=>(
                  <div key={req.id||i} style={{
                    background:T.surface, borderRadius:12, padding:18,
                    border:`1px solid ${req.urgency==='URGENT' ? T.red+'55' : T.border}`,
                    boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
                    animation:`inv-fadein 0.3s ease ${i*0.05}s both`,
                    transition:'all 0.15s',
                  }}
                       onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)';}}
                       onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)';}}
                  >
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{
                          width:38, height:38, borderRadius:'50%', flexShrink:0,
                          background:`linear-gradient(135deg, ${T.navy}, #2E6BAD)`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:15, fontWeight:800, color:T.white, fontFamily:'Fraunces,serif',
                        }}>
                          {req.requesterName?.charAt(0)||'?'}
                        </div>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ fontSize:13, fontWeight:800, color:T.text }}>{req.requesterName}</span>
                            <span style={{ fontSize:10, color:T.muted, padding:'1px 5px', borderRadius:4, background:T.bg2 }}>
                        {req.requesterRole}
                      </span>
                            {req.urgency==='URGENT' && (
                                <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:T.redL, color:T.red, fontWeight:800 }}>
                          🔴 URGENT
                        </span>
                            )}
                          </div>
                          <div style={{ fontSize:11, color:T.muted, marginTop:1 }}>
                            {req.requestNumber} · {timeAgo(req.submittedAt)}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:16, fontWeight:800, color:T.accent, fontFamily:'Fraunces,serif' }}>
                          {fmtLKR(req.totalEstimatedCost)}
                        </div>
                        <div style={{ fontSize:10, color:T.muted }}>{req.totalItems} items</div>
                      </div>
                    </div>

                    {/* Items preview */}
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                      {(req.items||[]).slice(0,4).map((item,j)=>(
                          <div key={j} style={{
                            padding:'4px 10px', borderRadius:6,
                            background:T.bg, border:`1px solid ${T.border}`,
                            fontSize:11, display:'flex', alignItems:'center', gap:5,
                          }}>
                            <span style={{ fontWeight:700, color:T.text }}>{item.materialName}</span>
                            <span style={{ color:T.navy, fontWeight:800 }}>×{item.requestedQuantity}</span>
                            {item.isFOC && <span style={{ color:T.green, fontSize:9, fontWeight:800 }}>FOC</span>}
                          </div>
                      ))}
                      {(req.items||[]).length > 4 && (
                          <div style={{
                            padding:'4px 10px', borderRadius:6,
                            background:T.bg2, border:`1px solid ${T.border}`,
                            fontSize:11, color:T.muted,
                          }}>
                            +{req.items.length-4} more
                          </div>
                      )}
                    </div>

                    {req.requesterNotes && (
                        <div style={{
                          padding:'8px 12px', background:T.bg, borderRadius:8,
                          border:`1px solid ${T.border}`, fontSize:12,
                          color:T.muted, marginBottom:12,
                        }}>
                          "{req.requesterNotes}"
                        </div>
                    )}

                    <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                      <Btn variant="outline" onClick={()=>setSelected(req)} style={{ fontSize:11, padding:'6px 12px' }}>
                        👁 Review Detail
                      </Btn>
                      <Btn variant="success" onClick={()=>setSelected(req)} style={{ fontSize:11, padding:'6px 12px' }}>
                        ✅ Approve
                      </Btn>
                      <Btn variant="danger" onClick={()=>setSelected(req)} style={{ fontSize:11, padding:'6px 12px' }}>
                        ❌ Reject
                      </Btn>
                    </div>
                  </div>
              ))}
            </div>
        )}

        <RequestApprovalModal
            request={selected} open={!!selected}
            onClose={()=>{ setSelected(null); load(); }}
            onSuccess={onToast}
        />
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLES TAB
// ═══════════════════════════════════════════════════════════════════════════════
function VehiclesTab({ onToast }) {
  const [vehicles, setVehicles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [fStatus,  setFStatus]  = useState('ALL');
  const [viewMode, setViewMode] = useState('grid');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const v = await get('/api/vehicles');
      setVehicles(Array.isArray(v) ? v : v?.content || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(()=>{ load(); },[load]);

  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase();
    if (q && !(
        v.registrationNumber?.toLowerCase().includes(q) ||
        v.make?.toLowerCase().includes(q) ||
        v.model?.toLowerCase().includes(q) ||
        v.assignedTo?.fullName?.toLowerCase().includes(q)
    )) return false;
    if (fStatus !== 'ALL' && v.status !== fStatus) return false;
    return true;
  });

  const counts = {};
  vehicles.forEach(v => { counts[v.status]=(counts[v.status]||0)+1; });

  return (
      <div>
        {/* Status strip */}
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {[
            { key:'ALL',        label:`All (${vehicles.length})` },
            { key:'AVAILABLE',  label:`Available (${counts.AVAILABLE||0})` },
            { key:'IN_USE',     label:`In Use (${counts.IN_USE||0})` },
            { key:'MAINTENANCE',label:`Service (${counts.MAINTENANCE||0})` },
            { key:'INACTIVE',   label:`Inactive (${counts.INACTIVE||0})` },
          ].map(c=>(
              <button key={c.key}
                      onClick={()=>setFStatus(c.key)}
                      style={{
                        padding:'6px 14px', borderRadius:20, fontSize:11, fontWeight:700,
                        cursor:'pointer', border:'none', transition:'all 0.12s',
                        background: fStatus===c.key ? T.accent : T.surface,
                        color: fStatus===c.key ? T.white : T.muted,
                        boxShadow: fStatus===c.key ? '0 2px 8px rgba(200,80,26,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
                        fontFamily:'Fraunces,serif',
                      }}
              >{c.label}</button>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          <div style={{ position:'relative', flex:1 }}>
            <span style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:T.muted }}>🔍</span>
            <input
                value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search by plate, make, model, assigned technician…"
                style={{
                  width:'100%', background:T.surface, border:`1.5px solid ${T.border}`,
                  borderRadius:8, padding:'9px 12px 9px 30px', color:T.text,
                  fontSize:12, outline:'none', fontFamily:'Fraunces,serif',
                }}
                onFocus={e=>e.target.style.borderColor=T.accent}
                onBlur={e=>e.target.style.borderColor=T.border}
            />
          </div>
          <div style={{ display:'flex', border:`1.5px solid ${T.border}`, borderRadius:8, overflow:'hidden' }}>
            {['grid','list'].map(m=>(
                <button key={m} onClick={()=>setViewMode(m)}
                        style={{
                          padding:'8px 12px', fontSize:14, cursor:'pointer', border:'none',
                          background: viewMode===m ? T.accent : T.surface,
                          color: viewMode===m ? T.white : T.muted,
                          transition:'all 0.12s',
                        }}
                >{m==='grid'?'⊞':'☰'}</button>
            ))}
          </div>
          <Btn variant="outline" onClick={load}>🔄 Refresh</Btn>
        </div>

        {/* Grid View */}
        {viewMode === 'grid' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:14 }}>
              {loading ? [...Array(6)].map((_,i)=>(
                  <div key={i} style={{ background:T.surface, borderRadius:12, padding:18, border:`1px solid ${T.border}` }}>
                    <Skeleton h={14} w="60%" r={6} />
                    <div style={{ marginTop:8 }}><Skeleton h={10} w="40%" /></div>
                    <div style={{ marginTop:14 }}><Skeleton h={32} r={8} /></div>
                  </div>
              )) : filtered.length === 0 ? (
                  <div style={{ gridColumn:'1/-1', textAlign:'center', padding:48, color:T.muted, fontSize:13 }}>
                    <div style={{ fontSize:36, marginBottom:10 }}>🚐</div>
                    No vehicles match filters
                  </div>
              ) : filtered.map((v,i)=>{
                const vs = VEH_STATUS[v.status] || VEH_STATUS.INACTIVE;
                const needsService = v.nextServiceDate && new Date(v.nextServiceDate) < new Date();
                return (
                    <div key={v.id||i} style={{
                      background:T.surface, borderRadius:12, padding:18,
                      border:`1.5px solid ${needsService ? T.orange+'66' : T.border}`,
                      boxShadow:'0 2px 10px rgba(0,0,0,0.06)',
                      transition:'all 0.15s',
                      animation:`inv-fadein 0.3s ease ${i*0.04}s both`,
                    }}
                         onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.12)';e.currentTarget.style.transform='translateY(-2px)';}}
                         onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 2px 10px rgba(0,0,0,0.06)';e.currentTarget.style.transform='none';}}
                    >
                      {/* Vehicle icon + plate */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                            <span style={{ fontSize:24 }}>🚐</span>
                            <span style={{
                              fontSize:14, fontWeight:800, color:T.navy,
                              fontFamily:'Fraunces,serif', letterSpacing:0.5,
                            }}>
                        {v.registrationNumber || '—'}
                      </span>
                          </div>
                          <div style={{ fontSize:12, color:T.muted }}>
                            {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                          </div>
                        </div>
                        <Badge label={vs.label} bg={vs.bg} color={vs.color} />
                      </div>

                      {/* Vehicle type */}
                      {v.vehicleType && (
                          <div style={{
                            padding:'4px 10px', borderRadius:6, display:'inline-flex',
                            background:T.bg2, border:`1px solid ${T.border}`,
                            fontSize:10, fontWeight:700, color:T.muted, marginBottom:12,
                          }}>
                            {v.vehicleType}
                          </div>
                      )}

                      {/* Assigned to */}
                      {v.assignedTo ? (
                          <div style={{
                            display:'flex', alignItems:'center', gap:8,
                            padding:'8px 10px', borderRadius:8, background:T.bg,
                            border:`1px solid ${T.border}`, marginBottom:10,
                          }}>
                            <div style={{
                              width:26, height:26, borderRadius:'50%', flexShrink:0,
                              background:`linear-gradient(135deg, ${T.navy}, #2E6BAD)`,
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:11, fontWeight:800, color:T.white,
                            }}>
                              {v.assignedTo.fullName?.charAt(0)||'?'}
                            </div>
                            <div>
                              <div style={{ fontSize:12, fontWeight:700, color:T.text }}>{v.assignedTo.fullName}</div>
                              <div style={{ fontSize:10, color:T.muted }}>Assigned</div>
                            </div>
                          </div>
                      ) : (
                          <div style={{
                            padding:'8px 10px', borderRadius:8,
                            background:T.greenL, border:`1px solid ${T.green}44`,
                            fontSize:11, color:T.green, fontWeight:700, marginBottom:10,
                            textAlign:'center',
                          }}>
                            ✓ Available for Assignment
                          </div>
                      )}

                      {/* Service date */}
                      {v.nextServiceDate && (
                          <div style={{
                            display:'flex', alignItems:'center', gap:6, fontSize:11,
                            color: needsService ? T.orange : T.muted,
                            padding:'6px 10px', borderRadius:6,
                            background: needsService ? T.orangeL : T.bg,
                            border:`1px solid ${needsService ? T.orange+'44' : T.border}`,
                          }}>
                            <span>{needsService ? '⚠️' : '🔧'}</span>
                            Next Service: {fmt(v.nextServiceDate)}
                            {needsService && ' (Overdue)'}
                          </div>
                      )}
                    </div>
                );
              })}
            </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
            <div style={{
              background:T.surface, border:`1px solid ${T.border}`, borderRadius:12,
              overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                <tr style={{ borderBottom:`2px solid ${T.border}` }}>
                  {['Plate','Make / Model','Type','Status','Assigned To','Last Service','Next Service'].map((h,i)=>(
                      <th key={i} style={{
                        padding:'11px 14px', textAlign:'left', background:T.bg,
                        fontSize:10, fontWeight:800, color:T.muted, letterSpacing:0.6,
                      }}>{h}</th>
                  ))}
                </tr>
                </thead>
                <tbody>
                {loading ? (
                    [...Array(5)].map((_,i)=>(
                        <tr key={i}>{[...Array(7)].map((_,j)=>(
                            <td key={j} style={{ padding:'12px 14px', borderBottom:`1px solid ${T.border2}` }}>
                              <Skeleton h={13} />
                            </td>
                        ))}</tr>
                    ))
                ) : filtered.map((v,i)=>{
                  const vs = VEH_STATUS[v.status] || VEH_STATUS.INACTIVE;
                  const needsService = v.nextServiceDate && new Date(v.nextServiceDate) < new Date();
                  return (
                      <tr key={v.id||i} style={{
                        borderBottom:`1px solid ${T.border2}`,
                        animation:`inv-fadein 0.25s ease ${i*0.02}s both`,
                        transition:'background 0.1s',
                      }}
                          onMouseEnter={e=>[...e.currentTarget.querySelectorAll('td')].forEach(td=>td.style.background=T.bg)}
                          onMouseLeave={e=>[...e.currentTarget.querySelectorAll('td')].forEach(td=>td.style.background='')}
                      >
                        <td style={{ padding:'12px 14px', fontWeight:800, color:T.navy, fontFamily:'monospace', fontSize:13 }}>
                          {v.registrationNumber||'—'}
                        </td>
                        <td style={{ padding:'12px 14px', fontSize:12, color:T.text }}>
                          {v.make} {v.model}
                          {v.year && <span style={{ color:T.muted }}> ({v.year})</span>}
                        </td>
                        <td style={{ padding:'12px 14px', fontSize:11, color:T.muted }}>{v.vehicleType||'—'}</td>
                        <td style={{ padding:'12px 14px' }}>
                          <Badge label={vs.label} bg={vs.bg} color={vs.color} />
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                          {v.assignedTo ? (
                              <span style={{ fontSize:12, color:T.text }}>{v.assignedTo.fullName}</span>
                          ) : (
                              <span style={{ fontSize:11, color:T.green, fontWeight:700 }}>Available</span>
                          )}
                        </td>
                        <td style={{ padding:'12px 14px', fontSize:11, color:T.muted }}>{fmt(v.lastServiceDate)}</td>
                        <td style={{ padding:'12px 14px' }}>
                          {v.nextServiceDate ? (
                              <span style={{
                                fontSize:11, padding:'3px 8px', borderRadius:5,
                                background: needsService ? T.orangeL : T.bg2,
                                color: needsService ? T.orange : T.muted,
                                fontWeight: needsService ? 700 : 400,
                                border:`1px solid ${needsService ? T.orange+'44' : T.border}`,
                              }}>
                          {needsService ? '⚠️ ' : ''}{fmt(v.nextServiceDate)}
                        </span>
                          ) : '—'}
                        </td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
        )}
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function InventoryPage() {
  const [tab,   setTab]   = useState('materials');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type='success') => setToast({ msg, type }), []);

  // Inject CSS
  useEffect(() => {
    const id = 'inv-page-css';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,400&display=swap');
      @keyframes inv-shimmer { 0%{background-position:200% 0}100%{background-position:-200% 0} }
      @keyframes inv-fadein  { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
      @keyframes inv-slidein { from{opacity:0;transform:translateY(-14px)scale(0.97)}to{opacity:1;transform:none} }
      @keyframes inv-toastin { from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none} }
      .inv-page * { box-sizing:border-box; }
      ::-webkit-scrollbar{width:5px;height:5px}
      ::-webkit-scrollbar-track{background:${T.bg}}
      ::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}
    `;
    document.head.appendChild(s);
  }, []);

  const TABS = [
    { id:'materials', label:'📦 Materials',          count:null },
    { id:'requests',  label:'📬 Approval Queue',     count:'pending' },
    { id:'vehicles',  label:'🚐 Vehicles',            count:null },
  ];

  return (
      <div className="inv-page" style={{
        background:T.bg, minHeight:'100vh',
        padding:'28px 32px', fontFamily:'Fraunces,serif',
      }}>

        {/* Page header */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{
            margin:0, fontSize:26, fontWeight:800, color:T.text,
            letterSpacing:-0.5,
          }}>
            Inventory Management
          </h1>
          <div style={{ fontSize:13, color:T.muted, marginTop:4 }}>
            Materials, stock levels, material requests & vehicle fleet
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display:'flex', gap:4, marginBottom:24,
          borderBottom:`2px solid ${T.border}`,
          paddingBottom:0,
        }}>
          {TABS.map(t => (
              <button key={t.id}
                      onClick={()=>setTab(t.id)}
                      style={{
                        padding:'10px 20px', border:'none', cursor:'pointer',
                        background:'none', fontSize:13, fontWeight:700,
                        color: tab===t.id ? T.accent : T.muted,
                        borderBottom: tab===t.id ? `2px solid ${T.accent}` : '2px solid transparent',
                        marginBottom:-2, transition:'all 0.14s',
                        fontFamily:'Fraunces,serif', letterSpacing:0.2,
                      }}
                      onMouseEnter={e=>{ if(tab!==t.id) e.currentTarget.style.color=T.text; }}
                      onMouseLeave={e=>{ if(tab!==t.id) e.currentTarget.style.color=T.muted; }}
              >
                {t.label}
              </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'materials' && <MaterialsTab onToast={showToast} />}
        {tab === 'requests'  && <RequestsTab  onToast={showToast} />}
        {tab === 'vehicles'  && <VehiclesTab  onToast={showToast} />}

        {/* Toast */}
        {toast && (
            <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />
        )}
      </div>
  );
}