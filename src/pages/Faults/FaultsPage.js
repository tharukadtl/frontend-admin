import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';

// ─── API ──────────────────────────────────────────────────────────────────────
const API   = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const token = () => localStorage.getItem('accessToken');
const req   = (method, path, body) =>
    fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token()}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then(r => {
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    });
const get   = path       => req('GET',   path);
const post  = (path, b)  => req('POST',  path, b);
const patch = (path, b)  => req('PATCH', path, b);

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:       '#0D1117',
  surface:  '#161B22',
  surface2: '#1C2333',
  border:   '#30363D',
  border2:  '#21262D',
  text:     '#E6EDF3',
  muted:    '#7D8590',
  accent:   '#58A6FF',
  accentD:  '#1F6FEB',
  green:    '#3FB950',
  orange:   '#D29922',
  red:      '#F85149',
  purple:   '#BC8CFF',
  teal:     '#39D353',
  white:    '#FFFFFF',
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  OPEN:        { label:'Open',        bg:'#21262D', color:'#58A6FF', border:'#388BFD55', dot:'#58A6FF' },
  REPORTED:    { label:'Open',        bg:'#21262D', color:'#58A6FF', border:'#388BFD55', dot:'#58A6FF' },
  ASSIGNED:    { label:'Assigned',    bg:'#21262D', color:'#BC8CFF', border:'#BC8CFF55', dot:'#BC8CFF' },
  IN_PROGRESS: { label:'In Progress', bg:'#21262D', color:'#D29922', border:'#D2992255', dot:'#D29922' },
  HOLD:        { label:'On Hold',     bg:'#21262D', color:'#D29922', border:'#D2992255', dot:'#D29922' },
  TRAVELLING:  { label:'Travelling',  bg:'#21262D', color:'#D29922', border:'#D2992255', dot:'#D29922' },
  COMPLETED:   { label:'Completed',   bg:'#21262D', color:'#3FB950', border:'#3FB95055', dot:'#3FB950' },
  CANCELLED:   { label:'Cancelled',   bg:'#21262D', color:'#F85149', border:'#F8514955', dot:'#F85149' },
};

const PRIORITY = {
  HIGH:   { label:'HIGH',   bg:'#3D1F1F', color:'#FF7B72', border:'#FF7B7255' },
  MEDIUM: { label:'MED',    bg:'#2D2200', color:'#E3B341', border:'#E3B34155' },
  LOW:    { label:'LOW',    bg:'#1C2D1C', color:'#56D364', border:'#56D36455' },
};

const CATEGORIES = ['INTERNET','PHONE','TV','FIBER','OTHER'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = d => d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtTime = d => d ? new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
const timeAgo = d => {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};

// ─── CSV/Excel export ─────────────────────────────────────────────────────────
const exportCSV = (faults) => {
  const headers = ['ID','Status','Priority','Category','Customer','Address','Assigned To','Created','Updated'];
  const rows = faults.map(f => [
    f.id, f.status, f.priority, f.category,
    f.reportedBy?.fullName || '—',
    f.address || '—',
    f.assignedTo?.fullName || (f.workGroupName ? `${f.workGroupName} (unclaimed)` : 'Unassigned'),
    fmt(f.createdAt), fmt(f.updatedAt),
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `faults_export_${Date.now()}.csv`;
  a.click();
};

// ═══════════════════════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.OPEN;
  return (
      <span style={{
        display:'inline-flex', alignItems:'center', gap:5,
        padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700,
        background:s.bg, color:s.color, border:`1px solid ${s.border}`,
        letterSpacing:0.3, whiteSpace:'nowrap',
      }}>
      <span style={{
        width:5, height:5, borderRadius:'50%', background:s.dot,
        boxShadow:`0 0 4px ${s.dot}`,
      }} />
        {s.label}
    </span>
  );
};

const PriBadge = ({ priority }) => {
  const p = PRIORITY[priority] || PRIORITY.LOW;
  return (
      <span style={{
        padding:'2px 7px', borderRadius:6, fontSize:10, fontWeight:800,
        background:p.bg, color:p.color, border:`1px solid ${p.border}`,
        letterSpacing:0.5,
      }}>
      {p.label}
    </span>
  );
};

const Avatar = ({ name, size=28 }) => (
    <div style={{
      width:size, height:size, borderRadius:'50%', flexShrink:0,
      background:`linear-gradient(135deg, ${C.accentD}, ${C.accent})`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size*0.4, fontWeight:800, color:C.white,
      fontFamily:'Bricolage Grotesque,sans-serif',
    }}>
      {name?.charAt(0)?.toUpperCase() || '?'}
    </div>
);

const Checkbox = ({ checked, indeterminate, onChange }) => {
  const ref = useRef();
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
      <input
          ref={ref} type="checkbox" checked={checked} onChange={onChange}
          style={{ width:15, height:15, cursor:'pointer', accentColor:C.accent }}
      />
  );
};

const Skeleton = ({ h=14, w='100%', r=6 }) => (
    <div style={{
      height:h, width:w, borderRadius:r,
      background:`linear-gradient(90deg,${C.surface} 25%,${C.surface2} 50%,${C.surface} 75%)`,
      backgroundSize:'400% 100%', animation:'flt-shimmer 1.4s ease infinite',
    }} />
);

const Btn = ({ children, variant='ghost', color=C.accent, onClick, disabled=false, style:sx={} }) => {
  const variants = {
    ghost:   { bg:'transparent', border:`1px solid ${C.border}`, hoverBg:C.surface2, textColor:C.text },
    primary: { bg:C.accentD, border:`1px solid ${C.accentD}`, hoverBg:'#1a63d4', textColor:C.white },
    danger:  { bg:'#3D1F1F', border:`1px solid ${C.red}55`, hoverBg:'#4D1F1F', textColor:C.red },
    warning: { bg:'#2D2200', border:`1px solid ${C.orange}55`, hoverBg:'#3D2A00', textColor:C.orange },
    success: { bg:'#1C2D1C', border:`1px solid ${C.green}55`, hoverBg:'#253525', textColor:C.green },
  };
  const v = variants[variant] || variants.ghost;
  const [hov, setHov] = useState(false);
  return (
      <button
          onClick={onClick} disabled={disabled}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          style={{
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:600,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            background: hov ? v.hoverBg : v.bg,
            border: v.border, color: v.textColor,
            transition:'all 0.14s', whiteSpace:'nowrap',
            fontFamily:'DM Mono,monospace', letterSpacing:0.2,
            ...sx,
          }}
      >
        {children}
      </button>
  );
};

const Input = ({ value, onChange, placeholder, style:sx={} }) => (
    <input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background:C.surface2, border:`1px solid ${C.border}`,
          borderRadius:8, padding:'8px 12px', fontSize:13, color:C.text,
          outline:'none', width:'100%', fontFamily:'DM Mono,monospace',
          transition:'border-color 0.14s', ...sx,
        }}
        onFocus={e => e.target.style.borderColor=C.accent}
        onBlur={e => e.target.style.borderColor=C.border}
    />
);

const Select = ({ value, onChange, children, style:sx={} }) => (
    <select
        value={value} onChange={e => onChange(e.target.value)}
        style={{
          background:C.surface2, border:`1px solid ${C.border}`,
          borderRadius:8, padding:'8px 12px', fontSize:12, color:C.text,
          outline:'none', cursor:'pointer', fontFamily:'DM Mono,monospace',
          transition:'border-color 0.14s', ...sx,
        }}
        onFocus={e => e.target.style.borderColor=C.accent}
        onBlur={e => e.target.style.borderColor=C.border}
    >
      {children}
    </select>
);

// ─── Modal wrapper ────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, subtitle, width=680, children }) => {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
      <div
          onClick={e => e.target === e.currentTarget && onClose()}
          style={{
            position:'fixed', inset:0, zIndex:1000,
            background:'rgba(1,4,9,0.85)', backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:24, animation:'flt-fadein 0.18s ease',
          }}
      >
        <div style={{
          background:C.surface, border:`1px solid ${C.border}`,
          borderRadius:16, width:'100%', maxWidth:width,
          maxHeight:'90vh', display:'flex', flexDirection:'column',
          boxShadow:'0 24px 64px rgba(0,0,0,0.6)',
          animation:'flt-slidein 0.2s ease',
        }}>
          <div style={{
            padding:'20px 24px 16px', borderBottom:`1px solid ${C.border}`,
            display:'flex', alignItems:'flex-start', justifyContent:'space-between',
            flexShrink:0,
          }}>
            <div>
              <div style={{ fontWeight:800, fontSize:16, color:C.text, fontFamily:'Bricolage Grotesque,sans-serif' }}>
                {title}
              </div>
              {subtitle && <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>{subtitle}</div>}
            </div>
            <button
                onClick={onClose}
                style={{
                  background:'none', border:'none', color:C.muted, fontSize:20,
                  cursor:'pointer', padding:'0 4px', lineHeight:1,
                  transition:'color 0.12s',
                }}
                onMouseEnter={e => e.target.style.color=C.text}
                onMouseLeave={e => e.target.style.color=C.muted}
            >
              ×
            </button>
          </div>
          <div style={{ overflowY:'auto', flex:1 }}>{children}</div>
        </div>
      </div>
  );
};

// ─── Toast notification ───────────────────────────────────────────────────────
const Toast = ({ msg, type, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  const col = type==='success' ? C.green : type==='error' ? C.red : C.orange;
  return (
      <div style={{
        position:'fixed', bottom:28, right:28, zIndex:2000,
        background:C.surface, border:`1px solid ${col}55`,
        borderRadius:12, padding:'12px 18px', fontSize:13, color:C.text,
        boxShadow:`0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${col}22`,
        display:'flex', alignItems:'center', gap:10, maxWidth:360,
        animation:'flt-toastin 0.24s ease',
        fontFamily:'DM Mono,monospace',
      }}>
      <span style={{ fontSize:18 }}>
        {type==='success'?'✅':type==='error'?'❌':'⚠️'}
      </span>
        {msg}
      </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL MODAL — Timeline, Notes, Assign, Reassign, Escalate
// ═══════════════════════════════════════════════════════════════════════════════
function FaultDetailModal({ fault, workGroups, currentUser, open, onClose, onSuccess }) {
  const [tab,         setTab]         = useState('timeline');
  const [timeline,    setTimeline]    = useState([]);
  const [notes,       setNotes]       = useState([]);
  const [tlLoading,   setTlLoading]   = useState(false);
  const [noteText,    setNoteText]    = useState('');
  const [isInternal,  setIsInternal]  = useState(false);
  const [posting,     setPosting]     = useState(false);
  const [photos,      setPhotos]      = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [lightbox,    setLightbox]    = useState(null);

  // Assign form (Work Group — SRS 5.5.1)
  const [assignWg,       setAssignWg]      = useState('');
  const [assignPri,      setAssignPri]     = useState('MEDIUM');
  const [assignNotes,    setAssignNotes]   = useState('');
  const [assigning,      setAssigning]     = useState(false);

  // Reassign form
  const [reassignWg,     setReassignWg]    = useState('');
  const [reassignReason, setReassignReason]= useState('');
  const [reassigning,    setReassigning]   = useState(false);

  // Escalate form
  const [escalateReason, setEscalateReason]= useState('');
  const [escalating,     setEscalating]    = useState(false);

  // Circuit tab (H1c) — cascading Opmc -> Exchange -> Cab -> Dp -> Circuit picker
  const [circOpmcs,     setCircOpmcs]     = useState([]);
  const [circExchanges, setCircExchanges] = useState([]);
  const [circCabs,      setCircCabs]      = useState([]);
  const [circDps,       setCircDps]       = useState([]);
  const [circCircuits,  setCircCircuits]  = useState([]);
  const [selOpmc,       setSelOpmc]       = useState('');
  const [selExchange,   setSelExchange]   = useState('');
  const [selCab,        setSelCab]        = useState('');
  const [selDp,         setSelDp]         = useState('');
  const [selCircuit,    setSelCircuit]    = useState('');
  const [circLoading,   setCircLoading]   = useState({});
  const [attaching,     setAttaching]     = useState(false);

  // Cause tab (Stage 2) — cascading TypeOfFault -> CauseCategory -> CauseOfFault picker,
  // Admin/Team-Lead post-hoc classification of the Technician's Stage-1 free-text causeOfFault.
  const [causeTypes,      setCauseTypes]      = useState([]);
  const [causeCategories, setCauseCategories] = useState([]);
  const [causeOfFaults,   setCauseOfFaults]   = useState([]);
  const [selCauseType,    setSelCauseType]    = useState('');
  const [selCauseCategory,setSelCauseCategory]= useState('');
  const [selCauseOfFault, setSelCauseOfFault] = useState('');
  const [causeLoading,    setCauseLoading]    = useState({});
  const [attachingCause,  setAttachingCause]  = useState(false);

  useEffect(() => {
    if (!fault || !open) return;
    setTab('timeline');
    setTimeline([]); setNotes([]); setPhotos([]);
    setCircOpmcs([]); setCircExchanges([]); setCircCabs([]); setCircDps([]); setCircCircuits([]);
    setSelOpmc(''); setSelExchange(''); setSelCab(''); setSelDp(''); setSelCircuit('');
    setCauseTypes([]); setCauseCategories([]); setCauseOfFaults([]);
    setSelCauseType(''); setSelCauseCategory(''); setSelCauseOfFault('');
  }, [fault?.id, open]);

  // Cause tab — load TypeOfFaults the first time the tab is opened.
  useEffect(() => {
    if (!fault || !open || tab !== 'cause' || causeTypes.length) return;
    setCauseLoading(p => ({ ...p, type: true }));
    get('/api/type-of-faults')
        .then(d => setCauseTypes(Array.isArray(d) ? d : []))
        .catch(() => {})
        .finally(() => setCauseLoading(p => ({ ...p, type: false })));
  }, [fault?.id, open, tab, causeTypes.length]);

  // Cascade: TypeOfFault -> CauseCategory
  useEffect(() => {
    setCauseCategories([]); setSelCauseCategory('');
    setCauseOfFaults([]); setSelCauseOfFault('');
    if (!selCauseType) return;
    setCauseLoading(p => ({ ...p, category: true }));
    get(`/api/cause-categories?typeOfFaultId=${selCauseType}`)
        .then(d => setCauseCategories(Array.isArray(d) ? d : []))
        .catch(() => {})
        .finally(() => setCauseLoading(p => ({ ...p, category: false })));
  }, [selCauseType]);

  // Cascade: CauseCategory -> CauseOfFault
  useEffect(() => {
    setCauseOfFaults([]); setSelCauseOfFault('');
    if (!selCauseCategory) return;
    setCauseLoading(p => ({ ...p, cause: true }));
    get(`/api/cause-of-faults?causeCategoryId=${selCauseCategory}`)
        .then(d => setCauseOfFaults(Array.isArray(d) ? d : []))
        .catch(() => {})
        .finally(() => setCauseLoading(p => ({ ...p, cause: false })));
  }, [selCauseCategory]);

  const doAttachCause = async () => {
    if (!selCauseOfFault) return;
    setAttachingCause(true);
    try {
      await patch(`/api/faults/${fault.id}/cause`, { causeId: Number(selCauseOfFault) });
      onSuccess('Cause classified for fault', 'success');
      onClose();
    } catch (e) { onSuccess('Classification failed', 'error'); }
    finally { setAttachingCause(false); }
  };

  // Circuit tab — load Opmcs the first time the tab is opened.
  useEffect(() => {
    if (!fault || !open || tab !== 'circuit' || circOpmcs.length) return;
    setCircLoading(p => ({ ...p, opmc: true }));
    get('/api/opmcs?status=ACTIVE')
        .then(d => setCircOpmcs(Array.isArray(d) ? d : []))
        .catch(() => {})
        .finally(() => setCircLoading(p => ({ ...p, opmc: false })));
  }, [fault?.id, open, tab, circOpmcs.length]);

  // Cascade: Opmc -> Exchange
  useEffect(() => {
    setCircExchanges([]); setSelExchange('');
    setCircCabs([]); setSelCab('');
    setCircDps([]); setSelDp('');
    setCircCircuits([]); setSelCircuit('');
    if (!selOpmc) return;
    setCircLoading(p => ({ ...p, exchange: true }));
    get(`/api/exchanges?opmcId=${selOpmc}`)
        .then(d => setCircExchanges(Array.isArray(d) ? d : []))
        .catch(() => {})
        .finally(() => setCircLoading(p => ({ ...p, exchange: false })));
  }, [selOpmc]);

  // Cascade: Exchange -> Cab
  useEffect(() => {
    setCircCabs([]); setSelCab('');
    setCircDps([]); setSelDp('');
    setCircCircuits([]); setSelCircuit('');
    if (!selExchange) return;
    setCircLoading(p => ({ ...p, cab: true }));
    get(`/api/cabs?exchangeId=${selExchange}`)
        .then(d => setCircCabs(Array.isArray(d) ? d : []))
        .catch(() => {})
        .finally(() => setCircLoading(p => ({ ...p, cab: false })));
  }, [selExchange]);

  // Cascade: Cab -> Dp
  useEffect(() => {
    setCircDps([]); setSelDp('');
    setCircCircuits([]); setSelCircuit('');
    if (!selCab) return;
    setCircLoading(p => ({ ...p, dp: true }));
    get(`/api/dps?cabId=${selCab}`)
        .then(d => setCircDps(Array.isArray(d) ? d : []))
        .catch(() => {})
        .finally(() => setCircLoading(p => ({ ...p, dp: false })));
  }, [selCab]);

  // Cascade: Dp -> Circuit. DP:Circuit is close to 1:1 in the real data (H1a's master-data
  // import) — auto-select when there's exactly one, skipping a redundant click in the common case.
  useEffect(() => {
    setCircCircuits([]); setSelCircuit('');
    if (!selDp) return;
    setCircLoading(p => ({ ...p, circuit: true }));
    get(`/api/circuits?dpId=${selDp}`)
        .then(d => {
          const list = Array.isArray(d) ? d : [];
          setCircCircuits(list);
          if (list.length === 1) setSelCircuit(String(list[0].id));
        })
        .catch(() => {})
        .finally(() => setCircLoading(p => ({ ...p, circuit: false })));
  }, [selDp]);

  const doAttachCircuit = async () => {
    if (!selCircuit) return;
    setAttaching(true);
    try {
      await patch(`/api/faults/${fault.id}/circuit`, { circuitId: Number(selCircuit) });
      onSuccess('Circuit attached to fault', 'success');
      onClose();
    } catch (e) { onSuccess('Attach failed', 'error'); }
    finally { setAttaching(false); }
  };

  useEffect(() => {
    if (!fault || !open) return;
    if (tab === 'timeline') {
      setTlLoading(true);
      get(`/api/faults/${fault.id}/timeline`)
          .then(d => setTimeline(Array.isArray(d) ? d : []))
          .catch(() => {})
          .finally(() => setTlLoading(false));
    }
    if (tab === 'notes') {
      get(`/api/faults/${fault.id}/notes?internal=true`)
          .then(d => setNotes(Array.isArray(d) ? d : []))
          .catch(() => {});
    }
    if (tab === 'photos') {
      setPhotosLoading(true);
      // FaultDTO.photoUrls is a comma-separated string (see FaultService.joinPhotoUrls), not an array.
      const toList = (v) => (v || '').split(',').map(s => s.trim()).filter(Boolean);
      get(`/api/faults/${fault.id}`)
          .then(d => setPhotos(toList(d?.photoUrls)))
          .catch(() => setPhotos(toList(fault.photoUrls)))
          .finally(() => setPhotosLoading(false));
    }
  }, [fault?.id, tab, open]);

  // Photos are served from the backend's static /uploads/** route, not the /api host —
  // resolve relative paths against the API's origin, not its /api base path.
  const photoUrl = (p) => {
    const path = typeof p === 'string' ? p : (p?.url || p?.path || '');
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return `${API}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const submitNote = async () => {
    if (!noteText.trim()) return;
    setPosting(true);
    try {
      await post(`/api/faults/${fault.id}/notes`, {
        content: noteText, isInternal, noteType:'GENERAL',
      });
      setNoteText('');
      const d = await get(`/api/faults/${fault.id}/notes?internal=true`);
      setNotes(Array.isArray(d) ? d : []);
    } catch (e) {} finally { setPosting(false); }
  };

  const isAdminUser = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  // SRS 5.5.1 (v1.9) — Admin assigns a fault to a Work Group, never directly to a
  // person; the Work Group's own Team Lead then self-assigns or dispatches to a
  // Technician from the mobile app. Direct Admin-to-Technician assignment was
  // retired entirely (Critical #2's original behaviour, now superseded — see
  // QA_Compliance_Consolidated_Report.md).
  const activeWorkGroups = (workGroups || []).filter(wg => wg.isActive);

  const doAssign = async () => {
    if (!assignWg) return;
    setAssigning(true);
    try {
      const payload = { workGroupId: Number(assignWg), priority: assignPri, notes: assignNotes, notifyTeamLead: true, notifyCustomer: true };
      await post(`/api/faults/${fault.id}/assign`, payload);
      onSuccess('Fault assigned to Work Group', 'success');
      onClose();
    } catch (e) { onSuccess('Assignment failed', 'error'); }
    finally { setAssigning(false); }
  };

  const doReassign = async () => {
    if (!reassignWg || !reassignReason.trim()) return;
    setReassigning(true);
    try {
      const payload = { newWorkGroupId: Number(reassignWg), reason: reassignReason, notifyTeamLead: true, notifyPreviousTeamLead: true };
      await post(`/api/faults/${fault.id}/reassign`, payload);
      onSuccess('Fault reassigned to a different Work Group', 'success');
      onClose();
    } catch (e) { onSuccess('Reassignment failed', 'error'); }
    finally { setReassigning(false); }
  };

  const doEscalate = async () => {
    if (!escalateReason.trim()) return;
    setEscalating(true);
    try {
      await post(`/api/faults/${fault.id}/escalate`, {
        reason: escalateReason, notifyAdmin: true,
      });
      onSuccess('Fault escalated to HIGH priority', 'warning');
      onClose();
    } catch (e) { onSuccess('Escalation failed', 'error'); }
    finally { setEscalating(false); }
  };

  if (!fault) return null;

  const TABS = [
    { id:'timeline', label:'🕐 Timeline' },
    { id:'photos',   label:'📷 Photos' },
    { id:'notes',    label:'💬 Notes' },
    { id:'assign',   label:'🔧 Assign' },
    { id:'reassign', label:'🔄 Reassign' },
    { id:'escalate', label:'⚠️ Escalate' },
    { id:'circuit',  label:'🔗 Circuit' },
    { id:'cause',    label:'🔍 Cause' },
  ];

  const TIMELINE_ICONS = {
    FAULT_CREATED:   '📋', FAULT_ASSIGNED: '🔧',
    FAULT_REASSIGNED:'🔄', FAULT_ESCALATED:'⚠️',
    STATUS_CHANGED:  '🔁', NOTE_ADDED:     '💬',
    FAULT_COMPLETED: '✅', FAULT_CANCELLED:'❌',
    PAYMENT_SUBMITTED:'💰',
  };
  const TL_COLORS = {
    FAULT_CREATED:'#58A6FF',   FAULT_ASSIGNED:'#BC8CFF',
    FAULT_REASSIGNED:'#D29922',FAULT_ESCALATED:'#F85149',
    FAULT_COMPLETED:'#3FB950', NOTE_ADDED:'#39D353',
  };

  return (
      <Modal
          open={open} onClose={onClose} width={760}
          title={`Fault #${fault.id}`}
          subtitle={fault.address || fault.description?.slice(0,60)}
      >
        {/* Fault meta strip */}
        <div style={{
          padding:'12px 24px', display:'flex', gap:10, flexWrap:'wrap',
          borderBottom:`1px solid ${C.border}`, alignItems:'center',
        }}>
          <StatusBadge status={fault.status} />
          <PriBadge priority={fault.priority} />
          <span style={{
            padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700,
            background:C.surface2, color:C.muted, border:`1px solid ${C.border}`,
          }}>
          {fault.category || 'OTHER'}
        </span>
          {fault.assignedTo ? (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:'auto' }}>
                <Avatar name={fault.assignedTo.fullName} size={22} />
                <span style={{ fontSize:12, color:C.muted }}>
              {fault.assignedTo.fullName}
            </span>
              </div>
          ) : fault.workGroupName && (
              <span style={{
                marginLeft:'auto', fontSize:11, padding:'3px 9px', borderRadius:20,
                background:'#1C2333', color:C.purple, border:`1px solid ${C.purple}33`,
              }}>
              👥 {fault.workGroupName} (unclaimed)
            </span>
          )}
          <span style={{ fontSize:11, color:C.muted, marginLeft: (fault.assignedTo || fault.workGroupName) ? 0 : 'auto' }}>
          {fmtTime(fault.createdAt)}
        </span>
        </div>

        {/* Tabs */}
        <div style={{
          display:'flex', gap:2, padding:'12px 24px 0',
          borderBottom:`1px solid ${C.border}`, flexWrap:'wrap',
        }}>
          {TABS.map(t => (
              <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    background: tab===t.id ? C.surface2 : 'none',
                    border: tab===t.id ? `1px solid ${C.border}` : '1px solid transparent',
                    borderBottom: tab===t.id ? `1px solid ${C.surface}` : '1px solid transparent',
                    borderRadius:'8px 8px 0 0', marginBottom:-1,
                    padding:'8px 14px', cursor:'pointer', fontSize:12, fontWeight:600,
                    color: tab===t.id ? C.accent : C.muted,
                    transition:'all 0.12s', fontFamily:'DM Mono,monospace',
                  }}
              >
                {t.label}
              </button>
          ))}
        </div>

        <div style={{ padding:'20px 24px', minHeight:320 }}>

          {/* TIMELINE */}
          {tab === 'timeline' && (
              <div>
                {tlLoading ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      {[...Array(4)].map((_, i) => (
                          <div key={i} style={{ display:'flex', gap:12 }}>
                            <Skeleton h={32} w={32} r={16} />
                            <div style={{ flex:1 }}>
                              <Skeleton h={13} r={6} />
                              <div style={{ marginTop:6 }}><Skeleton h={11} w='60%' r={5} /></div>
                            </div>
                          </div>
                      ))}
                    </div>
                ) : timeline.length === 0 ? (
                    <div style={{ textAlign:'center', padding:40, color:C.muted, fontSize:13 }}>
                      No timeline events yet
                    </div>
                ) : (
                    <div style={{ position:'relative' }}>
                      {/* vertical line */}
                      <div style={{
                        position:'absolute', left:15, top:0, bottom:0,
                        width:1, background:C.border,
                      }} />
                      {timeline.map((ev, i) => {
                        const ic = TIMELINE_ICONS[ev.eventType] || '📌';
                        const col = TL_COLORS[ev.eventType] || C.muted;
                        return (
                            <div key={i} style={{
                              display:'flex', gap:16, marginBottom:20,
                              position:'relative', paddingLeft:4,
                              animation:`flt-fadein 0.3s ease ${i*0.04}s both`,
                            }}>
                              <div style={{
                                width:30, height:30, borderRadius:'50%',
                                background:C.surface2, border:`2px solid ${col}55`,
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:13, flexShrink:0, zIndex:1,
                                boxShadow:`0 0 8px ${col}33`,
                              }}>
                                {ic}
                              </div>
                              <div style={{ flex:1, paddingTop:4 }}>
                                <div style={{
                                  fontSize:13, fontWeight:700, color:C.text,
                                  fontFamily:'Bricolage Grotesque,sans-serif',
                                }}>
                                  {ev.title}
                                </div>
                                {ev.description && (
                                    <div style={{ fontSize:12, color:C.muted, marginTop:3, lineHeight:1.5 }}>
                                      {ev.description}
                                    </div>
                                )}
                                {(ev.previousValue || ev.newValue) && (
                                    <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:5 }}>
                                      {ev.previousValue && (
                                          <span style={{
                                            fontSize:11, padding:'2px 7px', borderRadius:4,
                                            background:'#3D1F1F', color:C.red,
                                          }}>
                                {ev.previousValue}
                              </span>
                                      )}
                                      {ev.previousValue && ev.newValue && (
                                          <span style={{ color:C.muted, fontSize:11 }}>→</span>
                                      )}
                                      {ev.newValue && (
                                          <span style={{
                                            fontSize:11, padding:'2px 7px', borderRadius:4,
                                            background:'#1C2D1C', color:C.green,
                                          }}>
                                {ev.newValue}
                              </span>
                                      )}
                                    </div>
                                )}
                                <div style={{
                                  display:'flex', gap:10, marginTop:5, alignItems:'center',
                                }}>
                                  {ev.actorName && (
                                      <span style={{ fontSize:11, color:C.accent }}>{ev.actorName}</span>
                                  )}
                                  <span style={{ fontSize:11, color:C.muted }}>{timeAgo(ev.timestamp)}</span>
                                </div>
                              </div>
                            </div>
                        );
                      })}
                    </div>
                )}
              </div>
          )}

          {/* PHOTOS */}
          {tab === 'photos' && (
              <div>
                {photosLoading ? (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                      {[...Array(3)].map((_, i) => <Skeleton key={i} h={110} r={10} />)}
                    </div>
                ) : photos.length === 0 ? (
                    <div style={{ textAlign:'center', padding:40, color:C.muted, fontSize:13 }}>
                      No photos attached to this fault
                    </div>
                ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                      {photos.map((p, i) => (
                          <div
                              key={i}
                              onClick={() => setLightbox(photoUrl(p))}
                              style={{
                                height:110, borderRadius:10, overflow:'hidden',
                                border:`1px solid ${C.border}`, cursor:'pointer',
                                background:C.surface2,
                              }}
                          >
                            <img
                                src={photoUrl(p)}
                                alt={`Fault photo ${i+1}`}
                                style={{ width:'100%', height:'100%', objectFit:'cover' }}
                            />
                          </div>
                      ))}
                    </div>
                )}
                {lightbox && (
                    <div
                        onClick={() => setLightbox(null)}
                        style={{
                          position:'fixed', inset:0, zIndex:1100,
                          background:'rgba(1,4,9,0.92)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          cursor:'zoom-out', padding:32,
                        }}
                    >
                      <img
                          src={lightbox} alt="Fault photo full size"
                          style={{ maxWidth:'100%', maxHeight:'100%', borderRadius:8 }}
                      />
                    </div>
                )}
              </div>
          )}

          {/* NOTES */}
          {tab === 'notes' && (
              <div>
                {/* Add note */}
                <div style={{
                  background:C.surface2, borderRadius:10, padding:14,
                  border:`1px solid ${C.border}`, marginBottom:20,
                }}>
              <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Write a note about this fault…"
                  rows={3}
                  style={{
                    width:'100%', background:'none', border:'none',
                    color:C.text, fontSize:13, resize:'vertical',
                    outline:'none', fontFamily:'DM Mono,monospace',
                    lineHeight:1.6,
                  }}
              />
                  <div style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}`,
                  }}>
                    <label style={{
                      display:'flex', alignItems:'center', gap:6,
                      fontSize:12, color:C.muted, cursor:'pointer',
                    }}>
                      <input
                          type="checkbox" checked={isInternal}
                          onChange={e => setIsInternal(e.target.checked)}
                          style={{ accentColor:C.orange }}
                      />
                      Internal only
                    </label>
                    <Btn
                        variant="primary" onClick={submitNote}
                        disabled={!noteText.trim() || posting}
                    >
                      {posting ? '…' : '+ Add Note'}
                    </Btn>
                  </div>
                </div>

                {/* Notes list */}
                {notes.length === 0 ? (
                    <div style={{ textAlign:'center', padding:32, color:C.muted, fontSize:13 }}>
                      No notes yet — be the first
                    </div>
                ) : (
                    notes.map((n, i) => (
                        <div key={i} style={{
                          background:C.surface2, borderRadius:10, padding:14,
                          border:`1px solid ${n.isInternal ? C.orange+'44' : C.border}`,
                          marginBottom:10,
                          animation:`flt-fadein 0.25s ease ${i*0.05}s both`,
                        }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <Avatar name={n.authorName} size={24} />
                              <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{n.authorName}</span>
                              <span style={{
                                fontSize:10, padding:'2px 6px', borderRadius:4,
                                background: n.isInternal ? '#2D2200' : C.surface,
                                color: n.isInternal ? C.orange : C.muted,
                                border:`1px solid ${n.isInternal ? C.orange+'33' : C.border}`,
                              }}>
                        {n.isInternal ? '🔒 Internal' : '🌐 Public'}
                      </span>
                            </div>
                            <span style={{ fontSize:11, color:C.muted }}>{timeAgo(n.createdAt)}</span>
                          </div>
                          <div style={{ fontSize:13, color:C.text, lineHeight:1.6 }}>
                            {n.content}
                          </div>
                        </div>
                    ))
                )}
              </div>
          )}

          {/* ASSIGN */}
          {tab === 'assign' && (
              <div>
                {!isAdminUser ? (
                    <div style={{
                      background:'#1C2333', borderRadius:10, padding:14,
                      border:`1px solid ${C.accentD}33`, fontSize:12, color:C.muted, lineHeight:1.6,
                    }}>
                      ℹ️ Team Leads self-assign and dispatch faults from their Work Group's queue in
                      the mobile app, not here. This tab is for OPMC Admins assigning a fault to a
                      Work Group.
                    </div>
                ) : (
                    <>
                      <div style={{
                        background:'#1C2333', borderRadius:10, padding:14,
                        border:`1px solid ${C.accentD}33`, marginBottom:20, fontSize:12,
                        color:C.muted, lineHeight:1.6,
                      }}>
                        ℹ️ Assign this fault to a Work Group. It lands in that Work Group's incoming
                        queue — its Team Lead then self-assigns it or dispatches it to one of their
                        own Technicians from the mobile app.
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                        <div>
                          <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
                            WORK GROUP *
                          </label>
                          <Select value={assignWg} onChange={setAssignWg} style={{ width:'100%' }}>
                            <option value="">— Select Work Group —</option>
                            {activeWorkGroups.map(wg => (
                                <option key={wg.id} value={wg.id}>
                                  {wg.name}{wg.teamLeadName ? ` — Team Lead: ${wg.teamLeadName}` : ' — no Team Lead assigned'}
                                </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
                            PRIORITY OVERRIDE
                          </label>
                          <Select value={assignPri} onChange={setAssignPri} style={{ width:'100%' }}>
                            <option value="HIGH">HIGH — Critical</option>
                            <option value="MEDIUM">MEDIUM — Normal</option>
                            <option value="LOW">LOW — When available</option>
                          </Select>
                        </div>
                        <div>
                          <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
                            NOTES (optional)
                          </label>
                          <Input
                              value={assignNotes}
                              onChange={setAssignNotes}
                              placeholder="Assignment notes for the Work Group…"
                          />
                        </div>
                        <Btn
                            variant="primary" onClick={doAssign}
                            disabled={!assignWg || assigning}
                            style={{ alignSelf:'flex-end', padding:'9px 20px', fontSize:13 }}
                        >
                          {assigning ? '⏳ Assigning…' : '🔧 Assign to Work Group'}
                        </Btn>
                      </div>
                    </>
                )}
              </div>
          )}

          {/* REASSIGN */}
          {tab === 'reassign' && (
              <div>
                {!isAdminUser ? (
                    <div style={{
                      background:'#1C2333', borderRadius:10, padding:14,
                      border:`1px solid ${C.accentD}33`, fontSize:12, color:C.muted, lineHeight:1.6,
                    }}>
                      ℹ️ Reassigning to a different Work Group is an OPMC Admin action.
                    </div>
                ) : (
                    <>
                      {fault.workGroupName ? (
                          <div style={{
                            display:'flex', alignItems:'center', gap:10,
                            background:C.surface2, borderRadius:10, padding:12,
                            border:`1px solid ${C.border}`, marginBottom:16, fontSize:12,
                          }}>
                            <span style={{ color:C.muted }}>Currently assigned to Work Group:</span>
                            <span style={{ color:C.text, fontWeight:700 }}>👥 {fault.workGroupName}</span>
                            {fault.assignedTo && (
                                <span style={{ color:C.muted }}>(claimed by {fault.assignedTo.fullName})</span>
                            )}
                          </div>
                      ) : (
                          <div style={{
                            background:'#3D1F1F', borderRadius:10, padding:12,
                            border:`1px solid ${C.red}33`, marginBottom:16,
                            fontSize:12, color:C.red,
                          }}>
                            ⚠️ This fault is not yet assigned to a Work Group. Use the Assign tab instead.
                          </div>
                      )}
                      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                        <div>
                          <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
                            NEW WORK GROUP *
                          </label>
                          <Select value={reassignWg} onChange={setReassignWg} style={{ width:'100%' }}>
                            <option value="">— Select new Work Group —</option>
                            {activeWorkGroups
                                .filter(wg => wg.id !== fault.workGroupId)
                                .map(wg => (
                                    <option key={wg.id} value={wg.id}>
                                      {wg.name}{wg.teamLeadName ? ` — Team Lead: ${wg.teamLeadName}` : ' — no Team Lead assigned'}
                                    </option>
                                ))}
                          </Select>
                        </div>
                        <div>
                          <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
                            REASON FOR REASSIGNMENT *
                          </label>
                          <Input
                              value={reassignReason}
                              onChange={setReassignReason}
                              placeholder="Why is this being reassigned? (required)"
                          />
                        </div>
                        <Btn
                            variant="warning" onClick={doReassign}
                            disabled={!reassignWg || !reassignReason.trim() || reassigning}
                            style={{ alignSelf:'flex-end', padding:'9px 20px', fontSize:13 }}
                        >
                          {reassigning ? '⏳ Reassigning…' : '🔄 Reassign to Work Group'}
                        </Btn>
                      </div>
                    </>
                )}
              </div>
          )}

          {/* ESCALATE */}
          {tab === 'escalate' && (
              <div>
                <div style={{
                  background:'#3D1F1F', borderRadius:10, padding:14,
                  border:`1px solid ${C.red}44`, marginBottom:16,
                  fontSize:12, color:C.red, lineHeight:1.6,
                }}>
                  ⚠️ Escalating will set this fault to <b>HIGH priority</b> and notify all admins immediately. Use only for critical or SLA-breach situations.
                </div>
                {fault.priority === 'HIGH' && (
                    <div style={{
                      background:'#2D2200', borderRadius:10, padding:12,
                      border:`1px solid ${C.orange}33`, marginBottom:16,
                      fontSize:12, color:C.orange,
                    }}>
                      ℹ️ This fault is already HIGH priority.
                    </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
                      ESCALATION REASON *
                    </label>
                    <textarea
                        value={escalateReason}
                        onChange={e => setEscalateReason(e.target.value)}
                        placeholder="Describe why escalation is needed (e.g. VIP customer, SLA breach, safety concern)…"
                        rows={4}
                        style={{
                          width:'100%', background:C.surface2,
                          border:`1px solid ${C.border}`, borderRadius:8,
                          color:C.text, fontSize:13, resize:'vertical',
                          outline:'none', padding:'10px 12px',
                          fontFamily:'DM Mono,monospace', lineHeight:1.6,
                        }}
                        onFocus={e => e.target.style.borderColor=C.red}
                        onBlur={e => e.target.style.borderColor=C.border}
                    />
                  </div>
                  <Btn
                      variant="danger" onClick={doEscalate}
                      disabled={!escalateReason.trim() || escalating}
                      style={{ alignSelf:'flex-end', padding:'9px 20px', fontSize:13 }}
                  >
                    {escalating ? '⏳ Escalating…' : '⚠️ Escalate to HIGH'}
                  </Btn>
                </div>
              </div>
          )}

          {/* CIRCUIT (H1c) */}
          {tab === 'circuit' && (
              <div>
                <div style={{
                  background:'#1C2333', borderRadius:10, padding:14,
                  border:`1px solid ${C.accentD}33`, marginBottom:16, fontSize:12,
                  color:C.muted, lineHeight:1.6,
                }}>
                  ℹ️ Attach the specific Exchange → Cab → DP → Circuit this fault's infrastructure
                  actually runs through. Pick each level in order — each selection filters the next.
                </div>
                {fault.circuitCode && (
                    <div style={{
                      display:'flex', alignItems:'center', gap:10,
                      background:C.surface2, borderRadius:10, padding:12,
                      border:`1px solid ${C.border}`, marginBottom:16, fontSize:12,
                    }}>
                      <span style={{ color:C.muted }}>Currently attached:</span>
                      <span style={{ color:C.text, fontWeight:700 }}>🔗 Circuit {fault.circuitCode}</span>
                    </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
                      OPMC *
                    </label>
                    <Select value={selOpmc} onChange={setSelOpmc} style={{ width:'100%' }}>
                      <option value="">
                        {circLoading.opmc ? 'Loading…' : '— Select OPMC —'}
                      </option>
                      {circOpmcs.map(o => (
                          <option key={o.id} value={o.id}>{o.code} — {o.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
                      EXCHANGE *
                    </label>
                    <Select value={selExchange} onChange={setSelExchange} style={{ width:'100%' }}>
                      <option value="">
                        {!selOpmc ? '— Select an OPMC first —' : circLoading.exchange ? 'Loading…'
                            : circExchanges.length === 0 ? '— No Exchanges for this OPMC —' : '— Select Exchange —'}
                      </option>
                      {circExchanges.map(e => (
                          <option key={e.id} value={e.id}>{e.code} — {e.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
                      CAB *
                    </label>
                    <Select value={selCab} onChange={setSelCab} style={{ width:'100%' }}>
                      <option value="">
                        {!selExchange ? '— Select an Exchange first —' : circLoading.cab ? 'Loading…'
                            : circCabs.length === 0 ? '— No Cabs for this Exchange —' : '— Select Cab —'}
                      </option>
                      {circCabs.map(c => (
                          <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
                      DP *
                    </label>
                    <Select value={selDp} onChange={setSelDp} style={{ width:'100%' }}>
                      <option value="">
                        {!selCab ? '— Select a Cab first —' : circLoading.dp ? 'Loading…'
                            : circDps.length === 0 ? '— No DPs for this Cab —' : '— Select DP —'}
                      </option>
                      {circDps.map(d => (
                          <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
                      CIRCUIT *
                    </label>
                    <Select value={selCircuit} onChange={setSelCircuit} style={{ width:'100%' }}>
                      <option value="">
                        {!selDp ? '— Select a DP first —' : circLoading.circuit ? 'Loading…'
                            : circCircuits.length === 0 ? '— No Circuits for this DP —' : '— Select Circuit —'}
                      </option>
                      {circCircuits.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.code}{c.circuitCategoryCode ? ` — ${c.circuitCategoryCode}` : ''}
                          </option>
                      ))}
                    </Select>
                  </div>
                  <Btn
                      variant="primary" onClick={doAttachCircuit}
                      disabled={!selCircuit || attaching}
                      style={{ alignSelf:'flex-end', padding:'9px 20px', fontSize:13 }}
                  >
                    {attaching ? '⏳ Attaching…' : '🔗 Attach Circuit'}
                  </Btn>
                </div>
              </div>
          )}

          {/* CAUSE (Stage 2) — Admin/Team-Lead post-hoc structured classification, using the
              Technician's Stage-1 free-text causeOfFault as real diagnostic input. */}
          {tab === 'cause' && (
              <div>
                <div style={{
                  background:'#1C2333', borderRadius:10, padding:14,
                  border:`1px solid ${C.accentD}33`, marginBottom:16, fontSize:12,
                  color:C.muted, lineHeight:1.6,
                }}>
                  ℹ️ Classify the real cause of this fault against the master cause list. Pick a
                  Fault Type, then a Cause Category, then the specific Cause — each selection
                  filters the next.
                </div>

                {/* Technician's Stage-1 free-text finding, prominently at the top so the reviewer
                    classifies based on real diagnostic input, not guesswork. */}
                <div style={{
                  background:C.surface2, borderRadius:10, padding:14,
                  border:`1px solid ${fault.causeOfFault ? C.orange+'55' : C.border}`,
                  marginBottom:16,
                }}>
                  <div style={{ fontSize:10, fontWeight:800, color:C.muted, letterSpacing:0.6, marginBottom:6 }}>
                    🔍 WHAT THE TECHNICIAN FOUND
                  </div>
                  {fault.causeOfFault ? (
                      <div style={{ fontSize:13, color:C.text, lineHeight:1.5 }}>{fault.causeOfFault}</div>
                  ) : (
                      <div style={{ fontSize:12, color:C.muted, fontStyle:'italic' }}>
                        No free-text finding recorded by the Technician on this fault yet.
                      </div>
                  )}
                </div>

                {fault.causeCode && (
                    <div style={{
                      display:'flex', alignItems:'center', gap:10,
                      background:C.surface2, borderRadius:10, padding:12,
                      border:`1px solid ${C.border}`, marginBottom:16, fontSize:12,
                    }}>
                      <span style={{ color:C.muted }}>Currently classified:</span>
                      <span style={{ color:C.text, fontWeight:700 }}>🔍 Cause {fault.causeCode}</span>
                    </div>
                )}

                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
                      FAULT TYPE *
                    </label>
                    <Select value={selCauseType} onChange={setSelCauseType} style={{ width:'100%' }}>
                      <option value="">
                        {causeLoading.type ? 'Loading…' : '— Select Fault Type —'}
                      </option>
                      {causeTypes.map(t => (
                          <option key={t.id} value={t.id}>{t.typeCode} — {t.description}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
                      CAUSE CATEGORY *
                    </label>
                    <Select value={selCauseCategory} onChange={setSelCauseCategory} style={{ width:'100%' }}>
                      <option value="">
                        {!selCauseType ? '— Select a Fault Type first —' : causeLoading.category ? 'Loading…'
                            : causeCategories.length === 0 ? '— No Cause Categories for this Type —' : '— Select Cause Category —'}
                      </option>
                      {causeCategories.map(c => (
                          <option key={c.id} value={c.id}>{c.causeCategoryCode} — {c.description}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
                      CAUSE OF FAULT *
                    </label>
                    <Select value={selCauseOfFault} onChange={setSelCauseOfFault} style={{ width:'100%' }}>
                      <option value="">
                        {!selCauseCategory ? '— Select a Cause Category first —' : causeLoading.cause ? 'Loading…'
                            : causeOfFaults.length === 0 ? '— No Causes for this Category —' : '— Select Cause —'}
                      </option>
                      {causeOfFaults.map(c => (
                          <option key={c.id} value={c.id}>{c.causeCode} — {c.description}</option>
                      ))}
                    </Select>
                  </div>
                  <Btn
                      variant="primary" onClick={doAttachCause}
                      disabled={!selCauseOfFault || attachingCause}
                      style={{ alignSelf:'flex-end', padding:'9px 20px', fontSize:13 }}
                  >
                    {attachingCause ? '⏳ Classifying…' : '🔍 Classify Cause'}
                  </Btn>
                </div>
              </div>
          )}
        </div>
      </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BULK ASSIGN MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function BulkAssignModal({ faultIds, workGroups, open, onClose, onSuccess }) {
  const [wgId,     setWgId]     = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [notes,    setNotes]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const activeWorkGroups = (workGroups || []).filter(wg => wg.isActive);

  const doAssign = async () => {
    if (!wgId) return;
    setLoading(true);
    try {
      const payload = { faultIds, workGroupId: Number(wgId), priority, notes, notifyTeamLead: true };
      const res = await post('/api/faults/bulk-assign', payload);
      onSuccess(
          `Bulk assigned: ${res.successCount}/${res.totalRequested} faults`,
          res.failureCount > 0 ? 'warning' : 'success'
      );
      onClose();
    } catch (e) {
      onSuccess('Bulk assignment failed', 'error');
    } finally { setLoading(false); }
  };

  return (
      <Modal
          open={open} onClose={onClose} width={520}
          title="Bulk Assign Faults"
          subtitle={`${faultIds.length} fault${faultIds.length !== 1 ? 's' : ''} selected`}
      >
        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{
            background:C.surface2, borderRadius:10, padding:12,
            border:`1px solid ${C.border}`, fontSize:12, color:C.muted,
            lineHeight:1.6,
          }}>
            All selected faults will be assigned to one Work Group's incoming queue. Its Team Lead
            then self-assigns or dispatches each one to a Technician.
          </div>
          <div>
            <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
              WORK GROUP *
            </label>
            <Select value={wgId} onChange={setWgId} style={{ width:'100%' }}>
              <option value="">— Select Work Group —</option>
              {activeWorkGroups.map(wg => (
                  <option key={wg.id} value={wg.id}>
                    {wg.name}{wg.teamLeadName ? ` — Team Lead: ${wg.teamLeadName}` : ' — no Team Lead assigned'}
                  </option>
              ))}
            </Select>
          </div>
          <div>
            <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
              PRIORITY
            </label>
            <Select value={priority} onChange={setPriority} style={{ width:'100%' }}>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </Select>
          </div>
          <div>
            <label style={{ fontSize:11, color:C.muted, fontWeight:700, display:'block', marginBottom:5 }}>
              NOTES (optional)
            </label>
            <Input value={notes} onChange={setNotes} placeholder="Assignment notes…" />
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', paddingTop:4 }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={doAssign} disabled={!wgId || loading}>
              {loading ? '⏳ Assigning…' : `🔧 Assign ${faultIds.length} Faults`}
            </Btn>
          </div>
        </div>
      </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function FaultsPage() {
  const { user: currentUser } = useAuth();
  const [faults,      setFaults]      = useState([]);
  const [workGroups,  setWorkGroups]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(new Set());
  const [detail,      setDetail]      = useState(null);
  const [bulkOpen,    setBulkOpen]    = useState(false);
  const [toast,       setToast]       = useState(null);

  // Filters
  const [search,    setSearch]    = useState('');
  const [fStatus,   setFStatus]   = useState('ALL');
  const [fPriority, setFPriority] = useState('ALL');
  const [fCategory, setFCategory] = useState('ALL');
  const [fDateFrom, setFDateFrom] = useState('');
  const [fDateTo,   setFDateTo]   = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir,   setSortDir]   = useState('desc');
  const [page,      setPage]      = useState(1);
  const PAGE_SIZE = 20;

  // ─── Load data ─────────────────────────────────────────────────────────────
  const fetchFaults = useCallback(async () => {
    setLoading(true);
    try {
      // SUPER_ADMIN sees every Work Group system-wide (SRS 5.5.6); an OPMC Admin
      // only sees their own OPMC's — scoped server-side off the caller's own
      // record, same as GET /api/faults (RES-023), not a client-trusted param.
      const wgPath = currentUser?.role === 'SUPER_ADMIN'
          ? '/api/workgroups'
          : `/api/workgroups?opmcId=${currentUser?.opmcId}`;
      const [f, wg] = await Promise.all([
        get('/api/faults?size=500&sort=createdAt,desc'),
        get(wgPath),
      ]);
      setFaults(Array.isArray(f) ? f : f?.content || []);
      setWorkGroups(Array.isArray(wg) ? wg : []);
    } catch (e) {
      console.error('Faults fetch error:', e);
    } finally { setLoading(false); }
  }, [currentUser]);

  useEffect(() => { fetchFaults(); }, [fetchFaults]);

  const showToast = (msg, type='success') => setToast({ msg, type });

  // ─── Filter + sort ─────────────────────────────────────────────────────────
  const filtered = faults
      .filter(f => {
        const q = search.toLowerCase();
        if (q && !(
            String(f.id).includes(q) ||
            f.description?.toLowerCase().includes(q) ||
            f.address?.toLowerCase().includes(q) ||
            f.reportedBy?.fullName?.toLowerCase().includes(q) ||
            f.assignedTo?.fullName?.toLowerCase().includes(q) ||
            f.workGroupName?.toLowerCase().includes(q)
        )) return false;
        if (fStatus !== 'ALL' && f.status !== fStatus &&
            !(fStatus === 'OPEN' && f.status === 'REPORTED')) return false;
        if (fPriority !== 'ALL' && f.priority !== fPriority) return false;
        if (fCategory !== 'ALL' && f.category !== fCategory) return false;
        if (fDateFrom && new Date(f.createdAt) < new Date(fDateFrom)) return false;
        if (fDateTo && new Date(f.createdAt) > new Date(fDateTo + 'T23:59:59')) return false;
        return true;
      })
      .sort((a, b) => {
        let av = a[sortField], bv = b[sortField];
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d==='asc'?'desc':'asc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(1);
  };

  // ─── Selection ─────────────────────────────────────────────────────────────
  const allSelected  = paged.length > 0 && paged.every(f => selected.has(f.id));
  const someSelected = paged.some(f => selected.has(f.id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      paged.forEach(f => next.delete(f.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      paged.forEach(f => next.add(f.id));
      setSelected(next);
    }
  };

  const toggleOne = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const clearSelection = () => setSelected(new Set());

  // ─── Status quick counts ───────────────────────────────────────────────────
  const counts = {};
  faults.forEach(f => { counts[f.status] = (counts[f.status]||0)+1; });

  // ─── Inject CSS ────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = 'flt-page-styles';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700;800&family=DM+Mono:wght@400;500;600&display=swap');
      @keyframes flt-shimmer { 0%{background-position:200% 0}100%{background-position:-200% 0} }
      @keyframes flt-fadein  { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
      @keyframes flt-slidein { from{opacity:0;transform:translateY(-12px) scale(0.98)}to{opacity:1;transform:none} }
      @keyframes flt-toastin { from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none} }
      .flt-page * { box-sizing:border-box; }
      .flt-row { transition:background 0.1s; }
      .flt-row:hover td { background:#1C2333 !important; }
      .flt-row td { cursor:pointer; }
      .flt-sortbtn { background:none;border:none;cursor:pointer;color:#7D8590;
        font-size:11px;font-weight:700;padding:0;display:flex;align-items:center;
        gap:3px;font-family:'DM Mono',monospace;letter-spacing:0.4px;
        transition:color 0.12s; }
      .flt-sortbtn:hover{color:#E6EDF3}
      .flt-filter-chip { border:1px solid #30363D;background:#21262D;
        borderRadius:8px;padding:5px 10px;font-size:11px;color:#7D8590;
        cursor:pointer;transition:all 0.12s;font-family:'DM Mono',monospace;
        font-weight:600; }
      .flt-filter-chip.active{background:#1F6FEB22;border-color:#58A6FF55;color:#58A6FF}
      .flt-filter-chip:hover:not(.active){border-color:#58A6FF33;color:#E6EDF3}
      ::-webkit-scrollbar{width:4px;height:4px}
      ::-webkit-scrollbar-track{background:#0D1117}
      ::-webkit-scrollbar-thumb{background:#30363D;border-radius:4px}
      ::-webkit-scrollbar-thumb:hover{background:#58A6FF55}
    `;
    document.head.appendChild(s);
  }, []);

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
      <div className="flt-page" style={{
        background:C.bg, minHeight:'100vh',
        padding:'28px 32px',
        fontFamily:'DM Mono,monospace',
      }}>

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
          <div>
            <h1 style={{
              margin:0, fontSize:26, fontWeight:800,
              color:C.text, fontFamily:'Bricolage Grotesque,sans-serif',
              letterSpacing:-0.5,
            }}>
              Fault Management
            </h1>
            <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>
              {faults.length} total faults &nbsp;·&nbsp; {filtered.length} matching filters
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <Btn variant="ghost" onClick={() => exportCSV(filtered)}>
              📥 Export CSV
            </Btn>
            <Btn variant="ghost" onClick={fetchFaults}>
              🔄 Refresh
            </Btn>
          </div>
        </div>

        {/* ── Status quick filter chips ─────────────────────────────────────── */}
        <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
          {[
            { key:'ALL',        label:`All  (${faults.length})` },
            { key:'OPEN',       label:`Open  (${(counts.OPEN||0)+(counts.REPORTED||0)})` },
            { key:'ASSIGNED',   label:`Assigned  (${counts.ASSIGNED||0})` },
            { key:'IN_PROGRESS',label:`In Progress  (${counts.IN_PROGRESS||0})` },
            { key:'COMPLETED',  label:`Completed  (${counts.COMPLETED||0})` },
            { key:'CANCELLED',  label:`Cancelled  (${counts.CANCELLED||0})` },
          ].map(c => (
              <button
                  key={c.key}
                  className={`flt-filter-chip${fStatus===c.key?' active':''}`}
                  onClick={() => { setFStatus(c.key); setPage(1); }}
              >
                {c.label}
              </button>
          ))}
        </div>

        {/* ── Filter bar ───────────────────────────────────────────────────── */}
        <div style={{
          display:'grid',
          gridTemplateColumns:'1fr auto auto auto auto auto',
          gap:8, marginBottom:16,
        }}>
          <div style={{ position:'relative' }}>
          <span style={{
            position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
            color:C.muted, fontSize:14, pointerEvents:'none',
          }}>🔍</span>
            <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search faults by ID, description, customer, address…"
                style={{
                  width:'100%', background:C.surface2, border:`1px solid ${C.border}`,
                  borderRadius:8, padding:'8px 12px 8px 32px',
                  color:C.text, fontSize:12, outline:'none',
                  fontFamily:'DM Mono,monospace', transition:'border-color 0.14s',
                }}
                onFocus={e => e.target.style.borderColor=C.accent}
                onBlur={e => e.target.style.borderColor=C.border}
            />
          </div>
          <Select value={fPriority} onChange={v => { setFPriority(v); setPage(1); }} style={{ minWidth:110 }}>
            <option value="ALL">All Priority</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </Select>
          <Select value={fCategory} onChange={v => { setFCategory(v); setPage(1); }} style={{ minWidth:130 }}>
            <option value="ALL">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <input
              type="date" value={fDateFrom}
              onChange={e => { setFDateFrom(e.target.value); setPage(1); }}
              style={{
                background:C.surface2, border:`1px solid ${C.border}`,
                borderRadius:8, padding:'8px 10px', color:C.text,
                fontSize:12, outline:'none', fontFamily:'DM Mono,monospace',
                colorScheme:'dark',
              }}
          />
          <input
              type="date" value={fDateTo}
              onChange={e => { setFDateTo(e.target.value); setPage(1); }}
              style={{
                background:C.surface2, border:`1px solid ${C.border}`,
                borderRadius:8, padding:'8px 10px', color:C.text,
                fontSize:12, outline:'none', fontFamily:'DM Mono,monospace',
                colorScheme:'dark',
              }}
          />
          {(search || fPriority!=='ALL' || fCategory!=='ALL' || fDateFrom || fDateTo) && (
              <Btn variant="ghost" onClick={() => {
                setSearch(''); setFPriority('ALL');
                setFCategory('ALL'); setFDateFrom(''); setFDateTo(''); setPage(1);
              }}>
                ✕ Clear
              </Btn>
          )}
        </div>

        {/* ── Bulk action bar ───────────────────────────────────────────────── */}
        {selected.size > 0 && (
            <div style={{
              display:'flex', alignItems:'center', gap:10,
              background:'#1F2D4A', border:`1px solid ${C.accentD}55`,
              borderRadius:10, padding:'10px 16px', marginBottom:16,
              animation:'flt-fadein 0.2s ease',
            }}>
          <span style={{
            fontSize:12, fontWeight:700, color:C.accent,
            fontFamily:'Bricolage Grotesque,sans-serif',
          }}>
            {selected.size} selected
          </span>
              <div style={{ width:1, height:18, background:C.border }} />
              <Btn variant="primary" onClick={() => setBulkOpen(true)}>
                🔧 Bulk Assign
              </Btn>
              <Btn variant="ghost" onClick={() => exportCSV(faults.filter(f => selected.has(f.id)))}>
                📥 Export Selected
              </Btn>
              <Btn variant="ghost" onClick={clearSelection} style={{ marginLeft:'auto' }}>
                ✕ Clear selection
              </Btn>
            </div>
        )}

        {/* ── Table ────────────────────────────────────────────────────────── */}
        <div style={{
          background:C.surface, border:`1px solid ${C.border}`,
          borderRadius:12, overflow:'hidden',
          boxShadow:'0 4px 24px rgba(0,0,0,0.3)',
        }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
              <colgroup>
                <col style={{ width:40 }} />
                <col style={{ width:72 }} />
                <col style={{ width:80 }} />
                <col style={{ width:100 }} />
                <col style={{ width:110 }} />
                <col style={{ width:'24%' }} />
                <col style={{ width:'18%' }} />
                <col style={{ width:'18%' }} />
                <col style={{ width:105 }} />
                <col style={{ width:96 }} />
              </colgroup>
              <thead>
              <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                {[
                  { key:null,        el:<Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />, align:'center' },
                  { key:'id',        el:'FAULT ID' },
                  { key:'priority',  el:'PRIORITY' },
                  { key:'status',    el:'STATUS' },
                  { key:'category',  el:'CATEGORY' },
                  { key:'description',el:'DESCRIPTION' },
                  { key:'reportedBy',el:'CUSTOMER' },
                  { key:'assignedTo',el:'ASSIGNED TO' },
                  { key:'createdAt', el:'CREATED' },
                  { key:null,        el:'ACTIONS', align:'center' },
                ].map((col, i) => (
                    <th key={i} style={{
                      padding:'11px 12px', background:C.surface2,
                      textAlign: col.align || 'left', verticalAlign:'middle',
                      borderRight: i < 9 ? `1px solid ${C.border2}` : 'none',
                    }}>
                      {col.key ? (
                          <button
                              className="flt-sortbtn"
                              onClick={() => toggleSort(col.key)}
                          >
                            {col.el}
                            {sortField === col.key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}
                          </button>
                      ) : (
                          <span style={{ fontSize:11, fontWeight:700, color:C.muted }}>
                        {col.el}
                      </span>
                      )}
                    </th>
                ))}
              </tr>
              </thead>
              <tbody>
              {loading ? (
                  [...Array(8)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(10)].map((_, j) => (
                            <td key={j} style={{ padding:'12px 12px', borderBottom:`1px solid ${C.border2}` }}>
                              <Skeleton h={13} r={5} />
                            </td>
                        ))}
                      </tr>
                  ))
              ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{
                      padding:'60px 24px', textAlign:'center',
                      color:C.muted, fontSize:14,
                    }}>
                      <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
                      No faults match the current filters
                    </td>
                  </tr>
              ) : (
                  paged.map((f, idx) => (
                      <tr
                          key={f.id}
                          className="flt-row"
                          style={{ animation:`flt-fadein 0.25s ease ${idx*0.02}s both` }}
                          onClick={() => setDetail(f)}
                      >
                        <td
                            style={{ padding:'11px 12px', borderBottom:`1px solid ${C.border2}`, textAlign:'center' }}
                            onClick={e => { e.stopPropagation(); toggleOne(f.id); }}
                        >
                          <Checkbox checked={selected.has(f.id)} onChange={() => toggleOne(f.id)} />
                        </td>
                        <td style={{ padding:'11px 12px', borderBottom:`1px solid ${C.border2}` }}>
                      <span style={{ fontSize:12, fontWeight:700, color:C.accent }}>
                        #{f.id}
                      </span>
                        </td>
                        <td style={{ padding:'11px 12px', borderBottom:`1px solid ${C.border2}` }}>
                          <PriBadge priority={f.priority} />
                        </td>
                        <td style={{ padding:'11px 12px', borderBottom:`1px solid ${C.border2}` }}>
                          <StatusBadge status={f.status} />
                        </td>
                        <td style={{ padding:'11px 12px', borderBottom:`1px solid ${C.border2}` }}>
                      <span style={{
                        fontSize:11, fontWeight:700,
                        padding:'2px 7px', borderRadius:5,
                        background:C.surface2, color:C.muted,
                        border:`1px solid ${C.border}`,
                      }}>
                        {f.category || '—'}
                      </span>
                        </td>
                        <td style={{ padding:'11px 12px', borderBottom:`1px solid ${C.border2}` }}>
                          <div style={{
                            fontSize:12, color:C.text,
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                          }}>
                            {f.description || '—'}
                          </div>
                          {f.address && (
                              <div style={{
                                fontSize:10, color:C.muted, marginTop:2,
                                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                              }}>
                                📍 {f.address}
                              </div>
                          )}
                        </td>
                        <td style={{ padding:'11px 12px', borderBottom:`1px solid ${C.border2}` }}>
                          {f.reportedBy ? (
                              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                                <Avatar name={f.reportedBy.fullName} size={22} />
                                <div>
                                  <div style={{ fontSize:12, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:100 }}>
                                    {f.reportedBy.fullName}
                                  </div>
                                  <div style={{ fontSize:10, color:C.muted }}>{f.reportedBy.phone}</div>
                                </div>
                              </div>
                          ) : (
                              <span style={{ color:C.muted, fontSize:12 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding:'11px 12px', borderBottom:`1px solid ${C.border2}` }}>
                          {f.assignedTo ? (
                              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                                <Avatar name={f.assignedTo.fullName} size={22} />
                                <div style={{ fontSize:12, color:C.teal, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:100 }}>
                                  {f.assignedTo.fullName}
                                </div>
                              </div>
                          ) : f.workGroupName ? (
                              // Assigned to a Work Group, but its Team Lead hasn't self-assigned/dispatched yet.
                              <span style={{
                                fontSize:11, padding:'2px 8px', borderRadius:5,
                                background:'#1C2333', color:C.purple,
                                border:`1px solid ${C.purple}33`,
                              }}>
                          👥 {f.workGroupName}
                        </span>
                          ) : (
                              <span style={{
                                fontSize:11, padding:'2px 8px', borderRadius:5,
                                background:'#3D1F1F', color:C.red,
                                border:`1px solid ${C.red}33`,
                              }}>
                          Unassigned
                        </span>
                          )}
                        </td>
                        <td style={{ padding:'11px 12px', borderBottom:`1px solid ${C.border2}` }}>
                          <div style={{ fontSize:11, color:C.muted }}>{fmt(f.createdAt)}</div>
                          <div style={{ fontSize:10, color:C.muted+'88', marginTop:1 }}>{timeAgo(f.createdAt)}</div>
                        </td>
                        <td
                            style={{ padding:'11px 8px', borderBottom:`1px solid ${C.border2}`, textAlign:'center' }}
                            onClick={e => e.stopPropagation()}
                        >
                          <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                            <button
                                title="View detail / Assign"
                                onClick={() => setDetail(f)}
                                style={{
                                  background:'none', border:`1px solid ${C.border}`,
                                  borderRadius:6, padding:'4px 7px', cursor:'pointer',
                                  color:C.muted, fontSize:13, transition:'all 0.12s',
                                }}
                                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}
                                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}
                            >
                              👁
                            </button>
                            <button
                                title="Quick assign"
                                onClick={() => { setDetail(f); }}
                                style={{
                                  background:'none', border:`1px solid ${C.border}`,
                                  borderRadius:6, padding:'4px 7px', cursor:'pointer',
                                  color:C.muted, fontSize:13, transition:'all 0.12s',
                                }}
                                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.green;e.currentTarget.style.color=C.green;}}
                                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}
                            >
                              🔧
                            </button>
                          </div>
                        </td>
                      </tr>
                  ))
              )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filtered.length > PAGE_SIZE && (
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'12px 16px', borderTop:`1px solid ${C.border}`,
                background:C.surface2,
              }}>
            <span style={{ fontSize:12, color:C.muted }}>
              Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
                <div style={{ display:'flex', gap:4 }}>
                  <Btn variant="ghost" onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1}>
                    ‹ Prev
                  </Btn>
                  {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                    const p = i+1;
                    return (
                        <button
                            key={p}
                            onClick={() => setPage(p)}
                            style={{
                              width:32, height:32, borderRadius:6, border:'none',
                              background: page===p ? C.accentD : 'none',
                              color: page===p ? C.white : C.muted,
                              cursor:'pointer', fontSize:12, fontFamily:'DM Mono,monospace',
                              transition:'all 0.12s',
                            }}
                            onMouseEnter={e=>{if(page!==p)e.currentTarget.style.background=C.surface;}}
                            onMouseLeave={e=>{if(page!==p)e.currentTarget.style.background='none';}}
                        >
                          {p}
                        </button>
                    );
                  })}
                  <Btn variant="ghost" onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>
                    Next ›
                  </Btn>
                </div>
              </div>
          )}
        </div>

        {/* ── Fault Detail Modal ──────────────────────────────────────────── */}
        <FaultDetailModal
            fault={detail}
            workGroups={workGroups}
            currentUser={currentUser}
            open={!!detail}
            onClose={() => { setDetail(null); fetchFaults(); }}
            onSuccess={showToast}
        />

        {/* ── Bulk Assign Modal ───────────────────────────────────────────── */}
        <BulkAssignModal
            faultIds={[...selected]}
            workGroups={workGroups}
            open={bulkOpen}
            onClose={() => { setBulkOpen(false); clearSelection(); fetchFaults(); }}
            onSuccess={showToast}
        />

        {/* ── Toast ───────────────────────────────────────────────────────── */}
        {toast && (
            <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />
        )}
      </div>
  );
}