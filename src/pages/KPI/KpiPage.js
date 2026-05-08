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

// ─── Palette — electric sports scoreboard ────────────────────────────────────
const K = {
  bg:        '#060A10',
  panel:     '#0C1220',
  surface:   '#111E30',
  lift:      '#162540',
  border:    '#1E3050',
  border2:   '#142040',
  text:      '#C8DEFF',
  muted:     '#4A6080',
  dim:       '#2A4060',
  electric:  '#00E5FF',
  electricD: '#0098AA',
  electricL: '#002A30',
  lime:      '#AAFF00',
  limeD:     '#608800',
  limeL:     '#182200',
  amber:     '#FFB800',
  amberD:    '#995000',
  amberL:    '#1E1400',
  rose:      '#FF3060',
  roseD:     '#990020',
  roseL:     '#1E0008',
  violet:    '#A855F7',
  violetL:   '#1A0A2E',
  white:     '#FFFFFF',
};

// ─── Performance level config ─────────────────────────────────────────────────
const PERF = {
  EXCELLENT:        { label:'EXCELLENT',     color:K.lime,     bg:K.limeL,     bar:'#AAFF00', min:90 },
  GOOD:             { label:'GOOD',          color:K.electric, bg:K.electricL, bar:'#00E5FF', min:75 },
  AVERAGE:          { label:'AVERAGE',       color:K.amber,    bg:K.amberL,    bar:'#FFB800', min:60 },
  BELOW_AVERAGE:    { label:'BELOW AVG',     color:K.rose,     bg:K.roseL,     bar:'#FF3060', min:40 },
  NEEDS_IMPROVEMENT:{ label:'NEEDS WORK',    color:K.rose,     bg:K.roseL,     bar:'#FF3060', min:0  },
};

const TARGET_STATUS = {
  ACHIEVED: { label:'Achieved', color:K.lime,     bg:K.limeL,     icon:'🏆' },
  ON_TRACK: { label:'On Track', color:K.electric, bg:K.electricL, icon:'✅' },
  AT_RISK:  { label:'At Risk',  color:K.amber,    bg:K.amberL,    icon:'⚠️' },
  BEHIND:   { label:'Behind',   color:K.rose,     bg:K.roseL,     icon:'❌' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const round1    = v => Math.round((v || 0) * 10) / 10;
const pct       = v => `${round1(v)}%`;
const fmtDate   = d => d ? new Date(d).toLocaleDateString('en-GB',{ day:'2-digit',month:'short',year:'numeric'}) : '—';
const scoreColor = s => s >= 90 ? K.lime : s >= 75 ? K.electric : s >= 60 ? K.amber : K.rose;

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED MICRO-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const Skeleton = ({ h=14, w='100%', r=6 }) => (
    <div style={{
      height:h, width:w, borderRadius:r,
      background:`linear-gradient(90deg,${K.surface} 25%,${K.lift} 50%,${K.surface} 75%)`,
      backgroundSize:'400% 100%', animation:'kpi-shimmer 1.4s ease infinite',
    }}/>
);

const Toast = ({ msg, type, onDone }) => {
  useEffect(()=>{ const t=setTimeout(onDone,3200); return ()=>clearTimeout(t); },[onDone]);
  const col = type==='success'?K.lime : type==='error'?K.rose : K.amber;
  return (
      <div style={{
        position:'fixed', bottom:28, right:28, zIndex:3000,
        background:K.panel, border:`2px solid ${col}`,
        borderRadius:12, padding:'12px 20px', fontSize:12,
        color:K.text, fontFamily:'JetBrains Mono,monospace',
        boxShadow:`0 8px 40px rgba(0,0,0,0.6), 0 0 20px ${col}22`,
        display:'flex', alignItems:'center', gap:10,
        animation:'kpi-toastin 0.22s ease',
      }}>
        <span style={{ fontSize:18 }}>{type==='success'?'✅':type==='error'?'❌':'⚠️'}</span>
        {msg}
      </div>
  );
};

// ─── Score ring ───────────────────────────────────────────────────────────────
const ScoreRing = ({ score=0, size=80, stroke=6 }) => {
  const r     = (size - stroke) / 2;
  const circ  = 2 * Math.PI * r;
  const dash  = (score / 100) * circ;
  const col   = scoreColor(score);
  return (
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={K.border} strokeWidth={stroke}/>
        <circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={col} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            style={{ transition:'stroke-dasharray 0.8s ease', filter:`drop-shadow(0 0 6px ${col})` }}
        />
        <text
            x={size/2} y={size/2}
            textAnchor="middle" dominantBaseline="central"
            style={{ transform:'rotate(90deg)', transformOrigin:`${size/2}px ${size/2}px` }}
            fill={col} fontSize={size*0.22} fontWeight={800}
            fontFamily="JetBrains Mono,monospace"
        >
          {Math.round(score)}
        </text>
      </svg>
  );
};

// ─── Stars ───────────────────────────────────────────────────────────────────
const Stars = ({ rating=0, size=13 }) => {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
      <span style={{ fontSize:size, letterSpacing:-1, lineHeight:1 }}>
      <span style={{ color:K.amber }}>{'★'.repeat(full)}</span>
        {half && <span style={{ color:K.amber }}>½</span>}
        <span style={{ color:K.dim }}>{'☆'.repeat(5-full-(half?1:0))}</span>
      <span style={{ fontSize:size*0.85, color:K.muted, marginLeft:4 }}>{rating?.toFixed(1)}</span>
    </span>
  );
};

// ─── Stat pill ────────────────────────────────────────────────────────────────
const StatPill = ({ label, value, color=K.electric, icon }) => (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'10px 14px', borderRadius:10,
      background:K.surface, border:`1px solid ${K.border}`,
      gap:3, minWidth:80,
    }}>
      {icon && <span style={{ fontSize:16, marginBottom:1 }}>{icon}</span>}
      <div style={{
        fontSize:18, fontWeight:800, color,
        fontFamily:'JetBrains Mono,monospace', lineHeight:1,
      }}>{value ?? '—'}</div>
      <div style={{ fontSize:9, color:K.muted, letterSpacing:0.6, textTransform:'uppercase' }}>
        {label}
      </div>
    </div>
);

// ─── Progress bar ─────────────────────────────────────────────────────────────
const ProgressBar = ({ pct:p=0, color=K.electric, h=5, label, showPct=true }) => (
    <div>
      {(label || showPct) && (
          <div style={{
            display:'flex', justifyContent:'space-between',
            marginBottom:4, fontSize:10, color:K.muted,
          }}>
            {label && <span>{label}</span>}
            {showPct && <span style={{ color }}>{round1(p)}%</span>}
          </div>
      )}
      <div style={{ height:h, background:K.border, borderRadius:h, overflow:'hidden' }}>
        <div style={{
          height:'100%', width:`${Math.min(p,100)}%`,
          background:color, borderRadius:h,
          transition:'width 0.7s ease',
          boxShadow:`0 0 8px ${color}66`,
        }}/>
      </div>
    </div>
);

// ─── Button ──────────────────────────────────────────────────────────────────
const Btn = ({ children, variant='ghost', onClick, disabled=false, sx={} }) => {
  const [hov, setHov] = useState(false);
  const variants = {
    ghost:   { bg:'transparent',  hbg:K.lift,      color:K.text,    border:K.border    },
    primary: { bg:K.electricD,    hbg:'#007A88',   color:K.white,   border:K.electric  },
    lime:    { bg:K.limeD,        hbg:'#486600',   color:K.bg,      border:K.lime      },
    amber:   { bg:K.amberL,       hbg:'#2A1C00',   color:K.amber,   border:K.amber     },
  };
  const v = variants[variant]||variants.ghost;
  return (
      <button
          onClick={onClick} disabled={disabled}
          onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
          style={{
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'8px 16px', borderRadius:8, fontSize:11, fontWeight:700,
            cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.45:1,
            background:hov?v.hbg:v.bg, border:`1.5px solid ${v.border}`,
            color:v.color, transition:'all 0.13s', whiteSpace:'nowrap',
            fontFamily:'JetBrains Mono,monospace', letterSpacing:0.3, ...sx,
          }}
      >{children}</button>
  );
};

// ─── Period selector ──────────────────────────────────────────────────────────
const PeriodSelector = ({ value, onChange }) => (
    <div style={{
      display:'flex', border:`1.5px solid ${K.border}`,
      borderRadius:10, overflow:'hidden', flexShrink:0,
    }}>
      {['DAILY','WEEKLY','MONTHLY'].map(p => (
          <button key={p}
                  onClick={()=>onChange(p)}
                  style={{
                    padding:'8px 16px', border:'none', cursor:'pointer', fontSize:11, fontWeight:800,
                    background: value===p ? K.electric : 'transparent',
                    color: value===p ? K.bg : K.muted,
                    transition:'all 0.13s', fontFamily:'JetBrains Mono,monospace',
                    letterSpacing:0.6,
                    boxShadow: value===p ? `0 0 12px ${K.electric}44` : 'none',
                  }}
          >{p}</button>
      ))}
    </div>
);

// ─── Modal ───────────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, subtitle, width=580, children }) => {
  useEffect(()=>{
    const fn = e => e.key==='Escape' && onClose();
    if (open) document.addEventListener('keydown',fn);
    return ()=>document.removeEventListener('keydown',fn);
  },[open,onClose]);
  if (!open) return null;
  return (
      <div
          onClick={e=>e.target===e.currentTarget&&onClose()}
          style={{
            position:'fixed', inset:0, zIndex:1000,
            background:'rgba(6,10,16,0.9)', backdropFilter:'blur(6px)',
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:24, animation:'kpi-fadein 0.18s ease',
          }}
      >
        <div style={{
          background:K.panel, border:`1px solid ${K.border}`,
          borderRadius:16, width:'100%', maxWidth:width,
          maxHeight:'90vh', display:'flex', flexDirection:'column',
          boxShadow:`0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px ${K.electric}22`,
          animation:'kpi-slidein 0.22s ease',
        }}>
          <div style={{
            padding:'20px 24px 16px', borderBottom:`1px solid ${K.border}`,
            display:'flex', alignItems:'flex-start', justifyContent:'space-between',
            flexShrink:0,
          }}>
            <div>
              <div style={{
                fontWeight:800, fontSize:16, color:K.text,
                fontFamily:'Barlow Condensed,sans-serif', letterSpacing:0.5,
              }}>{title}</div>
              {subtitle && <div style={{ fontSize:11, color:K.muted, marginTop:3 }}>{subtitle}</div>}
            </div>
            <button onClick={onClose} style={{
              background:'none', border:'none', color:K.muted, fontSize:22,
              cursor:'pointer', lineHeight:1, padding:'0 4px', transition:'color 0.12s',
            }}
                    onMouseEnter={e=>e.target.style.color=K.text}
                    onMouseLeave={e=>e.target.style.color=K.muted}
            >×</button>
          </div>
          <div style={{ overflowY:'auto', flex:1 }}>{children}</div>
        </div>
      </div>
  );
};

// ─── Input / Select ───────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <label style={{
        fontSize:9, fontWeight:800, color:K.muted,
        letterSpacing:1, textTransform:'uppercase',
        fontFamily:'JetBrains Mono,monospace',
      }}>{label}</label>
      {children}
    </div>
);

const TInput = ({ value, onChange, placeholder, type='text' }) => (
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
           style={{
             background:K.surface, border:`1.5px solid ${K.border}`,
             borderRadius:8, padding:'9px 12px', fontSize:12, color:K.text,
             outline:'none', fontFamily:'JetBrains Mono,monospace', transition:'border-color 0.13s',
           }}
           onFocus={e=>e.target.style.borderColor=K.electric}
           onBlur={e=>e.target.style.borderColor=K.border}
    />
);

const TSelect = ({ value, onChange, children }) => (
    <select value={value} onChange={e=>onChange(e.target.value)}
            style={{
              background:K.surface, border:`1.5px solid ${K.border}`,
              borderRadius:8, padding:'9px 12px', fontSize:12, color:K.text,
              outline:'none', cursor:'pointer', fontFamily:'JetBrains Mono,monospace',
              transition:'border-color 0.13s',
            }}
            onFocus={e=>e.target.style.borderColor=K.electric}
            onBlur={e=>e.target.style.borderColor=K.border}
    >{children}</select>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGN TARGET MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function AssignTargetModal({ technicians, open, onClose, onSuccess }) {
  const [form, setForm] = useState({
    technicianId:'', title:'', description:'',
    targetValue:'', unit:'jobs', period:'MONTHLY',
    category:'JOBS', dueDate:'',
  });
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    if (open) setForm({
      technicianId:'', title:'', description:'',
      targetValue:'', unit:'jobs', period:'MONTHLY',
      category:'JOBS', dueDate:'',
    });
  },[open]);

  const f = key => val => setForm(p=>({...p,[key]:val}));

  // Category → unit presets
  const CATEGORY_UNITS = {
    JOBS:'jobs', TIME:'hours', SATISFACTION:'stars',
    REVENUE:'LKR', ATTENDANCE:'days',
  };

  const submit = async () => {
    if (!form.technicianId || !form.title || !form.targetValue || !form.dueDate) return;
    setLoading(true);
    try {
      await post('/api/kpi/targets/assign', {
        technicianId: Number(form.technicianId),
        title: form.title,
        description: form.description,
        targetValue: Number(form.targetValue),
        unit: form.unit,
        period: form.period,
        category: form.category,
        dueDate: form.dueDate,
        isGroupTarget: false,
      });
      onSuccess('Target assigned successfully','success');
      onClose();
    } catch(e) { onSuccess('Failed to assign target','error'); }
    finally { setLoading(false); }
  };

  const TEMPLATES = [
    { title:'Complete 10 jobs per day',     targetValue:'10', unit:'jobs',  category:'JOBS',         period:'DAILY'   },
    { title:'Complete 50 jobs this week',   targetValue:'50', unit:'jobs',  category:'JOBS',         period:'WEEKLY'  },
    { title:'Achieve 4.5 satisfaction',     targetValue:'4.5',unit:'stars', category:'SATISFACTION', period:'MONTHLY' },
    { title:'90% on-time completion',       targetValue:'90', unit:'%',     category:'TIME',         period:'MONTHLY' },
    { title:'100% attendance this month',   targetValue:'22', unit:'days',  category:'ATTENDANCE',   period:'MONTHLY' },
  ];

  return (
      <Modal open={open} onClose={onClose} width={600}
             title="Assign KPI Target"
             subtitle="Set a measurable performance target for a technician"
      >
        <div style={{ padding:'20px 24px' }}>

          {/* Quick templates */}
          <div style={{ marginBottom:20 }}>
            <div style={{
              fontSize:9, fontWeight:800, color:K.muted, letterSpacing:1,
              textTransform:'uppercase', marginBottom:8,
              fontFamily:'JetBrains Mono,monospace',
            }}>QUICK TEMPLATES</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {TEMPLATES.map((t,i)=>(
                  <button key={i}
                          onClick={()=>setForm(p=>({
                            ...p, title:t.title, targetValue:t.targetValue,
                            unit:t.unit, category:t.category, period:t.period,
                          }))}
                          style={{
                            padding:'5px 10px', borderRadius:6, fontSize:10, fontWeight:600,
                            cursor:'pointer', background:K.surface, border:`1px solid ${K.border}`,
                            color:K.muted, transition:'all 0.12s',
                            fontFamily:'JetBrains Mono,monospace',
                          }}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor=K.electric;e.currentTarget.style.color=K.electric;}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor=K.border;e.currentTarget.style.color=K.muted;}}
                  >{t.title}</button>
              ))}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <Field label="Technician *">
                <TSelect value={form.technicianId} onChange={f('technicianId')}>
                  <option value="">— Select technician —</option>
                  {technicians.map(t=>(
                      <option key={t.id||t.technicianId} value={t.id||t.technicianId}>
                        {t.name || t.fullName || t.technicianName} ({t.phone||''})
                      </option>
                  ))}
                </TSelect>
              </Field>
            </div>

            <div style={{ gridColumn:'1/-1' }}>
              <Field label="Target Title *">
                <TInput value={form.title} onChange={f('title')} placeholder="e.g. Complete 50 jobs this month" />
              </Field>
            </div>

            <div style={{ gridColumn:'1/-1' }}>
              <Field label="Description">
                <TInput value={form.description} onChange={f('description')} placeholder="Optional description or context…" />
              </Field>
            </div>

            <Field label="Category">
              <TSelect value={form.category} onChange={v=>{
                f('category')(v);
                f('unit')(CATEGORY_UNITS[v]||'units');
              }}>
                <option value="JOBS">📋 Jobs Completed</option>
                <option value="TIME">⏱ Response Time</option>
                <option value="SATISFACTION">⭐ Satisfaction Score</option>
                <option value="REVENUE">💰 Revenue</option>
                <option value="ATTENDANCE">📅 Attendance</option>
              </TSelect>
            </Field>

            <Field label="Period">
              <TSelect value={form.period} onChange={f('period')}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </TSelect>
            </Field>

            <Field label="Target Value *">
              <TInput type="number" value={form.targetValue} onChange={f('targetValue')} placeholder="0" />
            </Field>

            <Field label="Unit">
              <TInput value={form.unit} onChange={f('unit')} placeholder="jobs / % / stars / LKR…" />
            </Field>

            <div style={{ gridColumn:'1/-1' }}>
              <Field label="Due Date *">
                <TInput type="date" value={form.dueDate} onChange={f('dueDate')} />
              </Field>
            </div>
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20, paddingTop:16, borderTop:`1px solid ${K.border}` }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="lime" onClick={submit}
                 disabled={!form.technicianId||!form.title||!form.targetValue||!form.dueDate||loading}
            >
              {loading ? '⏳ Assigning…' : '🎯 Assign Target'}
            </Btn>
          </div>
        </div>
      </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDIVIDUAL KPI DETAIL DRAWER
// ═══════════════════════════════════════════════════════════════════════════════
function TechKpiDrawer({ tech, period, open, onClose, onAssignTarget }) {
  const [kpiData, setKpiData]   = useState(null);
  const [targets, setTargets]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [tab,     setTab]       = useState('overview');

  const id = tech?.technicianId || tech?.id;

  useEffect(()=>{
    if (!open || !id) return;
    setLoading(true);
    setTab('overview');
    Promise.all([
      get(`/api/kpi/score/${id}?period=${period}`).catch(()=>null),
      get(`/api/kpi/targets/technician/${id}`).catch(()=>[]),
    ]).then(([kpi, tgts])=>{
      setKpiData(kpi);
      setTargets(Array.isArray(tgts)?tgts:[]);
    }).finally(()=>setLoading(false));
  },[open, id, period]);

  if (!tech) return null;
  const name = tech.name || tech.technicianName || tech.fullName || 'Technician';
  const perf = PERF[kpiData?.performanceLevel] || PERF.AVERAGE;

  const metrics = kpiData ? [
    { label:'Completion Rate',   value:pct(kpiData.completionRate),   color:K.lime,     bar:kpiData.completionRate },
    { label:'On-Time Rate',      value:pct(kpiData.onTimeCompletionRate), color:K.electric, bar:kpiData.onTimeCompletionRate },
    { label:'Attendance',        value:pct(kpiData.attendanceRate),   color:K.amber,    bar:kpiData.attendanceRate },
    { label:'Response Time',     value:`${round1(kpiData.avgResponseTimeMinutes)}m`, color:K.muted, bar: Math.max(0,100-(kpiData.avgResponseTimeMinutes-10)*2) },
  ] : [];

  return (
      <Modal open={open} onClose={onClose} width={620}
             title={name}
             subtitle={`KPI Breakdown · ${period} period`}
      >
        {loading ? (
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:12 }}>
              {[...Array(5)].map((_,i)=><Skeleton key={i} h={16} r={8}/>)}
            </div>
        ) : (
            <>
              {/* Score header */}
              <div style={{
                padding:'20px 24px 16px', borderBottom:`1px solid ${K.border}`,
                display:'flex', gap:20, alignItems:'center',
              }}>
                <ScoreRing score={kpiData?.overallScore||0} size={90} stroke={7}/>
                <div style={{ flex:1 }}>
                  <div style={{
                    fontSize:24, fontWeight:900, color:perf.color,
                    fontFamily:'Barlow Condensed,sans-serif', letterSpacing:1,
                    marginBottom:4,
                  }}>
                    {perf.label}
                  </div>
                  <Stars rating={kpiData?.starRating||0} size={15}/>
                  <div style={{
                    display:'flex', gap:10, marginTop:10, flexWrap:'wrap',
                  }}>
                    <div style={{ fontSize:11, color:K.muted }}>
                      <b style={{ color:K.text }}>{kpiData?.completedJobs||0}</b> / {kpiData?.totalJobs||0} jobs
                    </div>
                    <div style={{ fontSize:11, color:K.muted }}>
                      Avg <b style={{ color:K.text }}>{round1(kpiData?.avgJobDurationHours)}h</b> per job
                    </div>
                    <div style={{ fontSize:11, color:K.muted }}>
                      <b style={{ color:K.text }}>{round1(kpiData?.avgResponseTimeMinutes)}m</b> response
                    </div>
                  </div>
                </div>
                <Btn variant="amber" onClick={()=>{ onClose(); onAssignTarget(tech); }} sx={{ alignSelf:'flex-start' }}>
                  + Assign Target
                </Btn>
              </div>

              {/* Tabs */}
              <div style={{ display:'flex', gap:2, padding:'12px 24px 0', borderBottom:`1px solid ${K.border}` }}>
                {[
                  { id:'overview', label:'Overview' },
                  { id:'targets',  label:`Targets (${targets.length})` },
                ].map(t=>(
                    <button key={t.id} onClick={()=>setTab(t.id)} style={{
                      padding:'8px 14px', border:'none', cursor:'pointer',
                      background:'none', fontSize:11, fontWeight:700,
                      color: tab===t.id ? K.electric : K.muted,
                      borderBottom:`2px solid ${tab===t.id ? K.electric : 'transparent'}`,
                      marginBottom:-1, transition:'all 0.12s',
                      fontFamily:'JetBrains Mono,monospace',
                    }}>{t.label}</button>
                ))}
              </div>

              <div style={{ padding:'20px 24px' }}>
                {tab==='overview' && (
                    <>
                      {/* Metric bars */}
                      <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
                        {metrics.map((m,i)=>(
                            <div key={i}>
                              <ProgressBar label={m.label} pct={m.bar||0} color={m.color} h={6} />
                            </div>
                        ))}
                      </div>

                      {/* Stats grid */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                        <StatPill label="Total Jobs"  value={kpiData?.totalJobs||0}      color={K.text} icon="📋"/>
                        <StatPill label="Completed"   value={kpiData?.completedJobs||0}  color={K.lime} icon="✅"/>
                        <StatPill label="In Progress" value={kpiData?.inProgressJobs||0} color={K.amber} icon="⚙️"/>
                        <StatPill label="Cancelled"   value={kpiData?.cancelledJobs||0}  color={K.rose} icon="❌"/>
                        <StatPill label="Attendance"  value={`${kpiData?.presentDays||0}d`} color={K.electric} icon="📅"/>
                        <StatPill label="Avg Work"    value={`${round1(kpiData?.avgWorkingHours)}h`} color={K.muted} icon="⏰"/>
                        <StatPill label="Revenue"     value={kpiData?.totalRevenue ? `${(kpiData.totalRevenue/1000).toFixed(0)}K` : '0'} color={K.amber} icon="💰"/>
                        <StatPill label="Satisfaction" value={`${round1(kpiData?.customerSatisfactionScore)}/5`} color={K.lime} icon="⭐"/>
                      </div>

                      {/* Target summary */}
                      <div style={{
                        marginTop:16, display:'flex', gap:8, padding:'12px 14px',
                        background:K.surface, borderRadius:10, border:`1px solid ${K.border}`,
                      }}>
                        {[
                          { label:'Total',    value:kpiData?.totalTargets||0,   color:K.text    },
                          { label:'Achieved', value:kpiData?.achievedTargets||0, color:K.lime   },
                          { label:'On Track', value:kpiData?.onTrackTargets||0,  color:K.electric},
                          { label:'At Risk',  value:kpiData?.atRiskTargets||0,   color:K.amber  },
                          { label:'Behind',   value:kpiData?.behindTargets||0,   color:K.rose   },
                        ].map((s,i)=>(
                            <div key={i} style={{ textAlign:'center', flex:1 }}>
                              <div style={{ fontSize:20, fontWeight:800, color:s.color, fontFamily:'Barlow Condensed,sans-serif' }}>
                                {s.value}
                              </div>
                              <div style={{ fontSize:9, color:K.muted }}>{s.label}</div>
                            </div>
                        ))}
                      </div>
                    </>
                )}

                {tab==='targets' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {targets.length===0 ? (
                          <div style={{ textAlign:'center', padding:32, color:K.muted }}>
                            <div style={{ fontSize:32, marginBottom:8 }}>🎯</div>
                            No targets assigned yet
                            <div style={{ marginTop:12 }}>
                              <Btn variant="lime" onClick={()=>{ onClose(); onAssignTarget(tech); }}>
                                + Assign First Target
                              </Btn>
                            </div>
                          </div>
                      ) : targets.map((t,i)=>{
                        const ts = TARGET_STATUS[t.status] || TARGET_STATUS.ON_TRACK;
                        const prog = Math.min(t.progressPercent||0, 100);
                        return (
                            <div key={i} style={{
                              background:K.surface, borderRadius:10, padding:14,
                              border:`1px solid ${ts.color}44`,
                              animation:`kpi-fadein 0.25s ease ${i*0.06}s both`,
                            }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                                <div>
                                  <div style={{ fontSize:13, fontWeight:700, color:K.text, marginBottom:2 }}>{t.title}</div>
                                  <div style={{ fontSize:10, color:K.muted }}>
                                    {t.category} · {t.period} · Due {fmtDate(t.dueDate)}
                                  </div>
                                </div>
                                <span style={{
                                  padding:'3px 9px', borderRadius:20, fontSize:10, fontWeight:800,
                                  background:ts.bg, color:ts.color, border:`1px solid ${ts.color}44`,
                                }}>
                          {ts.icon} {ts.label}
                        </span>
                              </div>
                              <ProgressBar pct={prog} color={ts.color} h={5} />
                              <div style={{ display:'flex', justifyContent:'space-between', marginTop:5, fontSize:10, color:K.muted }}>
                                <span>{t.currentValue||0} / {t.targetValue} {t.unit}</span>
                                <span>{round1(prog)}% complete</span>
                              </div>
                            </div>
                        );
                      })}
                    </div>
                )}
              </div>
            </>
        )}
      </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════════
function LeaderboardTab({ period, onViewDetail, onAssignTarget }) {
  const [board,   setBoard]   = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const d = await get(`/api/kpi/leaderboard?period=${period}`);
      setBoard(Array.isArray(d)?d:[]);
    } catch(e){console.error(e);}
    finally { setLoading(false); }
  },[period]);

  useEffect(()=>{ load(); },[load]);

  const RANK_STYLES = {
    1:{ bg:'linear-gradient(135deg, #3A2800, #705010)', border:'#FFB800', badge:'🥇', shadow:'0 0 20px #FFB80044' },
    2:{ bg:'linear-gradient(135deg, #1A2030, #2A3A60)', border:'#7090C0', badge:'🥈', shadow:'0 0 16px #7090C033' },
    3:{ bg:'linear-gradient(135deg, #1A1010, #3A2010)', border:'#A06030', badge:'🥉', shadow:'0 0 16px #A0603033' },
  };

  return (
      <div>
        {/* Top 3 podium */}
        {!loading && board.length >= 3 && (
            <div style={{
              display:'grid', gridTemplateColumns:'1fr 1.2fr 1fr',
              gap:12, marginBottom:24,
            }}>
              {[board[1], board[0], board[2]].map((entry,podiumIdx)=>{
                if (!entry) return <div key={podiumIdx}/>;
                const rank = podiumIdx===1 ? 1 : podiumIdx===0 ? 2 : 3;
                const rs = RANK_STYLES[rank];
                const perf = PERF[entry.performanceLevel] || PERF.AVERAGE;
                return (
                    <div key={entry.technicianId}
                         onClick={()=>onViewDetail(entry)}
                         style={{
                           background:rs.bg, border:`2px solid ${rs.border}`,
                           borderRadius:14, padding:'20px 16px',
                           textAlign:'center', cursor:'pointer',
                           boxShadow:rs.shadow, transition:'all 0.16s',
                           order: podiumIdx===1 ? -1 : 0,
                           marginTop: podiumIdx===1 ? 0 : 20,
                           animation:`kpi-fadein 0.4s ease ${podiumIdx*0.1}s both`,
                         }}
                         onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.03)';e.currentTarget.style.boxShadow=rs.shadow.replace('44','88');}}
                         onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow=rs.shadow;}}
                    >
                      <div style={{ fontSize:32, marginBottom:4 }}>{rs.badge}</div>

                      {/* Avatar */}
                      <div style={{
                        width:52, height:52, borderRadius:'50%', margin:'0 auto 8px',
                        background:`linear-gradient(135deg, ${K.electricD}, ${K.electric})`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:22, fontWeight:900, color:K.bg,
                        fontFamily:'Barlow Condensed,sans-serif',
                        border:`2px solid ${rs.border}`,
                        boxShadow:`0 0 12px ${rs.border}55`,
                      }}>
                        {entry.avatarInitial||entry.technicianName?.charAt(0)||'T'}
                      </div>

                      <div style={{
                        fontSize:13, fontWeight:800, color:K.text,
                        fontFamily:'Barlow Condensed,sans-serif', marginBottom:2,
                        letterSpacing:0.3,
                      }}>
                        {entry.technicianName}
                      </div>
                      <div style={{ fontSize:10, color:K.muted, marginBottom:8 }}>
                        {entry.branchName||'—'}
                      </div>

                      {/* Score */}
                      <div style={{
                        fontSize:32, fontWeight:900, color:scoreColor(entry.overallScore),
                        fontFamily:'Barlow Condensed,sans-serif',
                        textShadow:`0 0 12px ${scoreColor(entry.overallScore)}66`,
                        lineHeight:1,
                      }}>
                        {Math.round(entry.overallScore||0)}
                      </div>
                      <div style={{ fontSize:9, color:K.muted, marginBottom:8 }}>/ 100</div>

                      <Stars rating={entry.starRating||0} size={12}/>

                      <div style={{
                        marginTop:8, padding:'4px 8px', borderRadius:20,
                        background:`${perf.color}22`, border:`1px solid ${perf.color}55`,
                        fontSize:9, fontWeight:800, color:perf.color, letterSpacing:0.8,
                      }}>
                        {perf.label}
                      </div>
                    </div>
                );
              })}
            </div>
        )}

        {/* Rest of leaderboard */}
        <div style={{
          background:K.panel, border:`1px solid ${K.border}`,
          borderRadius:12, overflow:'hidden',
        }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
            <tr style={{ borderBottom:`2px solid ${K.border}` }}>
              {['#','Technician','Branch','Score','Stars','Completed','Comp%','Satisfaction','Trend'].map((h,i)=>(
                  <th key={i} style={{
                    padding:'10px 14px', textAlign: i<2 ? 'center' : 'left',
                    background:K.surface, fontSize:9, fontWeight:800,
                    color:K.muted, letterSpacing:0.8, textTransform:'uppercase',
                    fontFamily:'JetBrains Mono,monospace',
                  }}>{h}</th>
              ))}
            </tr>
            </thead>
            <tbody>
            {loading ? (
                [...Array(8)].map((_,i)=>(
                    <tr key={i}>
                      {[...Array(9)].map((_,j)=>(
                          <td key={j} style={{ padding:'12px 14px', borderBottom:`1px solid ${K.border2}` }}>
                            <Skeleton h={12}/>
                          </td>
                      ))}
                    </tr>
                ))
            ) : board.length===0 ? (
                <tr><td colSpan={9} style={{ padding:'48px 24px', textAlign:'center', color:K.muted, fontSize:13 }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>🏆</div>
                  No leaderboard data for this period
                </td></tr>
            ) : (
                board.slice(board.length >= 3 ? 3 : 0).map((entry, i) => {
                  const rank = (board.length>=3 ? i+4 : i+1);
                  const perf = PERF[entry.performanceLevel] || PERF.AVERAGE;
                  return (
                      <tr key={entry.technicianId||i}
                          onClick={()=>onViewDetail(entry)}
                          style={{
                            borderBottom:`1px solid ${K.border2}`,
                            cursor:'pointer', transition:'background 0.1s',
                            animation:`kpi-fadein 0.25s ease ${i*0.03}s both`,
                          }}
                          onMouseEnter={e=>[...e.currentTarget.querySelectorAll('td')].forEach(td=>td.style.background=K.lift)}
                          onMouseLeave={e=>[...e.currentTarget.querySelectorAll('td')].forEach(td=>td.style.background='')}
                      >
                        <td style={{ padding:'11px 14px', textAlign:'center', width:40 }}>
                      <span style={{
                        fontSize:12, fontWeight:800, color:K.muted,
                        fontFamily:'JetBrains Mono,monospace',
                      }}>#{rank}</span>
                        </td>
                        <td style={{ padding:'11px 14px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                            <div style={{
                              width:32, height:32, borderRadius:'50%', flexShrink:0,
                              background:`linear-gradient(135deg, ${K.electricD}88, ${K.electric}88)`,
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:13, fontWeight:800, color:K.bg,
                            }}>
                              {entry.avatarInitial||entry.technicianName?.charAt(0)||'T'}
                            </div>
                            <div>
                              <div style={{ fontSize:12, fontWeight:700, color:K.text }}>
                                {entry.technicianName}
                              </div>
                              <div style={{ fontSize:10, color:K.muted }}>{entry.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'11px 14px', fontSize:11, color:K.muted }}>
                          {entry.branchName||'—'}
                        </td>
                        <td style={{ padding:'11px 14px' }}>
                      <span style={{
                        fontSize:18, fontWeight:900, color:scoreColor(entry.overallScore),
                        fontFamily:'Barlow Condensed,sans-serif',
                        textShadow:`0 0 8px ${scoreColor(entry.overallScore)}55`,
                      }}>
                        {Math.round(entry.overallScore||0)}
                      </span>
                        </td>
                        <td style={{ padding:'11px 14px' }}>
                          <Stars rating={entry.starRating||0} size={12}/>
                        </td>
                        <td style={{ padding:'11px 14px', fontSize:12, color:K.lime, fontWeight:700 }}>
                          {entry.completedJobs||0}
                        </td>
                        <td style={{ padding:'11px 14px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ flex:1, height:4, background:K.border, borderRadius:2, overflow:'hidden', minWidth:50 }}>
                              <div style={{
                                height:'100%', width:`${Math.min(entry.completionRate||0,100)}%`,
                                background:scoreColor(entry.completionRate||0), borderRadius:2,
                              }}/>
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, color:K.muted, minWidth:32 }}>
                          {round1(entry.completionRate||0)}%
                        </span>
                          </div>
                        </td>
                        <td style={{ padding:'11px 14px' }}>
                          <Stars rating={entry.satisfactionScore||0} size={11}/>
                        </td>
                        <td style={{ padding:'11px 14px' }}>
                      <span style={{
                        fontSize:10, padding:'2px 8px', borderRadius:20,
                        background: perf.bg, color:perf.color,
                        border:`1px solid ${perf.color}44`, fontWeight:800,
                      }}>
                        {perf.label}
                      </span>
                        </td>
                      </tr>
                  );
                })
            )}
            </tbody>
          </table>
        </div>
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM KPI TAB
// ═══════════════════════════════════════════════════════════════════════════════
function TeamKpiTab({ period }) {
  const [teamData, setTeamData] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [branchId, setBranchId] = useState('1');

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const d = await get(`/api/kpi/team?period=${period}&branchId=${branchId}`);
      setTeamData(d);
    } catch(e){console.error(e);}
    finally { setLoading(false); }
  },[period, branchId]);

  useEffect(()=>{ load(); },[load]);

  return (
      <div>
        <div style={{ display:'flex', gap:10, marginBottom:20, alignItems:'center' }}>
          <TSelect value={branchId} onChange={setBranchId}>
            {['1','2','3','4','5'].map(b=>(
                <option key={b} value={b}>Branch {b}</option>
            ))}
          </TSelect>
          <Btn variant="ghost" onClick={load}>🔄 Refresh</Btn>
        </div>

        {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[...Array(4)].map((_,i)=><Skeleton key={i} h={80} r={12}/>)}
            </div>
        ) : !teamData ? (
            <div style={{ textAlign:'center', padding:48, color:K.muted }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📊</div>
              No team data available
            </div>
        ) : (
            <>
              {/* Team aggregate stats */}
              <div style={{
                background:`linear-gradient(135deg, ${K.electricL}, ${K.surface})`,
                border:`1px solid ${K.electric}55`, borderRadius:14,
                padding:'20px 24px', marginBottom:20,
                boxShadow:`0 4px 24px ${K.electric}11`,
              }}>
                <div style={{
                  fontSize:14, fontWeight:900, color:K.electric,
                  fontFamily:'Barlow Condensed,sans-serif', letterSpacing:1, marginBottom:14,
                }}>
                  {teamData.branchName || `Branch ${branchId}`} — Team Overview
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:12 }}>
                  {[
                    { label:'Team Score',     value:Math.round(teamData.teamOverallScore||0), color:scoreColor(teamData.teamOverallScore||0), suffix:'/100' },
                    { label:'Total Members',  value:teamData.totalMembers||0,   color:K.text     },
                    { label:'Jobs Assigned',  value:teamData.totalJobsAssigned||0,  color:K.muted    },
                    { label:'Jobs Completed', value:teamData.totalJobsCompleted||0, color:K.lime     },
                    { label:'Completion %',   value:pct(teamData.teamCompletionRate||0), color:scoreColor(teamData.teamCompletionRate||0) },
                    { label:'Satisfaction',   value:`${round1(teamData.teamSatisfactionScore||0)}/5`, color:K.amber },
                    { label:'Attendance %',   value:pct(teamData.teamAttendanceRate||0), color:K.electric },
                    { label:'Revenue',        value:`${((teamData.totalTeamRevenue||0)/1000).toFixed(0)}K`, color:K.amber },
                  ].map((s,i)=>(
                      <div key={i} style={{
                        padding:'10px 12px', borderRadius:10,
                        background:'rgba(0,229,255,0.05)', border:`1px solid ${K.electric}22`,
                      }}>
                        <div style={{
                          fontSize:20, fontWeight:900, color:s.color,
                          fontFamily:'Barlow Condensed,sans-serif', lineHeight:1,
                        }}>
                          {s.value}
                          {s.suffix && <span style={{ fontSize:11, color:K.muted, marginLeft:2 }}>{s.suffix}</span>}
                        </div>
                        <div style={{ fontSize:9, color:K.muted, marginTop:3, letterSpacing:0.5 }}>{s.label}</div>
                      </div>
                  ))}
                </div>
              </div>

              {/* Team average metric bars */}
              <div style={{
                background:K.surface, borderRadius:12, padding:18,
                border:`1px solid ${K.border}`, marginBottom:20,
              }}>
                <div style={{ fontSize:10, color:K.muted, fontWeight:800, marginBottom:12, letterSpacing:0.8 }}>
                  TEAM METRIC BREAKDOWN
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {[
                    { label:'Completion Rate',   value:teamData.teamCompletionRate||0,  color:K.lime     },
                    { label:'On-Time Rate',      value:teamData.teamOnTimeRate||0,       color:K.electric },
                    { label:'Attendance Rate',   value:teamData.teamAttendanceRate||0,   color:K.amber    },
                    { label:'Satisfaction/5×20', value:(teamData.teamSatisfactionScore||0)*20, color:K.violet },
                  ].map((m,i)=>(
                      <ProgressBar key={i} label={m.label} pct={m.value} color={m.color} h={6}/>
                  ))}
                </div>
              </div>

              {/* Member cards */}
              {teamData.memberKpis?.length > 0 && (
                  <>
                    <div style={{ fontSize:10, color:K.muted, fontWeight:800, marginBottom:12, letterSpacing:0.8 }}>
                      MEMBER BREAKDOWN
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:10 }}>
                      {teamData.memberKpis.map((m,i)=>{
                        const perf = PERF[m.performanceLevel] || PERF.AVERAGE;
                        return (
                            <div key={m.technicianId||i} style={{
                              background:K.panel, borderRadius:12, padding:14,
                              border:`1px solid ${K.border}`,
                              animation:`kpi-fadein 0.3s ease ${i*0.05}s both`,
                              transition:'all 0.15s',
                            }}
                                 onMouseEnter={e=>{e.currentTarget.style.borderColor=perf.color+'55';e.currentTarget.style.boxShadow=`0 4px 16px ${perf.color}11`;}}
                                 onMouseLeave={e=>{e.currentTarget.style.borderColor=K.border;e.currentTarget.style.boxShadow='none';}}
                            >
                              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                                <ScoreRing score={m.overallScore||0} size={50} stroke={5}/>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:12, fontWeight:800, color:K.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                    {m.name||m.technicianName}
                                  </div>
                                  <Stars rating={m.starRating||0} size={11}/>
                                  <div style={{
                                    marginTop:4, display:'inline-flex', alignItems:'center',
                                    padding:'2px 7px', borderRadius:4,
                                    background:perf.bg, color:perf.color,
                                    fontSize:9, fontWeight:800, letterSpacing:0.5,
                                  }}>
                                    {perf.label}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
                                {[
                                  { l:'Jobs',     v:`${m.completedJobs||0}/${m.totalJobs||0}`, c:K.lime    },
                                  { l:'Comp %',   v:pct(m.completionRate||0),                  c:scoreColor(m.completionRate||0) },
                                  { l:'On-Time',  v:pct(m.onTimeCompletionRate||0),            c:K.electric },
                                  { l:'Attend.',  v:pct(m.attendanceRate||0),                  c:K.amber   },
                                ].map((s,j)=>(
                                    <div key={j} style={{
                                      padding:'6px 8px', borderRadius:7,
                                      background:K.surface, border:`1px solid ${K.border2}`,
                                    }}>
                                      <div style={{ fontSize:13, fontWeight:800, color:s.c, fontFamily:'Barlow Condensed,sans-serif' }}>{s.v}</div>
                                      <div style={{ fontSize:8, color:K.muted, letterSpacing:0.5 }}>{s.l}</div>
                                    </div>
                                ))}
                              </div>
                            </div>
                        );
                      })}
                    </div>
                  </>
              )}
            </>
        )}
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function KpiPage() {
  const [tab,          setTab]          = useState('leaderboard');
  const [period,       setPeriod]       = useState('MONTHLY');
  const [toast,        setToast]        = useState(null);
  const [detailTech,   setDetailTech]   = useState(null);
  const [assignTo,     setAssignTo]     = useState(null);
  const [assignOpen,   setAssignOpen]   = useState(false);
  const [technicians,  setTechnicians]  = useState([]);

  const showToast = useCallback((msg, type='success') => setToast({msg,type}), []);

  // Load technician list for assign modal
  useEffect(()=>{
    get('/api/users').then(d=>{
      const list = Array.isArray(d) ? d : d?.content || [];
      setTechnicians(list.filter(u=>u.role==='TECHNICIAN'||u.role==='TEAM_LEAD'));
    }).catch(()=>{});
  },[]);

  // Inject CSS
  useEffect(()=>{
    const id='kpi-page-css';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.innerHTML=`
      @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
      @keyframes kpi-shimmer  {0%{background-position:200% 0}100%{background-position:-200% 0}}
      @keyframes kpi-fadein   {from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      @keyframes kpi-slidein  {from{opacity:0;transform:translateY(-14px)scale(0.97)}to{opacity:1;transform:none}}
      @keyframes kpi-toastin  {from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
      .kpi-page *{box-sizing:border-box;}
      ::-webkit-scrollbar{width:4px;height:4px}
      ::-webkit-scrollbar-track{background:${K.bg}}
      ::-webkit-scrollbar-thumb{background:${K.border};border-radius:4px}
      ::-webkit-scrollbar-thumb:hover{background:${K.electric}55}
    `;
    document.head.appendChild(s);
  },[]);

  const TABS = [
    { id:'leaderboard', label:'🏆 Leaderboard' },
    { id:'team',        label:'👥 Team KPI' },
  ];

  return (
      <div className="kpi-page" style={{
        background:K.bg, minHeight:'100vh',
        padding:'28px 32px', fontFamily:'JetBrains Mono,monospace',
      }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28 }}>
          <div>
            <h1 style={{
              margin:0, fontSize:28, fontWeight:900, color:K.text,
              fontFamily:'Barlow Condensed,sans-serif', letterSpacing:0.5,
              background:`linear-gradient(90deg, ${K.electric}, ${K.lime})`,
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            }}>
              KPI Performance
            </h1>
            <div style={{ fontSize:11, color:K.muted, marginTop:4 }}>
              Track, compare and assign performance targets across the field team
            </div>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <PeriodSelector value={period} onChange={v=>{ setPeriod(v); }}/>
            <Btn variant="lime" onClick={()=>setAssignOpen(true)}>
              🎯 Assign Target
            </Btn>
          </div>
        </div>

        {/* Weights info strip */}
        <div style={{
          display:'flex', gap:6, marginBottom:20, flexWrap:'wrap',
        }}>
          {[
            { label:'Completion', weight:'35%', color:K.lime     },
            { label:'Satisfaction','weight':'25%', color:K.electric},
            { label:'On-Time',    weight:'20%', color:K.amber    },
            { label:'Response',   weight:'10%', color:K.violet   },
            { label:'Attendance', weight:'10%', color:K.muted    },
          ].map((w,i)=>(
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'5px 12px', borderRadius:20,
                background:K.surface, border:`1px solid ${K.border}`,
                fontSize:10, color:K.muted,
              }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:w.color }}/>
                <span>{w.label}</span>
                <span style={{ color:w.color, fontWeight:800 }}>{w.weight}</span>
              </div>
          ))}
          <div style={{ marginLeft:'auto', fontSize:10, color:K.dim, alignSelf:'center' }}>
            Score weights per SRS §5.3.4
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display:'flex', gap:2, marginBottom:24,
          borderBottom:`1px solid ${K.border}`,
        }}>
          {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                padding:'10px 20px', border:'none', cursor:'pointer',
                background:'none', fontSize:12, fontWeight:700,
                color: tab===t.id ? K.electric : K.muted,
                borderBottom:`2px solid ${tab===t.id ? K.electric : 'transparent'}`,
                marginBottom:-1, transition:'all 0.13s',
                fontFamily:'JetBrains Mono,monospace',
                boxShadow: tab===t.id ? `0 1px 8px ${K.electric}44` : 'none',
              }}>{t.label}</button>
          ))}
        </div>

        {/* Tab content */}
        {tab==='leaderboard' && (
            <LeaderboardTab
                period={period}
                onViewDetail={entry=>{
                  // Map leaderboard entry to tech shape
                  setDetailTech({
                    technicianId: entry.technicianId,
                    name: entry.technicianName,
                    phone: entry.phone,
                    avatarInitial: entry.avatarInitial,
                  });
                }}
                onAssignTarget={entry=>{
                  setAssignTo({ id:entry.technicianId, name:entry.technicianName });
                  setAssignOpen(true);
                }}
            />
        )}
        {tab==='team' && (
            <TeamKpiTab period={period}/>
        )}

        {/* Technician KPI detail drawer */}
        <TechKpiDrawer
            tech={detailTech}
            period={period}
            open={!!detailTech}
            onClose={()=>setDetailTech(null)}
            onAssignTarget={tech=>{
              setDetailTech(null);
              setAssignTo({ id:tech.technicianId||tech.id, name:tech.name||tech.technicianName });
              setAssignOpen(true);
            }}
        />

        {/* Assign target modal */}
        <AssignTargetModal
            technicians={technicians.length > 0 ? technicians : (
                // If users not loaded yet, synthesise from leaderboard data
                assignTo ? [{ id:assignTo.id, fullName:assignTo.name }] : []
            )}
            open={assignOpen}
            onClose={()=>{ setAssignOpen(false); setAssignTo(null); }}
            onSuccess={showToast}
        />

        {/* Toast */}
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      </div>
  );
}