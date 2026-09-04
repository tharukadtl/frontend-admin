import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine
} from 'recharts';

// ─── API ──────────────────────────────────────────────────────────────────────
const API   = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const AI    = process.env.REACT_APP_AI_URL  || 'http://localhost:5000';
const tok   = () => localStorage.getItem('accessToken');
const req   = (method, path, body, base = API) =>
    fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: body ? JSON.stringify(body) : undefined,
    }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });
const get  = p       => req('GET',  p);
const post = (p, b)  => req('POST', p, b);
const aiGet = p      => req('GET',  p, undefined, AI);

// ─── Palette — crisp slate editorial ─────────────────────────────────────────
const R = {
  bg:      '#F8F9FC',
  bg2:     '#EEF1F8',
  surface: '#FFFFFF',
  border:  '#D8DFEE',
  border2: '#E8EDF8',
  text:    '#1A2038',
  muted:   '#5A6888',
  dim:     '#8A9ABB',
  navy:    '#1E3A6E',
  navyL:   '#EBF0FA',
  blue:    '#2563EB',
  blueL:   '#DBEAFE',
  teal:    '#0891B2',
  tealL:   '#CFFAFE',
  green:   '#16A34A',
  greenL:  '#DCFCE7',
  orange:  '#EA580C',
  orangeL: '#FEF0E7',
  rose:    '#E11D48',
  roseL:   '#FFF0F3',
  violet:  '#7C3AED',
  violetL: '#F3EEFF',
  amber:   '#D97706',
  amberL:  '#FFFBEB',
  white:   '#FFFFFF',
};

// ─── Chart colours ────────────────────────────────────────────────────────────
const CHART = ['#2563EB','#16A34A','#EA580C','#7C3AED','#0891B2','#D97706'];

// ─── Report templates ─────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id:       'fault_trends',
    title:    'Fault Trends',
    desc:     'Daily fault volume over time — opened vs completed',
    icon:     '📈',
    color:    R.blue,
    colorL:   R.blueL,
    apiPath:  '/api/reports/fault-trends',
    params:   { period:'THIS_MONTH' },
    chartType:'area',
    dataKey:  'data',
    xKey:     'date',
    series:   [
      { key:'opened',    label:'Opened',    color:'#E11D48' },
      { key:'completed', label:'Completed', color:'#16A34A' },
      { key:'total',     label:'Total',     color:'#2563EB' },
    ],
  },
  {
    id:       'technician_performance',
    title:    'Technician Performance',
    desc:     'Completion rates, satisfaction scores and response times',
    icon:     '👷',
    color:    R.green,
    colorL:   R.greenL,
    apiPath:  '/api/reports/technician-performance',
    params:   { period:'THIS_MONTH' },
    chartType:'bar',
    dataKey:  'data',
    xKey:     'technicianName',
    series:   [
      { key:'completionRate',             label:'Completion %',  color:'#16A34A' },
      { key:'customerSatisfactionScore',  label:'Satisfaction',  color:'#D97706' },
    ],
  },
  {
    id:       'financial_summary',
    title:    'Financial Summary',
    desc:     'FOC vs chargeable breakdown and payment approval rates',
    icon:     '💰',
    color:    R.orange,
    colorL:   R.orangeL,
    apiPath:  '/api/reports/financial-summary',
    params:   { period:'THIS_MONTH' },
    chartType:'kv',       // key-value display
    dataKey:  'data',
  },
  {
    id:       'customer_satisfaction',
    title:    'Customer Satisfaction',
    desc:     'Rating distribution and satisfaction trends',
    icon:     '⭐',
    color:    R.amber,
    colorL:   R.amberL,
    apiPath:  '/api/reports/customer-satisfaction',
    params:   { period:'THIS_MONTH' },
    chartType:'pie',
    dataKey:  'data',
  },
  {
    id:       'daily_fault_summary',
    title:    'Daily Fault Summary',
    desc:     'Category/status breakdown, technician workload and geographic spread',
    icon:     '📋',
    color:    R.navy,
    colorL:   R.navyL,
    apiPath:  '/api/reports/daily-fault-summary',
    params:   { period:'TODAY' },
    chartType:'daily_summary',
    dataKey:  'data',
  },
  {
    id:       'fault_aging',
    title:    'Fault Aging',
    desc:     'Open faults bucketed by age, with escalation flags',
    icon:     '⏳',
    color:    R.rose,
    colorL:   R.roseL,
    apiPath:  '/api/reports/fault-aging',
    params:   {},
    chartType:'table',
    dataKey:  'data',
  },
  {
    id:       'material_cost',
    title:    'Material Cost Report',
    desc:     'FOC vs chargeable costs, most-used materials, reorder estimates',
    icon:     '📦',
    color:    R.teal,
    colorL:   R.tealL,
    apiPath:  '/api/reports/material-cost',
    params:   { period:'THIS_MONTH' },
    chartType:'material_cost',
    dataKey:  'data',
  },
  {
    id:       'ai_forecast',
    title:    'AI Fault Forecast',
    desc:     'Prophet-based fault volume prediction (via backend AI integration)',
    icon:     '🔮',
    color:    R.violet,
    colorL:   R.violetL,
    apiPath:  '/api/reports/ai-forecast',
    params:   { horizonDays:30 },
    chartType:'ai_forecast',
    dataKey:  'data',
  },
  {
    id:       'geographic_demand',
    title:    'Geographic Demand',
    desc:     'K-Means fault demand clusters by region (via backend AI integration)',
    icon:     '🗺️',
    color:    R.teal,
    colorL:   R.tealL,
    apiPath:  '/api/reports/geographic-demand',
    params:   {},
    chartType:'geo_demand',
    dataKey:  'data',
  },
  {
    id:       'kpi_performance',
    title:    'KPI Performance',
    desc:     'Technician leaderboard, star ratings and Gold/Silver/Bronze badges',
    icon:     '🏆',
    color:    R.amber,
    colorL:   R.amberL,
    apiPath:  '/api/reports/kpi-performance',
    params:   { period:'MONTHLY' },
    chartType:'table',
    dataKey:  'data',
  },
  {
    id:       'attendance',
    title:    'Attendance Report',
    desc:     'Check-in/out times, GPS location and working hours',
    icon:     '🕒',
    color:    R.blue,
    colorL:   R.blueL,
    apiPath:  '/api/reports/attendance',
    params:   { period:'THIS_MONTH' },
    chartType:'table',
    dataKey:  'data',
  },
  {
    id:       'audit_trail',
    title:    'Audit Trail',
    desc:     'Unified log of fault, payment, stock and user account changes',
    icon:     '🔍',
    color:    R.muted,
    colorL:   R.bg2,
    apiPath:  '/api/reports/audit-trail',
    params:   { period:'THIS_MONTH' },
    chartType:'table',
    dataKey:  'data',
  },
];

// ─── Preset periods ───────────────────────────────────────────────────────────
const PRESETS = [
  { label:'Today',       value:'TODAY'       },
  { label:'This Week',   value:'THIS_WEEK'   },
  { label:'This Month',  value:'THIS_MONTH'  },
  { label:'Last Month',  value:'LAST_MONTH'  },
  { label:'Custom',      value:'CUSTOM'      },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtLKR  = v => v != null ? `LKR ${Number(v).toLocaleString('en-LK',{minimumFractionDigits:2})}` : '—';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const today   = () => new Date().toISOString().slice(0,10);
const nDaysAgo = n => new Date(Date.now()-n*86400000).toISOString().slice(0,10);

// ─── Download blob ────────────────────────────────────────────────────────────
const downloadBlob = (data, filename, type) => {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ═══════════════════════════════════════════════════════════════════════════════
// MICRO-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const Skeleton = ({ h=14, w='100%', r=6 }) => (
    <div style={{
      height:h, width:w, borderRadius:r,
      background:`linear-gradient(90deg,${R.bg2} 25%,${R.border} 50%,${R.bg2} 75%)`,
      backgroundSize:'400% 100%', animation:'rpt-shimmer 1.5s ease infinite',
    }}/>
);

const Toast = ({ msg, type, onDone }) => {
  useEffect(()=>{const t=setTimeout(onDone,3200);return()=>clearTimeout(t);},[onDone]);
  const col = type==='success'?R.green:type==='error'?R.rose:R.amber;
  return (
      <div style={{
        position:'fixed', bottom:28, right:28, zIndex:3000,
        background:R.surface, border:`2px solid ${col}`,
        borderRadius:12, padding:'12px 20px', fontSize:13, color:R.text,
        boxShadow:`0 8px 32px rgba(0,0,0,0.15)`,
        display:'flex', alignItems:'center', gap:10, maxWidth:380,
        animation:'rpt-toastin 0.22s ease',
        fontFamily:'Epilogue,sans-serif',
      }}>
        <span style={{ fontSize:18 }}>{type==='success'?'✅':type==='error'?'❌':'⚠️'}</span>
        {msg}
      </div>
  );
};

const Btn = ({ children, variant='outline', onClick, disabled=false, loading=false, sx={} }) => {
  const [hov, setHov] = useState(false);
  const v = {
    outline: { bg:'transparent', hbg:R.bg2,    color:R.text,   border:R.border  },
    primary: { bg:R.navy,        hbg:'#162D55', color:R.white,  border:R.navy    },
    blue:    { bg:R.blueL,       hbg:'#BFDBFE', color:R.blue,   border:R.blue    },
    teal:    { bg:R.tealL,       hbg:'#A5F3FC', color:R.teal,   border:R.teal    },
    green:   { bg:R.greenL,      hbg:'#BBF7D0', color:R.green,  border:R.green   },
    orange:  { bg:R.orangeL,     hbg:'#FED7AA', color:R.orange, border:R.orange  },
    violet:  { bg:R.violetL,     hbg:'#DDD6FE', color:R.violet, border:R.violet  },
  }[variant]||{};
  return (
      <button
          onClick={onClick} disabled={disabled||loading}
          onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
          style={{
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:700,
            cursor:(disabled||loading)?'not-allowed':'pointer',
            opacity:(disabled||loading)?0.5:1,
            background:hov?v.hbg:v.bg, border:`1.5px solid ${v.border}`,
            color:v.color, transition:'all 0.13s', whiteSpace:'nowrap',
            fontFamily:'Epilogue,sans-serif', letterSpacing:0.2, ...sx,
          }}
      >
        {loading ? <span style={{ animation:'rpt-spin 0.8s linear infinite', display:'inline-block' }}>⏳</span> : children}
      </button>
  );
};

// ─── Custom chart tooltip ─────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
      <div style={{
        background:R.surface, border:`1px solid ${R.border}`,
        borderRadius:10, padding:'10px 14px',
        boxShadow:'0 4px 20px rgba(0,0,0,0.12)',
        fontSize:12, fontFamily:'Epilogue,sans-serif',
      }}>
        <div style={{ fontWeight:700, color:R.text, marginBottom:6 }}>
          {String(label).length > 20 ? String(label).slice(0,18)+'…' : label}
        </div>
        {payload.map((p,i)=>(
            <div key={i} style={{ color:R.muted, marginBottom:2 }}>
              <span style={{ color:p.color }}>● </span>
              {p.name}: <b style={{ color:R.text }}>{
              typeof p.value === 'number'
                  ? p.value % 1 === 0 ? p.value : p.value.toFixed(1)
                  : p.value
            }</b>
            </div>
        ))}
      </div>
  );
};

// ─── AI Prediction chart ──────────────────────────────────────────────────────
function AIPredictionChart({ data, loading }) {
  if (loading) return (
      <div style={{ padding:'20px 0', display:'flex', flexDirection:'column', gap:10 }}>
        <Skeleton h={200} r={8}/>
      </div>
  );
  if (!data || !data.length) return (
      <div style={{
        padding:'40px 20px', textAlign:'center',
        color:R.muted, fontSize:13,
      }}>
        <div style={{ fontSize:32, marginBottom:8 }}>🤖</div>
        AI predictions unavailable — ensure Flask AI service is running on port 5000
      </div>
  );

  const forecastStart = data.findIndex(d => d.isForecast);

  return (
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top:10, right:10, left:-20, bottom:0 }}>
          <defs>
            <linearGradient id="aiHistGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={R.blue} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={R.blue} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="aiForeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={R.violet} stopOpacity={0.4}/>
              <stop offset="95%" stopColor={R.violet} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={R.border2} vertical={false}/>
          <XAxis
              dataKey="date" tick={{ fontSize:10, fill:R.muted }}
              tickLine={false} axisLine={false}
              tickFormatter={d => d?.slice(5)}
              interval={Math.max(1, Math.floor(data.length/8))}
          />
          <YAxis tick={{ fontSize:10, fill:R.muted }} tickLine={false} axisLine={false}/>
          <Tooltip content={<ChartTooltip/>}/>
          {forecastStart > 0 && (
              <ReferenceLine
                  x={data[forecastStart]?.date}
                  stroke={R.violet} strokeDasharray="4 2"
                  label={{ value:'Forecast →', position:'top', fill:R.violet, fontSize:10 }}
              />
          )}
          <Area
              type="monotone" dataKey="actual" name="Historical"
              stroke={R.blue} strokeWidth={2}
              fill="url(#aiHistGrad)" dot={false}
              connectNulls
          />
          <Area
              type="monotone" dataKey="forecast" name="AI Forecast"
              stroke={R.violet} strokeWidth={2.5} strokeDasharray="6 3"
              fill="url(#aiForeGrad)" dot={false}
              connectNulls
          />
          {data[0]?.upperBound != null && (
              <Area
                  type="monotone" dataKey="upperBound" name="Upper Bound"
                  stroke={R.violet} strokeWidth={0.5} strokeDasharray="2 4"
                  fill="none" dot={false} connectNulls
              />
          )}
          {data[0]?.lowerBound != null && (
              <Area
                  type="monotone" dataKey="lowerBound" name="Lower Bound"
                  stroke={R.violet} strokeWidth={0.5} strokeDasharray="2 4"
                  fill="none" dot={false} connectNulls
              />
          )}
          <Legend iconType="circle" iconSize={7}
                  formatter={v=><span style={{ fontSize:11, color:R.muted }}>{v}</span>}
          />
        </AreaChart>
      </ResponsiveContainer>
  );
}

// ─── Financial KV display ─────────────────────────────────────────────────────
function FinancialDisplay({ data }) {
  if (!data) return <Skeleton h={120} r={8}/>;
  const rows = [
    { label:'Total Revenue',           value:fmtLKR(data.totalRevenue),          color:R.navy   },
    { label:'FOC Amount',              value:fmtLKR(data.totalFOCAmount),         color:R.green  },
    { label:'Chargeable Amount',       value:fmtLKR(data.totalChargeableAmount),  color:R.orange },
    { label:'Payments Submitted',      value:data.totalPaymentsSubmitted,         color:R.text   },
    { label:'Approved',                value:data.totalPaymentsApproved,          color:R.green  },
    { label:'Pending',                 value:data.totalPaymentsPending,           color:R.amber  },
    { label:'Rejected',                value:data.totalPaymentsRejected,          color:R.rose   },
    { label:'Approval Rate',           value:data.approvalRate ? `${data.approvalRate?.toFixed(1)}%` : '—', color:R.blue },
  ];
  return (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
        {rows.map((r,i)=>(
            <div key={i} style={{
              padding:'14px 16px', borderRadius:10,
              background:R.bg, border:`1px solid ${R.border}`,
              animation:`rpt-fadein 0.3s ease ${i*0.04}s both`,
            }}>
              <div style={{ fontSize:20, fontWeight:800, color:r.color, fontFamily:'Epilogue,sans-serif' }}>
                {r.value ?? '—'}
              </div>
              <div style={{ fontSize:11, color:R.muted, marginTop:2 }}>{r.label}</div>
            </div>
        ))}
      </div>
  );
}

// ─── Satisfaction pie ─────────────────────────────────────────────────────────
function SatisfactionDisplay({ data }) {
  if (!data) return <Skeleton h={200} r={8}/>;
  const pieData = [
    { name:'5 Stars', value:data.rating5Count||0, color:'#16A34A' },
    { name:'4 Stars', value:data.rating4Count||0, color:'#65A30D' },
    { name:'3 Stars', value:data.rating3Count||0, color:'#D97706' },
    { name:'2 Stars', value:data.rating2Count||0, color:'#EA580C' },
    { name:'1 Star',  value:data.rating1Count||0, color:'#E11D48' },
  ].filter(d=>d.value>0);

  return (
      <div style={{ display:'flex', gap:20, alignItems:'center', flexWrap:'wrap' }}>
        <ResponsiveContainer width={200} height={200}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                 paddingAngle={3} dataKey="value" stroke="none"
            >
              {pieData.map((_,i)=><Cell key={i} fill={pieData[i].color}/>)}
            </Pie>
            <Tooltip formatter={(v,n)=>[v,n]}/>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex:1, minWidth:180 }}>
          <div style={{
            fontSize:40, fontWeight:800, color:R.amber,
            fontFamily:'Epilogue,sans-serif', lineHeight:1,
          }}>
            {data.overallScore?.toFixed(1)}/5
          </div>
          <div style={{ fontSize:13, color:R.muted, marginBottom:12 }}>
            from {data.totalResponses} responses
          </div>
          {pieData.map((d,i)=>(
              <div key={i} style={{ marginBottom:5 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                  <span style={{ fontSize:11, color:R.muted }}>{d.name}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:R.text }}>{d.value}</span>
                </div>
                <div style={{ height:4, background:R.bg2, borderRadius:2, overflow:'hidden' }}>
                  <div style={{
                    height:'100%', borderRadius:2,
                    width:`${data.totalResponses>0?(d.value/data.totalResponses)*100:0}%`,
                    background:d.color, transition:'width 0.6s ease',
                  }}/>
                </div>
              </div>
          ))}
        </div>
      </div>
  );
}

// ─── Generic data table (fault aging / KPI / attendance / audit trail) ────────
const humanize = k => String(k)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase());

function GenericTable({ rows }) {
  if (!rows || !rows.length) return (
      <div style={{ padding:'32px 0', textAlign:'center', color:R.muted, fontSize:13 }}>
        No data for selected period
      </div>
  );
  const cols = Object.keys(rows[0]).filter(k => typeof rows[0][k] !== 'object');
  const fmtCell = v => {
    if (v == null) return '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return Number.isInteger(v) ? v : v.toFixed(1);
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString('en-GB');
    return v;
  };
  return (
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
          <tr style={{ borderBottom:`2px solid ${R.border}` }}>
            {cols.map((c,i)=>(
                <th key={i} style={{
                  padding:'8px 12px', textAlign:'left', background:R.bg,
                  fontSize:10, fontWeight:800, color:R.muted, letterSpacing:0.5, whiteSpace:'nowrap',
                }}>{humanize(c)}</th>
            ))}
          </tr>
          </thead>
          <tbody>
          {rows.slice(0,200).map((row,i)=>(
              <tr key={i} style={{ borderBottom:`1px solid ${R.border2}` }}>
                {cols.map((c,j)=>(
                    <td key={j} style={{ padding:'9px 12px', color:R.text, whiteSpace:'nowrap' }}>
                      {fmtCell(row[c])}
                    </td>
                ))}
              </tr>
          ))}
          </tbody>
        </table>
        {rows.length > 200 && (
            <div style={{ padding:'8px 0', fontSize:11, color:R.dim, textAlign:'center' }}>
              Showing first 200 of {rows.length} rows — export for the full list
            </div>
        )}
      </div>
  );
}

// ─── Daily fault summary display ───────────────────────────────────────────────
function DailyFaultSummaryDisplay({ data }) {
  if (!data) return <Skeleton h={200} r={8}/>;
  return (
      <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <div style={{ padding:'14px 16px', borderRadius:10, background:R.bg, border:`1px solid ${R.border}` }}>
            <div style={{ fontSize:22, fontWeight:800, color:R.navy, fontFamily:'Epilogue,sans-serif' }}>{data.totalFaults}</div>
            <div style={{ fontSize:11, color:R.muted }}>Total Faults</div>
          </div>
          <div style={{ padding:'14px 16px', borderRadius:10, background:R.bg, border:`1px solid ${R.border}` }}>
            <div style={{ fontSize:22, fontWeight:800, color:R.blue, fontFamily:'Epilogue,sans-serif' }}>{data.avgResolutionTimeHours?.toFixed(1)}h</div>
            <div style={{ fontSize:11, color:R.muted }}>Avg Resolution Time</div>
          </div>
        </div>
        {data.technicianWorkload?.length > 0 && (
            <div>
              <div style={{ fontSize:10, color:R.muted, fontWeight:700, letterSpacing:0.6, marginBottom:8 }}>TECHNICIAN WORKLOAD</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.technicianWorkload.slice(0,12)} margin={{ top:5, right:5, left:-20, bottom:20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={R.border2} vertical={false}/>
                  <XAxis dataKey="technicianName" tick={{ fontSize:9, fill:R.muted, angle:-30, textAnchor:'end' }} tickLine={false} axisLine={false} interval={0}/>
                  <YAxis tick={{ fontSize:9, fill:R.muted }} tickLine={false} axisLine={false}/>
                  <Tooltip content={<ChartTooltip/>}/>
                  <Bar dataKey="assignedFaults" name="Assigned Faults" fill={R.blue} radius={[4,4,0,0]} maxBarSize={28}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
        )}
        <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
          {data.byCategory?.length > 0 && (
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ fontSize:10, color:R.muted, fontWeight:700, letterSpacing:0.6, marginBottom:8 }}>BY CATEGORY</div>
                {data.byCategory.map((c,i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0' }}>
                      <span style={{ color:R.muted }}>{c.category}</span>
                      <span style={{ fontWeight:700, color:R.text }}>{c.count} ({c.percentage?.toFixed(0)}%)</span>
                    </div>
                ))}
              </div>
          )}
          {data.byStatus?.length > 0 && (
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ fontSize:10, color:R.muted, fontWeight:700, letterSpacing:0.6, marginBottom:8 }}>BY STATUS</div>
                {data.byStatus.map((c,i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0' }}>
                      <span style={{ color:R.muted }}>{c.category}</span>
                      <span style={{ fontWeight:700, color:R.text }}>{c.count} ({c.percentage?.toFixed(0)}%)</span>
                    </div>
                ))}
              </div>
          )}
          {data.geographicDistribution?.length > 0 && (
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ fontSize:10, color:R.muted, fontWeight:700, letterSpacing:0.6, marginBottom:8 }}>BY REGION</div>
                {data.geographicDistribution.slice(0,8).map((c,i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0' }}>
                      <span style={{ color:R.muted }}>{c.region}</span>
                      <span style={{ fontWeight:700, color:R.text }}>{c.faultCount}</span>
                    </div>
                ))}
              </div>
          )}
        </div>
      </div>
  );
}

// ─── Material cost display ──────────────────────────────────────────────────────
function MaterialCostDisplay({ data }) {
  if (!data) return <Skeleton h={200} r={8}/>;
  return (
      <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
          <div style={{ padding:'14px 16px', borderRadius:10, background:R.bg, border:`1px solid ${R.border}` }}>
            <div style={{ fontSize:20, fontWeight:800, color:R.green, fontFamily:'Epilogue,sans-serif' }}>{fmtLKR(data.totalFocCost)}</div>
            <div style={{ fontSize:11, color:R.muted }}>Total FOC Cost</div>
          </div>
          <div style={{ padding:'14px 16px', borderRadius:10, background:R.bg, border:`1px solid ${R.border}` }}>
            <div style={{ fontSize:20, fontWeight:800, color:R.orange, fontFamily:'Epilogue,sans-serif' }}>{fmtLKR(data.totalChargeableCost)}</div>
            <div style={{ fontSize:11, color:R.muted }}>Total Chargeable Cost</div>
          </div>
        </div>
        {data.mostUsedMaterials?.length > 0 && (
            <div>
              <div style={{ fontSize:10, color:R.muted, fontWeight:700, letterSpacing:0.6, marginBottom:8 }}>MOST USED MATERIALS</div>
              <GenericTable rows={data.mostUsedMaterials}/>
            </div>
        )}
        {data.reorderEstimates?.length > 0 && (
            <div>
              <div style={{ fontSize:10, color:R.muted, fontWeight:700, letterSpacing:0.6, marginBottom:8 }}>REORDER ESTIMATES (LOW STOCK)</div>
              <GenericTable rows={data.reorderEstimates}/>
            </div>
        )}
        {data.wastageAndDamage?.length > 0 && (
            <div>
              <div style={{ fontSize:10, color:R.muted, fontWeight:700, letterSpacing:0.6, marginBottom:8 }}>WASTAGE & DAMAGE</div>
              <GenericTable rows={data.wastageAndDamage}/>
            </div>
        )}
      </div>
  );
}

// ─── Geographic demand display ─────────────────────────────────────────────────
function GeoDemandDisplay({ data }) {
  if (!data) return <Skeleton h={200} r={8}/>;
  const CLUSTER_COLORS = [R.blue, R.green, R.orange, R.violet, R.teal];
  if (!data.clusters?.length) return (
      <div style={{ padding:'32px 0', textAlign:'center', color:R.muted, fontSize:13 }}>
        No cluster data available (AI module may be offline)
      </div>
  );
  return (
      <div>
        <div style={{ fontSize:11, color:R.muted, marginBottom:10 }}>
          {data.totalFaults} total faults · source: {data.dataSource}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
          {data.clusters.map((c,i)=>{
            const col = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
            return (
                <div key={i} style={{ padding:'12px 14px', borderRadius:10, background:R.bg, border:`1.5px solid ${col}44` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:7 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:col }}/>
                    <span style={{ fontSize:12, fontWeight:800, color:R.text }}>{c.regionName || `Cluster ${i+1}`}</span>
                  </div>
                  <div style={{ fontSize:18, fontWeight:800, color:col, fontFamily:'Epilogue,sans-serif' }}>{c.faultCount}</div>
                  <div style={{ fontSize:10, color:R.muted }}>faults · top: {c.topCategory || 'N/A'}</div>
                  {c.riskLevel && (
                      <div style={{
                        marginTop:6, padding:'2px 7px', borderRadius:4, display:'inline-block',
                        fontSize:9, fontWeight:800,
                        background: c.riskLevel==='HIGH' ? R.roseL : c.riskLevel==='MEDIUM' ? R.amberL : R.greenL,
                        color:      c.riskLevel==='HIGH' ? R.rose  : c.riskLevel==='MEDIUM' ? R.amber  : R.green,
                      }}>{c.riskLevel} RISK</div>
                  )}
                </div>
            );
          })}
        </div>
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT CARD — expandable with chart preview + export
// ═══════════════════════════════════════════════════════════════════════════════
function ReportCard({ template, period, startDate, endDate, onToast, idx }) {
  const [expanded, setExpanded]   = useState(false);
  const [data,     setData]       = useState(null);
  const [loading,  setLoading]    = useState(false);
  const [exporting,setExporting]  = useState(null); // 'pdf'|'excel'|null

  const buildParams = () => {
    const params = new URLSearchParams({ period });
    if (period === 'CUSTOM' && startDate) params.append('startDate', startDate);
    if (period === 'CUSTOM' && endDate)   params.append('endDate',   endDate);
    return params.toString();
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs   = buildParams();
      const path = `${template.apiPath}?${qs}`;
      const res  = await get(path);
      const raw  = res?.[template.dataKey] ?? res;
      setData(raw);
    } catch (e) {
      onToast(`Failed to load ${template.title}`, 'error');
    } finally { setLoading(false); }
  }, [period, startDate, endDate, template]);

  useEffect(() => { if (expanded) load(); }, [expanded, load]);

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const body = {
        reportType: template.id.toUpperCase(),
        format:     format.toUpperCase(),
        period,
        startDate: period==='CUSTOM' ? startDate : undefined,
        endDate:   period==='CUSTOM' ? endDate   : undefined,
      };
      const path = { pdf:'/api/reports/export/pdf', excel:'/api/reports/export/excel', csv:'/api/reports/export/csv' }[format];

      const res  = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tok()}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`${res.status}`);

      const blob = await res.blob();
      const ext  = { pdf:'pdf', excel:'xlsx', csv:'csv' }[format];
      const mime = {
        pdf:  'application/pdf',
        excel:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        csv:  'text/csv',
      }[format];
      downloadBlob(
          blob,
          `slt-${template.id.replace('_','-')}-${Date.now()}.${ext}`,
          mime
      );
      onToast(`${template.title} exported as ${format.toUpperCase()}`, 'success');
    } catch (e) {
      onToast(`Export failed: ${e.message}`, 'error');
    } finally { setExporting(null); }
  };

  const renderChart = () => {
    if (loading) return (
        <div style={{ padding:'12px 0', display:'flex', flexDirection:'column', gap:8 }}>
          <Skeleton h={200} r={8}/>
          <Skeleton h={12} w="60%" r={5}/>
        </div>
    );
    if (!data) return null;

    if (template.chartType === 'kv') return <FinancialDisplay data={data}/>;
    if (template.chartType === 'pie') return <SatisfactionDisplay data={data}/>;
    if (template.chartType === 'daily_summary') return <DailyFaultSummaryDisplay data={data}/>;
    if (template.chartType === 'material_cost') return <MaterialCostDisplay data={data}/>;
    if (template.chartType === 'geo_demand') return <GeoDemandDisplay data={data}/>;
    if (template.chartType === 'table') return <GenericTable rows={Array.isArray(data) ? data : []}/>;
    if (template.chartType === 'ai_forecast') {
      const historical = (data?.historical||[]).map(d=>({ date:d.date, actual:d.predictedFaults, isForecast:false }));
      const forecast    = (data?.forecast||[]).map(d=>({
        date:d.date, forecast:d.predictedFaults, upperBound:d.upperBound, lowerBound:d.lowerBound, isForecast:true,
      }));
      const combined = [...historical, ...forecast];
      return (
          <div>
            {data && (
                <div style={{ fontSize:11, color:R.muted, marginBottom:8 }}>
                  Accuracy: {data.accuracy ? `${data.accuracy.toFixed(1)}%` : '—'} · MAE: {data.mae?.toFixed(2) ?? '—'} · source: {data.dataSource}
                </div>
            )}
            <AIPredictionChart data={combined} loading={false}/>
          </div>
      );
    }

    const chartData = Array.isArray(data) ? data : [];
    if (!chartData.length) return (
        <div style={{ padding:'32px 0', textAlign:'center', color:R.muted, fontSize:13 }}>
          No data for selected period
        </div>
    );

    const trunc = (d) => ({
      ...d,
      [template.xKey]: String(d[template.xKey] || '').length > 14
          ? String(d[template.xKey]).slice(0,12)+'…'
          : d[template.xKey],
    });
    const cd = chartData.map(trunc);

    if (template.chartType === 'area') return (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={cd} margin={{ top:5, right:5, left:-20, bottom:0 }}>
            <defs>
              {template.series.map((s,i)=>(
                  <linearGradient key={i} id={`grad-${template.id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={s.color} stopOpacity={0}/>
                  </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={R.border2} vertical={false}/>
            <XAxis dataKey={template.xKey} tick={{ fontSize:9, fill:R.muted }} tickLine={false} axisLine={false}
                   tickFormatter={d=>d?.slice?.(5)||d} interval={Math.max(0,Math.floor(cd.length/6)-1)}
            />
            <YAxis tick={{ fontSize:9, fill:R.muted }} tickLine={false} axisLine={false}/>
            <Tooltip content={<ChartTooltip/>}/>
            <Legend iconType="circle" iconSize={7}
                    formatter={v=><span style={{ fontSize:11, color:R.muted }}>{v}</span>}
            />
            {template.series.map((s,i)=>(
                <Area key={i} type="monotone" dataKey={s.key} name={s.label}
                      stroke={s.color} strokeWidth={2}
                      fill={`url(#grad-${template.id}-${i})`} dot={false}
                      activeDot={{ r:4, fill:s.color, strokeWidth:0 }}
                />
            ))}
          </AreaChart>
        </ResponsiveContainer>
    );

    if (template.chartType === 'bar') return (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={cd.slice(0,12)} margin={{ top:5, right:5, left:-20, bottom:20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={R.border2} vertical={false}/>
            <XAxis dataKey={template.xKey} tick={{ fontSize:9, fill:R.muted, angle:-30, textAnchor:'end' }}
                   tickLine={false} axisLine={false} interval={0}
            />
            <YAxis tick={{ fontSize:9, fill:R.muted }} tickLine={false} axisLine={false}/>
            <Tooltip content={<ChartTooltip/>}/>
            <Legend iconType="circle" iconSize={7}
                    formatter={v=><span style={{ fontSize:11, color:R.muted }}>{v}</span>}
            />
            {template.series.map((s,i)=>(
                <Bar key={i} dataKey={s.key} name={s.label} fill={s.color}
                     radius={[4,4,0,0]} maxBarSize={28}
                />
            ))}
          </BarChart>
        </ResponsiveContainer>
    );

    return null;
  };

  // Summary stats from data
  const summaryStats = data?.summaryStats || [];

  return (
      <div style={{
        background:R.surface, borderRadius:14,
        border:`1.5px solid ${expanded ? template.color+'44' : R.border}`,
        overflow:'hidden', transition:'all 0.2s',
        boxShadow: expanded ? `0 4px 20px ${template.color}11` : '0 1px 4px rgba(0,0,0,0.05)',
        animation:`rpt-fadein 0.35s ease ${idx*0.07}s both`,
      }}>
        {/* Card header */}
        <div
            onClick={()=>setExpanded(e=>!e)}
            style={{
              padding:'18px 20px', cursor:'pointer',
              display:'flex', alignItems:'center', gap:14,
              transition:'background 0.13s',
            }}
            onMouseEnter={e=>e.currentTarget.style.background=R.bg}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}
        >
          {/* Icon */}
          <div style={{
            width:48, height:48, borderRadius:12, flexShrink:0,
            background:template.colorL,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:22,
          }}>
            {template.icon}
          </div>

          <div style={{ flex:1 }}>
            <div style={{
              fontSize:15, fontWeight:800, color:R.text,
              fontFamily:'Epilogue,sans-serif', marginBottom:2,
            }}>
              {template.title}
            </div>
            <div style={{ fontSize:12, color:R.muted }}>{template.desc}</div>
          </div>

          {/* Export buttons — always visible */}
          <div
              style={{ display:'flex', gap:6, flexShrink:0 }}
              onClick={e=>e.stopPropagation()}
          >
            <Btn variant="blue" onClick={()=>handleExport('pdf')} loading={exporting==='pdf'} sx={{ fontSize:11, padding:'6px 12px' }}>
              📄 PDF
            </Btn>
            <Btn variant="green" onClick={()=>handleExport('excel')} loading={exporting==='excel'} sx={{ fontSize:11, padding:'6px 12px' }}>
              📊 Excel
            </Btn>
            <Btn variant="teal" onClick={()=>handleExport('csv')} loading={exporting==='csv'} sx={{ fontSize:11, padding:'6px 12px' }}>
              📃 CSV
            </Btn>
          </div>

          {/* Expand chevron */}
          <div style={{
            color:R.dim, fontSize:16, transition:'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink:0,
          }}>▾</div>
        </div>

        {/* Expanded body */}
        {expanded && (
            <div style={{
              borderTop:`1px solid ${R.border}`,
              padding:'20px',
              animation:'rpt-fadein 0.22s ease',
            }}>
              {/* Summary stats row */}
              {summaryStats.length > 0 && (
                  <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                    {summaryStats.map((s,i)=>(
                        <div key={i} style={{
                          padding:'10px 16px', borderRadius:10,
                          background:R.bg, border:`1px solid ${R.border}`,
                          minWidth:100,
                        }}>
                          <div style={{
                            fontSize:18, fontWeight:800, color:
                                s.trend==='UP' ? R.green : s.trend==='DOWN' ? R.rose : R.text,
                            fontFamily:'Epilogue,sans-serif',
                          }}>
                            {s.value}
                            {s.trend && (
                                <span style={{ fontSize:13, marginLeft:3 }}>
                        {s.trend==='UP'?'↑':s.trend==='DOWN'?'↓':'→'}
                      </span>
                            )}
                          </div>
                          <div style={{ fontSize:10, color:R.muted }}>{s.label}</div>
                        </div>
                    ))}
                  </div>
              )}

              {/* Chart */}
              {renderChart()}

              {/* Table for bar chart data */}
              {!loading && template.chartType==='bar' && Array.isArray(data) && data.length>0 && (
                  <div style={{ marginTop:16 }}>
                    <div style={{ fontSize:10, color:R.muted, fontWeight:700, letterSpacing:0.6, marginBottom:8 }}>
                      TECHNICIAN BREAKDOWN
                    </div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                        <thead>
                        <tr style={{ borderBottom:`2px solid ${R.border}` }}>
                          {['Technician','Total Jobs','Completed','Comp %','Avg Duration','Satisfaction','On-Time %'].map((h,i)=>(
                              <th key={i} style={{
                                padding:'8px 12px', textAlign:'left', background:R.bg,
                                fontSize:10, fontWeight:800, color:R.muted, letterSpacing:0.5,
                              }}>{h}</th>
                          ))}
                        </tr>
                        </thead>
                        <tbody>
                        {data.map((row,i)=>(
                            <tr key={i} style={{
                              borderBottom:`1px solid ${R.border2}`,
                              transition:'background 0.1s',
                            }}
                                onMouseEnter={e=>[...e.currentTarget.querySelectorAll('td')].forEach(td=>td.style.background=R.bg)}
                                onMouseLeave={e=>[...e.currentTarget.querySelectorAll('td')].forEach(td=>td.style.background='')}
                            >
                              <td style={{ padding:'9px 12px', fontWeight:700, color:R.text }}>
                                {row.technicianName||'—'}
                              </td>
                              <td style={{ padding:'9px 12px', color:R.muted }}>{row.totalJobsAssigned??'—'}</td>
                              <td style={{ padding:'9px 12px', color:R.green, fontWeight:700 }}>{row.jobsCompleted??'—'}</td>
                              <td style={{ padding:'9px 12px' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                  <div style={{
                                    height:4, width:50, background:R.bg2, borderRadius:2, overflow:'hidden',
                                  }}>
                                    <div style={{
                                      height:'100%', width:`${Math.min(row.completionRate||0,100)}%`,
                                      background: row.completionRate>=80?R.green:row.completionRate>=60?R.amber:R.rose,
                                      borderRadius:2,
                                    }}/>
                                  </div>
                                  <span style={{ fontSize:11, fontWeight:700, color:R.text }}>
                              {row.completionRate?.toFixed(0)??'—'}%
                            </span>
                                </div>
                              </td>
                              <td style={{ padding:'9px 12px', color:R.muted }}>{row.avgJobDurationHours?.toFixed(1)??'—'}h</td>
                              <td style={{ padding:'9px 12px', color:R.amber, fontWeight:700 }}>
                                ★ {row.customerSatisfactionScore?.toFixed(1)??'—'}
                              </td>
                              <td style={{ padding:'9px 12px', color:R.muted }}>{row.onTimeCompletionRate?.toFixed(0)??'—'}%</td>
                            </tr>
                        ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
              )}

              {/* Reload */}
              <div style={{ marginTop:14, display:'flex', justifyContent:'flex-end' }}>
                <Btn variant="outline" onClick={load}>🔄 Reload Data</Btn>
              </div>
            </div>
        )}
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI PREDICTIONS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function AIPredictionsPanel({ period }) {
  const [forecasts,  setForecasts]  = useState(null);
  const [clusters,   setClusters]   = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [horizon,    setHorizon]    = useState(30);
  const [aiOnline,   setAiOnline]   = useState(null); // null=checking, true, false

  // Check AI service
  useEffect(()=>{
    aiGet('/api/ai/health')
        .then(()=>setAiOnline(true))
        .catch(()=>setAiOnline(false));
  },[]);

  const loadAI = useCallback(async()=>{
    if (!aiOnline) return;
    setLoading(true);
    try {
      const [fc, cl] = await Promise.all([
        aiGet(`/api/ai/predictions?horizon=${horizon}`).catch(()=>null),
        aiGet('/api/ai/clusters').catch(()=>null),
      ]);
      // Build chart data: historical + forecast stitched
      if (fc) {
        const historical = (fc.historical||[]).map(d=>({
          date:d.ds||d.date, actual:d.y||d.value, isForecast:false,
        }));
        const forecast = (fc.forecast||[]).map(d=>({
          date:d.ds||d.date, forecast:d.yhat||d.value,
          upperBound:d.yhat_upper||d.upper,
          lowerBound:d.yhat_lower||d.lower,
          isForecast:true,
        }));
        setForecasts([...historical, ...forecast]);
      }
      if (cl) setClusters(cl.clusters||cl||[]);
    } catch(e){console.error(e);}
    finally { setLoading(false); }
  },[aiOnline, horizon]);

  useEffect(()=>{ if (aiOnline) loadAI(); },[aiOnline, loadAI]);

  const CLUSTER_COLORS = [R.blue, R.green, R.orange, R.violet, R.teal];

  return (
      <div style={{
        background:R.surface, borderRadius:14, overflow:'hidden',
        border:`1.5px solid ${R.violet}44`,
        boxShadow:`0 4px 24px ${R.violet}11`,
      }}>
        {/* Header */}
        <div style={{
          padding:'18px 20px', borderBottom:`1px solid ${R.border}`,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          background:`linear-gradient(135deg, ${R.violetL}, ${R.surface})`,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{
              width:42, height:42, borderRadius:10,
              background:R.violetL, display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:20,
            }}>🤖</div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:R.text, fontFamily:'Epilogue,sans-serif' }}>
                AI Predictions
              </div>
              <div style={{ fontSize:11, color:R.muted }}>
                Prophet time-series · K-Means geographic clustering
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {/* AI service status */}
            <div style={{
              display:'flex', alignItems:'center', gap:5,
              padding:'4px 10px', borderRadius:20,
              background: aiOnline===null ? R.bg2 : aiOnline ? R.greenL : R.roseL,
              border:`1px solid ${aiOnline===null ? R.border : aiOnline ? R.green : R.rose}44`,
              fontSize:10, fontWeight:700,
              color: aiOnline===null ? R.muted : aiOnline ? R.green : R.rose,
            }}>
            <span style={{
              width:6, height:6, borderRadius:'50%',
              background: aiOnline===null ? R.dim : aiOnline ? R.green : R.rose,
              display:'inline-block',
              boxShadow: aiOnline ? `0 0 5px ${R.green}` : 'none',
            }}/>
              {aiOnline===null ? 'Checking…' : aiOnline ? 'AI Online' : 'AI Offline'}
            </div>
            {aiOnline && (
                <>
                  <div style={{ display:'flex', border:`1px solid ${R.border}`, borderRadius:8, overflow:'hidden' }}>
                    {[7,14,30].map(h=>(
                        <button key={h} onClick={()=>setHorizon(h)} style={{
                          padding:'6px 12px', border:'none', fontSize:11, fontWeight:700,
                          cursor:'pointer',
                          background: horizon===h ? R.violet : 'transparent',
                          color: horizon===h ? R.white : R.muted,
                          transition:'all 0.12s', fontFamily:'Epilogue,sans-serif',
                        }}>{h}d</button>
                    ))}
                  </div>
                  <Btn variant="outline" onClick={loadAI} sx={{ fontSize:11, padding:'6px 12px' }}>🔄</Btn>
                </>
            )}
          </div>
        </div>

        <div style={{ padding:'20px' }}>
          {!aiOnline && aiOnline !== null ? (
              <div style={{
                padding:'32px', textAlign:'center', color:R.muted,
              }}>
                <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
                <div style={{ fontSize:14, fontWeight:700, color:R.text, marginBottom:6, fontFamily:'Epilogue,sans-serif' }}>
                  AI Service Offline
                </div>
                <div style={{ fontSize:12 }}>
                  Start the Flask AI service: <code style={{
                  background:R.bg2, padding:'2px 6px', borderRadius:4,
                  color:R.navy,
                }}>cd slt-ai-module && python app.py</code>
                </div>
              </div>
          ) : (
              <>
                {/* Fault volume forecast */}
                <div style={{ marginBottom:24 }}>
                  <div style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    marginBottom:12,
                  }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:800, color:R.text, fontFamily:'Epilogue,sans-serif' }}>
                        Fault Volume Forecast
                      </div>
                      <div style={{ fontSize:11, color:R.muted }}>
                        {horizon}-day prediction with confidence bounds
                      </div>
                    </div>
                    {forecasts && !loading && (
                        <div style={{
                          padding:'5px 12px', borderRadius:8,
                          background:R.violetL, border:`1px solid ${R.violet}44`,
                          fontSize:11, color:R.violet, fontWeight:700,
                        }}>
                          85%+ accuracy target
                        </div>
                    )}
                  </div>
                  <AIPredictionChart data={forecasts} loading={loading}/>
                </div>

                {/* K-Means clusters */}
                {clusters && clusters.length > 0 && (
                    <div>
                      <div style={{
                        fontSize:13, fontWeight:800, color:R.text,
                        fontFamily:'Epilogue,sans-serif', marginBottom:12,
                      }}>
                        Geographic Demand Clusters
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
                        {clusters.map((c,i)=>{
                          const col = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
                          return (
                              <div key={i} style={{
                                padding:'12px 14px', borderRadius:10,
                                background:R.bg, border:`1.5px solid ${col}44`,
                                animation:`rpt-fadein 0.3s ease ${i*0.07}s both`,
                              }}>
                                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:7 }}>
                                  <div style={{
                                    width:10, height:10, borderRadius:'50%',
                                    background:col, boxShadow:`0 0 6px ${col}88`,
                                  }}/>
                                  <span style={{ fontSize:12, fontWeight:800, color:R.text }}>
                            {c.regionName || `Cluster ${i+1}`}
                          </span>
                                </div>
                                <div style={{ fontSize:18, fontWeight:800, color:col, fontFamily:'Epilogue,sans-serif' }}>
                                  {c.faultCount ?? c.count ?? '—'}
                                </div>
                                <div style={{ fontSize:10, color:R.muted }}>faults</div>
                                {c.riskLevel && (
                                    <div style={{
                                      marginTop:6, padding:'2px 7px', borderRadius:4, display:'inline-block',
                                      fontSize:9, fontWeight:800,
                                      background: c.riskLevel==='HIGH' ? R.roseL : c.riskLevel==='MEDIUM' ? R.amberL : R.greenL,
                                      color:      c.riskLevel==='HIGH' ? R.rose  : c.riskLevel==='MEDIUM' ? R.amber  : R.green,
                                    }}>
                                      {c.riskLevel} RISK
                                    </div>
                                )}
                              </div>
                          );
                        })}
                      </div>
                    </div>
                )}
              </>
          )}
        </div>
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function ReportsPage() {
  const [period,     setPeriod]     = useState('THIS_MONTH');
  const [startDate,  setStartDate]  = useState(nDaysAgo(30));
  const [endDate,    setEndDate]    = useState(today());
  const [toast,      setToast]      = useState(null);
  const [exAll,      setExAll]      = useState(null);

  const showToast = useCallback((msg, type='success') => setToast({msg,type}), []);

  // Export ALL reports at once
  const exportAll = async (format) => {
    setExAll(format);
    let success = 0, fail = 0;
    for (const t of TEMPLATES) {
      try {
        const body = {
          reportType:t.id.toUpperCase(),
          format:format.toUpperCase(),
          period,
          startDate: period==='CUSTOM'?startDate:undefined,
          endDate:   period==='CUSTOM'?endDate:undefined,
        };
        const res = await fetch(`${API}/api/reports/export/${format}`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${tok()}` },
          body:JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const blob = await res.blob();
        const ext  = { pdf:'pdf', excel:'xlsx', csv:'csv' }[format];
        const mime = {
          pdf:  'application/pdf',
          excel:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          csv:  'text/csv',
        }[format];
        downloadBlob(blob, `slt-${t.id}-${Date.now()}.${ext}`, mime);
        success++;
      } catch { fail++; }
    }
    showToast(
        fail===0
            ? `${success} reports exported as ${format.toUpperCase()}`
            : `${success} succeeded, ${fail} failed`,
        fail===0?'success':'warning'
    );
    setExAll(null);
  };

  // Inject CSS
  useEffect(()=>{
    const id='rpt-page-css';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.innerHTML=`
      @import url('https://fonts.googleapis.com/css2?family=Epilogue:wght@400;500;600;700;800;900&display=swap');
      @keyframes rpt-shimmer  {0%{background-position:200% 0}100%{background-position:-200% 0}}
      @keyframes rpt-fadein   {from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      @keyframes rpt-toastin  {from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
      @keyframes rpt-spin     {to{transform:rotate(360deg)}}
      .rpt-page *{box-sizing:border-box;}
      ::-webkit-scrollbar{width:5px;height:5px}
      ::-webkit-scrollbar-track{background:${R.bg}}
      ::-webkit-scrollbar-thumb{background:${R.border};border-radius:4px}
    `;
    document.head.appendChild(s);
  },[]);

  return (
      <div className="rpt-page" style={{
        background:R.bg, minHeight:'100vh',
        padding:'28px 32px', fontFamily:'Epilogue,sans-serif',
      }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
          <div>
            <h1 style={{
              margin:0, fontSize:26, fontWeight:900, color:R.text,
              letterSpacing:-0.5,
            }}>
              Reports & Analytics
            </h1>
            <div style={{ fontSize:12, color:R.muted, marginTop:4 }}>
              Generate, preview and export operational reports · AI-powered fault predictions
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <Btn variant="blue" onClick={()=>exportAll('pdf')} loading={exAll==='pdf'}>
              📄 Export All PDF
            </Btn>
            <Btn variant="green" onClick={()=>exportAll('excel')} loading={exAll==='excel'}>
              📊 Export All Excel
            </Btn>
            <Btn variant="teal" onClick={()=>exportAll('csv')} loading={exAll==='csv'}>
              📃 Export All CSV
            </Btn>
          </div>
        </div>

        {/* Date controls */}
        <div style={{
          background:R.surface, borderRadius:12,
          border:`1px solid ${R.border}`, padding:'16px 20px',
          marginBottom:24, display:'flex', gap:10,
          alignItems:'center', flexWrap:'wrap',
          boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
        }}>
        <span style={{ fontSize:11, fontWeight:700, color:R.muted, letterSpacing:0.5 }}>
          DATE RANGE
        </span>
          {/* Preset chips */}
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {PRESETS.map(p=>(
                <button key={p.value}
                        onClick={()=>setPeriod(p.value)}
                        style={{
                          padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer',
                          fontSize:11, fontWeight:700, transition:'all 0.12s',
                          background: period===p.value ? R.navy : R.bg2,
                          color:      period===p.value ? R.white : R.muted,
                          boxShadow:  period===p.value ? `0 2px 8px ${R.navy}33` : 'none',
                        }}
                >{p.label}</button>
            ))}
          </div>

          {/* Custom date pickers */}
          {period==='CUSTOM' && (
              <div style={{ display:'flex', gap:8, alignItems:'center', marginLeft:8 }}>
                <span style={{ fontSize:11, color:R.muted }}>From</span>
                <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
                       style={{
                         background:R.bg, border:`1.5px solid ${R.border}`, borderRadius:8,
                         padding:'6px 10px', fontSize:12, color:R.text, outline:'none',
                         fontFamily:'Epilogue,sans-serif',
                       }}
                       onFocus={e=>e.target.style.borderColor=R.blue}
                       onBlur={e=>e.target.style.borderColor=R.border}
                />
                <span style={{ fontSize:11, color:R.muted }}>To</span>
                <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
                       style={{
                         background:R.bg, border:`1.5px solid ${R.border}`, borderRadius:8,
                         padding:'6px 10px', fontSize:12, color:R.text, outline:'none',
                         fontFamily:'Epilogue,sans-serif',
                       }}
                       onFocus={e=>e.target.style.borderColor=R.blue}
                       onBlur={e=>e.target.style.borderColor=R.border}
                />
              </div>
          )}

          <div style={{ marginLeft:'auto', fontSize:11, color:R.dim }}>
            Click a report card to preview its chart
          </div>
        </div>

        {/* Report template cards */}
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fill,minmax(min(100%,480px),1fr))',
          gap:14, marginBottom:28,
        }}>
          {TEMPLATES.map((t,i)=>(
              <ReportCard
                  key={t.id}
                  template={t}
                  period={period}
                  startDate={startDate}
                  endDate={endDate}
                  onToast={showToast}
                  idx={i}
              />
          ))}
        </div>

        {/* AI Predictions panel */}
        <AIPredictionsPanel period={period}/>

        {/* Toast */}
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      </div>
  );
}