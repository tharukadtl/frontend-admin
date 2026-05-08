import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LineChart, Line, PieChart, Pie, Cell, Tooltip,
    ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import {
    MapContainer, TileLayer, CircleMarker, Popup, Marker
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// ─── API base (adjust to your env) ─────────────────────────────────────────
const API = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const token = () => localStorage.getItem('accessToken');
const get = (path) =>
    fetch(`${API}${path}`, {
        headers: { Authorization: `Bearer ${token()}` },
    }).then((r) => r.json());

// ─── SLT brand palette ───────────────────────────────────────────────────────
const C = {
    navy:    '#003087',
    blue:    '#0057B8',
    sky:     '#0099CC',
    accent:  '#00C8FF',
    white:   '#FFFFFF',
    offwhite:'#F4F7FC',
    border:  '#DCE6F4',
    text:    '#1A2340',
    muted:   '#6B7FA3',
    green:   '#12B76A',
    orange:  '#F59E0B',
    red:     '#EF4444',
    purple:  '#8B5CF6',
};

const PIE_COLORS = [C.sky, C.orange, C.green, C.red, C.purple];

// ─── Status badge colours ────────────────────────────────────────────────────
const STATUS_COLOR = {
    OPEN:        { bg: '#FEF3C7', text: '#D97706', dot: C.orange },
    IN_PROGRESS: { bg: '#DBEAFE', text: '#1D4ED8', dot: C.blue   },
    COMPLETED:   { bg: '#D1FAE5', text: '#065F46', dot: C.green  },
    CANCELLED:   { bg: '#FEE2E2', text: '#991B1B', dot: C.red    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Spinner ─────────────────────────────────────────────────────────────────
const Spinner = () => (
    <div style={{ display:'flex', justifyContent:'center', padding:'40px' }}>
        <div style={{
            width:36, height:36, borderRadius:'50%',
            border:`3px solid ${C.border}`,
            borderTopColor: C.sky,
            animation:'slt-spin 0.8s linear infinite',
        }} />
    </div>
);

// ─── Section card wrapper ────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
    <div style={{
        background: C.white,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        boxShadow: '0 2px 16px rgba(0,48,135,0.07)',
        overflow: 'hidden',
        ...style,
    }}>
        {children}
    </div>
);

const CardHeader = ({ title, subtitle, action }) => (
    <div style={{
        padding: '20px 24px 16px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
        <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.text, fontFamily:'Sora,sans-serif' }}>
                {title}
            </div>
            {subtitle && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{subtitle}</div>
            )}
        </div>
        {action}
    </div>
);

// ─── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard = ({ icon, label, value, sub, color, trend, loading }) => {
    const trendUp = trend && trend.startsWith('UP');
    const trendDown = trend && trend.startsWith('DOWN');

    return (
        <div style={{
            background: C.white,
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            boxShadow: '0 2px 16px rgba(0,48,135,0.07)',
            padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 12,
            position: 'relative', overflow: 'hidden',
            transition: 'transform 0.18s, box-shadow 0.18s',
            cursor: 'default',
        }}
             onMouseEnter={e => {
                 e.currentTarget.style.transform = 'translateY(-3px)';
                 e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,48,135,0.13)';
             }}
             onMouseLeave={e => {
                 e.currentTarget.style.transform = 'translateY(0)';
                 e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,48,135,0.07)';
             }}
        >
            {/* colour strip top */}
            <div style={{
                position:'absolute', top:0, left:0, right:0, height:3,
                background: `linear-gradient(90deg, ${color}, ${color}88)`,
                borderRadius:'16px 16px 0 0',
            }} />

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `${color}18`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize: 22,
                }}>
                    {icon}
                </div>
                {trend && (
                    <div style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                        background: trendUp ? '#D1FAE5' : trendDown ? '#FEE2E2' : '#F3F4F6',
                        color: trendUp ? C.green : trendDown ? C.red : C.muted,
                    }}>
                        {trendUp ? '↑' : trendDown ? '↓' : '→'} {trend}
                    </div>
                )}
            </div>

            {loading ? (
                <div style={{ height: 40, background: C.offwhite, borderRadius: 8, animation:'slt-pulse 1.4s ease-in-out infinite' }} />
            ) : (
                <>
                    <div style={{ fontSize: 32, fontWeight: 800, color: C.text, fontFamily:'Sora,sans-serif', lineHeight:1 }}>
                        {value ?? '—'}
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>{label}</div>
                        {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
                    </div>
                </>
            )}
        </div>
    );
};

// ─── Custom pie tooltip ───────────────────────────────────────────────────────
const PieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { name, value, payload: pl } = payload[0];
    return (
        <div style={{
            background: C.white, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '10px 14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            fontSize: 13,
        }}>
            <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>{name}</div>
            <div style={{ color: C.muted }}>Count: <b style={{ color: C.text }}>{value}</b></div>
            <div style={{ color: C.muted }}>Share: <b style={{ color: C.text }}>{pl?.percentage ?? '—'}%</b></div>
        </div>
    );
};

// ─── Custom line tooltip ──────────────────────────────────────────────────────
const LineTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: C.navy, borderRadius: 10, padding: '10px 14px',
            boxShadow: '0 4px 16px rgba(0,48,135,0.25)',
        }}>
            <div style={{ color: C.accent, fontWeight: 700, marginBottom: 6, fontSize: 12 }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ color: C.white, fontSize: 12, marginBottom: 2 }}>
                    <span style={{ color: p.color }}>● </span>
                    {p.name}: <b>{p.value}</b>
                </div>
            ))}
        </div>
    );
};

// ─── Performance badge ────────────────────────────────────────────────────────
const PerfBadge = ({ level }) => {
    const map = {
        EXCELLENT:        { bg:'#D1FAE5', color:'#065F46', label:'Excellent' },
        GOOD:             { bg:'#DBEAFE', color:'#1D4ED8', label:'Good' },
        AVERAGE:          { bg:'#FEF3C7', color:'#D97706', label:'Average' },
        BELOW_AVERAGE:    { bg:'#FEE2E2', color:'#991B1B', label:'Below Avg' },
        NEEDS_IMPROVEMENT:{ bg:'#FEE2E2', color:'#991B1B', label:'Needs Work' },
    };
    const s = map[level] || { bg:'#F3F4F6', color:C.muted, label: level || '—' };
    return (
        <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
            background: s.bg, color: s.color,
        }}>
      {s.label}
    </span>
    );
};

// ─── Star rating ──────────────────────────────────────────────────────────────
const Stars = ({ rating = 0 }) => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    return (
        <span style={{ fontSize: 13, color: C.orange, letterSpacing: -1 }}>
      {'★'.repeat(full)}{'½'.repeat(half ? 1 : 0)}{'☆'.repeat(5 - full - (half ? 1 : 0))}
            <span style={{ color: C.muted, fontSize: 11, marginLeft: 4 }}>{rating.toFixed(1)}</span>
    </span>
    );
};

// ─── Activity icon map ────────────────────────────────────────────────────────
const activityStyle = (type) => {
    const map = {
        FAULT_CREATED:   { bg:'#DBEAFE', color:'#1D4ED8', emoji:'📋' },
        FAULT_ASSIGNED:  { bg:'#EDE9FE', color:'#6D28D9', emoji:'🔧' },
        FAULT_ESCALATED: { bg:'#FEE2E2', color:'#991B1B', emoji:'⚠️' },
        FAULT_COMPLETED: { bg:'#D1FAE5', color:'#065F46', emoji:'✅' },
        PAYMENT_APPROVED:{ bg:'#D1FAE5', color:'#065F46', emoji:'💰' },
        PAYMENT_PENDING: { bg:'#FEF3C7', color:'#D97706', emoji:'⏳' },
        PAYMENT_REJECTED:{ bg:'#FEE2E2', color:'#991B1B', emoji:'❌' },
    };
    return map[type] || { bg:'#F3F4F6', color:C.muted, emoji:'📌' };
};

// ─── Quick Action Button ──────────────────────────────────────────────────────
const QuickAction = ({ icon, label, color, onClick }) => (
    <button
        onClick={onClick}
        style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:6,
            padding:'14px 18px', borderRadius:12, border:`1.5px solid ${color}22`,
            background:`${color}0D`, cursor:'pointer', transition:'all 0.15s',
            minWidth: 90,
        }}
        onMouseEnter={e=>{
            e.currentTarget.style.background=`${color}22`;
            e.currentTarget.style.borderColor=`${color}66`;
            e.currentTarget.style.transform='translateY(-2px)';
        }}
        onMouseLeave={e=>{
            e.currentTarget.style.background=`${color}0D`;
            e.currentTarget.style.borderColor=`${color}22`;
            e.currentTarget.style.transform='translateY(0)';
        }}
    >
        <span style={{ fontSize:22 }}>{icon}</span>
        <span style={{ fontSize:11, fontWeight:600, color, whiteSpace:'nowrap' }}>{label}</span>
    </button>
);

// ─── Skeleton loader ──────────────────────────────────────────────────────────
const Skeleton = ({ h=16, w='100%', r=8, mb=0 }) => (
    <div style={{
        height:h, width:w, borderRadius:r, marginBottom:mb,
        background:'linear-gradient(90deg,#EEF2F9 25%,#DDE5F4 50%,#EEF2F9 75%)',
        backgroundSize:'200% 100%',
        animation:'slt-shimmer 1.5s infinite',
    }} />
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
    const navigate = useNavigate();

    const [kpi,        setKpi]        = useState(null);
    const [dist,       setDist]       = useState(null);
    const [trends,     setTrends]     = useState([]);
    const [techPerf,   setTechPerf]   = useState([]);
    const [activity,   setActivity]   = useState([]);
    const [geoData,    setGeoData]    = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [trendDays,  setTrendDays]  = useState(30);
    const [sortField,  setSortField]  = useState('completionRate');
    const [sortDir,    setSortDir]    = useState('desc');
    const [mapTab,     setMapTab]     = useState('faults');
    const [lastRefresh,setLastRefresh]= useState(new Date());

    // ─── Fetch all dashboard data ──────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [k, d, t, tp, a, g] = await Promise.all([
                get('/api/dashboard/kpi-summary'),
                get('/api/dashboard/fault-distribution'),
                get(`/api/dashboard/fault-trends?days=${trendDays}`),
                get('/api/dashboard/technician-performance'),
                get('/api/dashboard/recent-activity?limit=20'),
                get('/api/dashboard/geographic-data'),
            ]);
            setKpi(k);
            setDist(d);
            setTrends(Array.isArray(t) ? t : []);
            setTechPerf(Array.isArray(tp) ? tp : []);
            setActivity(Array.isArray(a) ? a : []);
            setGeoData(g);
            setLastRefresh(new Date());
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [trendDays]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Auto-refresh every 60 seconds
    useEffect(() => {
        const id = setInterval(fetchAll, 60000);
        return () => clearInterval(id);
    }, [fetchAll]);

    // ─── Fetch trends when days changes ───────────────────────────────────────
    const fetchTrends = async (days) => {
        setTrendDays(days);
        try {
            const t = await get(`/api/dashboard/fault-trends?days=${days}`);
            setTrends(Array.isArray(t) ? t : []);
        } catch (e) { console.error(e); }
    };

    // ─── Sort technician table ─────────────────────────────────────────────────
    const sortedTech = [...techPerf].sort((a, b) => {
        const av = a[sortField] ?? 0;
        const bv = b[sortField] ?? 0;
        return sortDir === 'asc' ? av - bv : bv - av;
    });
    const handleSort = (field) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
    };

    // ─── Pie chart data ────────────────────────────────────────────────────────
    const pieData = dist ? [
        { name: 'Open',        value: dist.open,        percentage: dist.openPercent },
        { name: 'In Progress', value: dist.inProgress,   percentage: dist.inProgressPercent },
        { name: 'Completed',   value: dist.completed,    percentage: dist.completedPercent },
        { name: 'Cancelled',   value: dist.cancelled,    percentage: dist.cancelledPercent },
    ] : [];

    // ─── Map markers ──────────────────────────────────────────────────────────
    const faultMarkers    = geoData?.faultHeatMap         ?? [];
    const techMarkers     = geoData?.technicianLocations   ?? [];
    const activeMarkers   = mapTab === 'faults' ? faultMarkers : techMarkers;
    const mapCenter       = [7.8731, 80.7718]; // Sri Lanka centre

    // ─── Inject CSS once ──────────────────────────────────────────────────────
    useEffect(() => {
        const id = 'slt-dash-styles';
        if (document.getElementById(id)) return;
        const style = document.createElement('style');
        style.id = id;
        style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
      @keyframes slt-spin    { to { transform:rotate(360deg); } }
      @keyframes slt-pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
      @keyframes slt-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      @keyframes slt-fadein  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      .slt-dash * { box-sizing:border-box; font-family:'DM Sans',sans-serif; }
      .slt-dash { animation: slt-fadein 0.4s ease; }
      .slt-th-btn { background:none; border:none; cursor:pointer; font-weight:700;
        font-size:12px; color:#6B7FA3; padding:0; display:flex; align-items:center; gap:4px; }
      .slt-th-btn:hover { color:#003087; }
      .slt-row:hover td { background:#F4F7FC !important; }
      .slt-trend-btn { border:1.5px solid #DCE6F4; background:#fff; border-radius:8px;
        padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer;
        color:#6B7FA3; transition:all 0.15s; }
      .slt-trend-btn.active { background:#003087; color:#fff; border-color:#003087; }
      .slt-tab { border:none; background:none; padding:8px 16px; font-size:12px;
        font-weight:600; border-radius:8px; cursor:pointer; color:#6B7FA3;
        transition:all 0.15s; }
      .slt-tab.active { background:#003087; color:#fff; }
    `;
        document.head.appendChild(style);
    }, []);

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <div className="slt-dash" style={{
            background: C.offwhite,
            minHeight: '100vh',
            padding: '28px 32px',
        }}>

            {/* ── Page header ──────────────────────────────────────────────────── */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
                <div>
                    <h1 style={{
                        margin:0, fontSize:24, fontWeight:800, color:C.navy,
                        fontFamily:'Sora,sans-serif', letterSpacing:-0.5,
                    }}>
                        Operations Dashboard
                    </h1>
                    <div style={{ fontSize:13, color:C.muted, marginTop:4 }}>
                        Last updated: {lastRefresh.toLocaleTimeString()} &nbsp;·&nbsp; Auto-refreshes every 60s
                    </div>
                </div>

                <div style={{ display:'flex', gap:10 }}>
                    <button
                        onClick={fetchAll}
                        style={{
                            display:'flex', alignItems:'center', gap:6,
                            padding:'9px 18px', borderRadius:10,
                            border:`1.5px solid ${C.border}`, background:C.white,
                            cursor:'pointer', fontSize:13, fontWeight:600, color:C.navy,
                            transition:'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.sky; e.currentTarget.style.color = C.sky; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.navy; }}
                    >
                        🔄 Refresh
                    </button>

                    <div style={{
                        display:'flex', alignItems:'center', gap:8,
                        padding:'9px 16px', borderRadius:10,
                        background: kpi?.activeTechnicians > 0 ? '#D1FAE5' : '#FEE2E2',
                        border:`1.5px solid ${kpi?.activeTechnicians > 0 ? '#86EFAC' : '#FECACA'}`,
                        fontSize:13, fontWeight:700,
                        color: kpi?.activeTechnicians > 0 ? '#065F46' : '#991B1B',
                    }}>
            <span style={{
                width:8, height:8, borderRadius:'50%',
                background: kpi?.activeTechnicians > 0 ? C.green : C.red,
                display:'inline-block',
                boxShadow: kpi?.activeTechnicians > 0 ? `0 0 0 3px #86EFAC` : `0 0 0 3px #FECACA`,
            }} />
                        {kpi?.activeTechnicians ?? '—'} Active Technicians
                    </div>
                </div>
            </div>

            {/* ── Quick Actions ────────────────────────────────────────────────── */}
            <div style={{
                display:'flex', gap:10, marginBottom:28, flexWrap:'wrap',
            }}>
                <QuickAction icon="➕" label="New Fault"       color={C.blue}   onClick={() => navigate('/faults')} />
                <QuickAction icon="👤" label="Add User"        color={C.sky}    onClick={() => navigate('/users')} />
                <QuickAction icon="🔧" label="Assign Jobs"     color={C.orange} onClick={() => navigate('/faults')} />
                <QuickAction icon="💰" label="Approvals"       color={C.green}  onClick={() => navigate('/payments')} />
                <QuickAction icon="📊" label="Reports"         color={C.purple} onClick={() => navigate('/reports')} />
                <QuickAction icon="📦" label="Low Stock"       color={C.red}    onClick={() => navigate('/inventory')} />
            </div>

            {/* ── KPI Cards ────────────────────────────────────────────────────── */}
            <div style={{
                display:'grid',
                gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',
                gap:16, marginBottom:28,
            }}>
                <KpiCard icon="📋" label="Total Faults"      color={C.blue}
                         value={kpi?.totalFaults}
                         sub={`${kpi?.inProgressFaults ?? 0} in progress`}
                         trend={kpi?.faultsTrend}
                         loading={loading && !kpi} />
                <KpiCard icon="🔴" label="Open Faults"       color={C.red}
                         value={kpi?.openFaults}
                         sub="Awaiting assignment"
                         loading={loading && !kpi} />
                <KpiCard icon="✅" label="Completed Today"   color={C.green}
                         value={kpi?.completedToday}
                         sub={`${kpi?.completedThisMonth ?? 0} this month`}
                         trend={kpi?.completionTrend}
                         loading={loading && !kpi} />
                <KpiCard icon="⏳" label="Pending Payments"  color={C.orange}
                         value={kpi?.pendingPayments}
                         sub="Awaiting admin review"
                         loading={loading && !kpi} />
                <KpiCard icon="👷" label="Active Today"      color={C.sky}
                         value={kpi?.activeTechnicians}
                         sub={`of ${kpi?.totalTechnicians ?? 0} total`}
                         loading={loading && !kpi} />
                <KpiCard icon="⭐" label="Satisfaction"      color={C.purple}
                         value={kpi?.customerSatisfactionScore ? `${kpi.customerSatisfactionScore}/5` : '—'}
                         sub={`On-time: ${kpi?.onTimeCompletionRate ?? 0}%`}
                         trend={kpi?.satisfactionTrend}
                         loading={loading && !kpi} />
                <KpiCard icon="💰" label="Revenue (Month)"   color={C.green}
                         value={kpi?.totalRevenueThisMonth
                             ? `LKR ${(kpi.totalRevenueThisMonth/1000).toFixed(0)}K`
                             : '—'}
                         sub="Approved payments"
                         trend={kpi?.revenueTrend}
                         loading={loading && !kpi} />
                <KpiCard icon="📈" label="Completion Rate"   color={C.blue}
                         value={kpi?.completionRate ? `${kpi.completionRate}%` : '—'}
                         sub="This month"
                         loading={loading && !kpi} />
            </div>

            {/* ── Row 2: Pie + Trends ───────────────────────────────────────────── */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:20, marginBottom:20 }}>

                {/* Pie Chart */}
                <Card>
                    <CardHeader title="Fault Distribution" subtitle="By current status" />
                    <div style={{ padding:'20px 24px' }}>
                        {loading && !dist ? (
                            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                                <Skeleton h={200} r={12} />
                            </div>
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie
                                            data={pieData} cx="50%" cy="50%"
                                            innerRadius={55} outerRadius={85}
                                            paddingAngle={3} dataKey="value"
                                            stroke="none"
                                        >
                                            {pieData.map((_, i) => (
                                                <Cell key={i} fill={PIE_COLORS[i]} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<PieTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>

                                {/* Legend rows */}
                                <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
                                    {pieData.map((d, i) => (
                                        <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                                <div style={{ width:10, height:10, borderRadius:3, background:PIE_COLORS[i] }} />
                                                <span style={{ fontSize:12, color:C.muted }}>{d.name}</span>
                                            </div>
                                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                                <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{d.value}</span>
                                                <span style={{ fontSize:11, color:C.muted }}>({d.percentage ?? 0}%)</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Category breakdown if available */}
                                {dist?.byCategory?.length > 0 && (
                                    <>
                                        <div style={{ fontSize:12, fontWeight:700, color:C.muted, margin:'16px 0 8px', textTransform:'uppercase', letterSpacing:0.5 }}>
                                            By Category
                                        </div>
                                        {dist.byCategory.slice(0, 5).map((cat, i) => (
                                            <div key={i} style={{ marginBottom:6 }}>
                                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                                                    <span style={{ fontSize:11, color:C.muted }}>{cat.category}</span>
                                                    <span style={{ fontSize:11, fontWeight:700, color:C.text }}>{cat.count}</span>
                                                </div>
                                                <div style={{ height:4, background:C.border, borderRadius:4, overflow:'hidden' }}>
                                                    <div style={{
                                                        height:'100%', borderRadius:4,
                                                        width:`${cat.percentage}%`,
                                                        background:`linear-gradient(90deg, ${C.sky}, ${C.navy})`,
                                                        transition:'width 0.6s ease',
                                                    }} />
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </Card>

                {/* Line Chart */}
                <Card>
                    <CardHeader
                        title="Fault Trends"
                        subtitle={`Last ${trendDays} days — opened vs completed`}
                        action={
                            <div style={{ display:'flex', gap:6 }}>
                                {[7,14,30,90].map(d => (
                                    <button
                                        key={d}
                                        className={`slt-trend-btn${trendDays===d?' active':''}`}
                                        onClick={() => fetchTrends(d)}
                                    >
                                        {d}d
                                    </button>
                                ))}
                            </div>
                        }
                    />
                    <div style={{ padding:'20px 24px' }}>
                        {loading && !trends.length ? (
                            <Skeleton h={220} r={12} />
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <LineChart data={trends} margin={{ top:5, right:5, left:-20, bottom:5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize:10, fill:C.muted }}
                                        tickFormatter={d => d?.slice(5)} // show MM-DD
                                        tickLine={false} axisLine={false}
                                        interval={Math.floor(trends.length / 6)}
                                    />
                                    <YAxis tick={{ fontSize:10, fill:C.muted }} tickLine={false} axisLine={false} />
                                    <Tooltip content={<LineTooltip />} />
                                    <Legend
                                        iconType="circle" iconSize={8}
                                        formatter={v => <span style={{ fontSize:12, color:C.muted }}>{v}</span>}
                                    />
                                    <Line
                                        type="monotone" dataKey="opened" name="Opened"
                                        stroke={C.red} strokeWidth={2.5} dot={false}
                                        activeDot={{ r:5, fill:C.red, strokeWidth:0 }}
                                    />
                                    <Line
                                        type="monotone" dataKey="completed" name="Completed"
                                        stroke={C.green} strokeWidth={2.5} dot={false}
                                        activeDot={{ r:5, fill:C.green, strokeWidth:0 }}
                                    />
                                    <Line
                                        type="monotone" dataKey="total" name="Total"
                                        stroke={C.sky} strokeWidth={1.5} dot={false}
                                        strokeDasharray="4 2"
                                        activeDot={{ r:5, fill:C.sky, strokeWidth:0 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            </div>

            {/* ── Row 3: Technician Table ──────────────────────────────────────── */}
            <Card style={{ marginBottom:20 }}>
                <CardHeader
                    title="Technician Performance"
                    subtitle="Sorted by selected metric — click column headers to sort"
                />
                <div style={{ overflowX:'auto' }}>
                    {loading && !techPerf.length ? (
                        <div style={{ padding:24, display:'flex', flexDirection:'column', gap:10 }}>
                            {[...Array(5)].map((_, i) => <Skeleton key={i} h={38} r={8} />)}
                        </div>
                    ) : (
                        <table style={{ width:'100%', borderCollapse:'collapse' }}>
                            <thead>
                            <tr style={{ borderBottom:`2px solid ${C.border}` }}>
                                {[
                                    { label:'Technician',      field:null },
                                    { label:'Total Jobs',       field:'totalJobs' },
                                    { label:'Completed',        field:'completedJobs' },
                                    { label:'Completion %',     field:'completionRate' },
                                    { label:'Avg Duration',     field:'avgDurationHours' },
                                    { label:'Satisfaction',     field:'satisfactionScore' },
                                    { label:'On-Time %',        field:'onTimeRate' },
                                    { label:'Overall Score',    field:null },
                                    { label:'Status',           field:null },
                                ].map((col, i) => (
                                    <th key={i} style={{
                                        padding:'12px 16px', textAlign:'left',
                                        background:C.offwhite, fontSize:11,
                                    }}>
                                        {col.field ? (
                                            <button
                                                className="slt-th-btn"
                                                onClick={() => handleSort(col.field)}
                                            >
                                                {col.label}
                                                {sortField === col.field
                                                    ? (sortDir === 'desc' ? ' ↓' : ' ↑')
                                                    : ' ↕'}
                                            </button>
                                        ) : (
                                            <span style={{ fontSize:12, fontWeight:700, color:C.muted }}>
                          {col.label}
                        </span>
                                        )}
                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {sortedTech.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign:'center', padding:40, color:C.muted, fontSize:13 }}>
                                        No technician data available
                                    </td>
                                </tr>
                            ) : (
                                sortedTech.map((t, i) => (
                                    <tr key={t.technicianId || i} className="slt-row">
                                        <td style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}` }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                                <div style={{
                                                    width:34, height:34, borderRadius:'50%',
                                                    background:`linear-gradient(135deg, ${C.navy}, ${C.sky})`,
                                                    display:'flex', alignItems:'center', justifyContent:'center',
                                                    fontSize:13, fontWeight:800, color:C.white,
                                                    flexShrink:0,
                                                }}>
                                                    {t.avatarInitial || t.name?.charAt(0) || 'T'}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize:13, fontWeight:600, color:C.text }}>
                                                        {t.name}
                                                    </div>
                                                    <div style={{ fontSize:11, color:C.muted }}>{t.phone}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`, fontSize:13, color:C.text, fontWeight:600 }}>
                                            {t.totalJobs}
                                        </td>
                                        <td style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`, fontSize:13, color:C.green, fontWeight:700 }}>
                                            {t.completedJobs}
                                        </td>
                                        <td style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}` }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                                <div style={{ flex:1, height:6, background:C.border, borderRadius:3, overflow:'hidden', minWidth:50 }}>
                                                    <div style={{
                                                        height:'100%', borderRadius:3,
                                                        width:`${Math.min(t.completionRate || 0, 100)}%`,
                                                        background: t.completionRate >= 80 ? C.green
                                                            : t.completionRate >= 60 ? C.orange : C.red,
                                                        transition:'width 0.5s ease',
                                                    }} />
                                                </div>
                                                <span style={{ fontSize:12, fontWeight:700, color:C.text, minWidth:34 }}>
                            {t.completionRate?.toFixed(0)}%
                          </span>
                                            </div>
                                        </td>
                                        <td style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`, fontSize:13, color:C.muted }}>
                                            {t.avgDurationHours?.toFixed(1)}h
                                        </td>
                                        <td style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}` }}>
                                            <Stars rating={t.satisfactionScore || 0} />
                                        </td>
                                        <td style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`, fontSize:13, color:C.muted }}>
                                            {t.onTimeRate?.toFixed(0)}%
                                        </td>
                                        <td style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}` }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{
                              fontSize:16, fontWeight:800, fontFamily:'Sora,sans-serif',
                              color: t.overallScore >= 80 ? C.green
                                  : t.overallScore >= 60 ? C.orange : C.red,
                          }}>
                            {t.overallScore?.toFixed(0)}
                          </span>
                                                <span style={{ fontSize:10, color:C.muted }}>/100</span>
                                            </div>
                                        </td>
                                        <td style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}` }}>
                                            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                                <PerfBadge level={t.performanceLevel} />
                                                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                                    <div style={{
                                                        width:7, height:7, borderRadius:'50%',
                                                        background: t.isOnline ? C.green : C.muted,
                                                    }} />
                                                    <span style={{ fontSize:10, color:C.muted }}>
                              {t.isOnline ? 'Online' : 'Offline'}
                            </span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>

            {/* ── Row 4: Map + Activity ─────────────────────────────────────────── */}
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, marginBottom:20 }}>

                {/* Geographic Heat Map */}
                <Card>
                    <CardHeader
                        title="Geographic Map"
                        subtitle={`Sri Lanka — ${mapTab === 'faults' ? 'Fault locations' : 'Technician positions'}`}
                        action={
                            <div style={{ display:'flex', gap:4 }}>
                                {['faults','technicians'].map(t => (
                                    <button
                                        key={t}
                                        className={`slt-tab${mapTab===t?' active':''}`}
                                        onClick={() => setMapTab(t)}
                                    >
                                        {t === 'faults' ? '🔴 Faults' : '👷 Technicians'}
                                    </button>
                                ))}
                            </div>
                        }
                    />
                    <div style={{ height:380, position:'relative' }}>
                        {loading && !geoData ? (
                            <Skeleton h={380} r={0} />
                        ) : (
                            <MapContainer
                                center={mapCenter}
                                zoom={7}
                                style={{ height:'100%', width:'100%' }}
                                scrollWheelZoom={false}
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://openstreetmap.org">OSM</a>'
                                />
                                {activeMarkers.map((m, i) => (
                                    <CircleMarker
                                        key={i}
                                        center={[m.latitude, m.longitude]}
                                        radius={mapTab === 'faults'
                                            ? Math.max(5, (m.intensity || 0.5) * 10)
                                            : 8}
                                        pathOptions={{
                                            fillColor: mapTab === 'faults'
                                                ? (m.status === 'OPEN' ? C.red
                                                    : m.status === 'IN_PROGRESS' ? C.orange
                                                        : C.green)
                                                : C.sky,
                                            fillOpacity: 0.75,
                                            color: C.white,
                                            weight: 1.5,
                                        }}
                                    >
                                        <Popup>
                                            <div style={{ fontSize:12 }}>
                                                {mapTab === 'faults' ? (
                                                    <>
                                                        <b>Fault #{m.faultId}</b><br />
                                                        Status: {m.status}<br />
                                                        {m.label}
                                                    </>
                                                ) : (
                                                    <>
                                                        <b>{m.technicianName}</b><br />
                                                        Status: {m.status}
                                                    </>
                                                )}
                                            </div>
                                        </Popup>
                                    </CircleMarker>
                                ))}
                            </MapContainer>
                        )}

                        {/* Map legend */}
                        <div style={{
                            position:'absolute', bottom:12, right:12, zIndex:1000,
                            background:'rgba(255,255,255,0.95)', borderRadius:10,
                            padding:'8px 12px', boxShadow:'0 2px 12px rgba(0,0,0,0.15)',
                            fontSize:11, display:'flex', flexDirection:'column', gap:5,
                            border:`1px solid ${C.border}`,
                        }}>
                            {mapTab === 'faults' ? (
                                <>
                                    <div style={{ fontWeight:700, color:C.navy, marginBottom:2 }}>Fault Status</div>
                                    {[['Open', C.red],['In Progress', C.orange],['Completed', C.green]].map(([l,c])=>(
                                        <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                                            <div style={{ width:10, height:10, borderRadius:'50%', background:c }} />
                                            <span style={{ color:C.muted }}>{l}</span>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <>
                                    <div style={{ fontWeight:700, color:C.navy, marginBottom:2 }}>Technicians</div>
                                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                                        <div style={{ width:10, height:10, borderRadius:'50%', background:C.sky }} />
                                        <span style={{ color:C.muted }}>Active</span>
                                    </div>
                                </>
                            )}
                            <div style={{ color:C.muted, marginTop:2 }}>
                                {activeMarkers.length} markers
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Recent Activity Feed */}
                <Card>
                    <CardHeader
                        title="Recent Activity"
                        subtitle="Last 20 system events"
                        action={
                            <div style={{
                                fontSize:11, fontWeight:700, color:C.sky, cursor:'pointer',
                            }}
                                 onClick={() => fetchAll()}
                            >
                                Refresh
                            </div>
                        }
                    />
                    <div style={{
                        overflowY:'auto', maxHeight:380,
                        padding:'8px 0',
                    }}>
                        {loading && !activity.length ? (
                            <div style={{ padding:'12px 20px', display:'flex', flexDirection:'column', gap:10 }}>
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                                        <Skeleton h={34} w={34} r={10} />
                                        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
                                            <Skeleton h={13} r={6} />
                                            <Skeleton h={11} w="70%" r={6} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : activity.length === 0 ? (
                            <div style={{ padding:40, textAlign:'center', color:C.muted, fontSize:13 }}>
                                No recent activity
                            </div>
                        ) : (
                            activity.map((item, i) => {
                                const s = activityStyle(item.type);
                                return (
                                    <div key={i} style={{
                                        display:'flex', gap:12, padding:'10px 20px',
                                        alignItems:'flex-start',
                                        borderBottom: i < activity.length - 1
                                            ? `1px solid ${C.border}` : 'none',
                                        transition:'background 0.1s',
                                    }}
                                         onMouseEnter={e => e.currentTarget.style.background = C.offwhite}
                                         onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{
                                            width:34, height:34, borderRadius:10, flexShrink:0,
                                            background:s.bg, color:s.color,
                                            display:'flex', alignItems:'center', justifyContent:'center',
                                            fontSize:16,
                                        }}>
                                            {item.icon || s.emoji}
                                        </div>
                                        <div style={{ flex:1, minWidth:0 }}>
                                            <div style={{
                                                fontSize:12, fontWeight:600, color:C.text,
                                                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                                            }}>
                                                {item.title}
                                            </div>
                                            <div style={{
                                                fontSize:11, color:C.muted, marginTop:2,
                                                display:'-webkit-box', WebkitLineClamp:2,
                                                WebkitBoxOrient:'vertical', overflow:'hidden',
                                            }}>
                                                {item.description}
                                            </div>
                                            <div style={{
                                                fontSize:10, color:C.muted, marginTop:4,
                                                display:'flex', gap:6, alignItems:'center',
                                            }}>
                        <span style={{
                            padding:'2px 6px', borderRadius:4,
                            background:`${s.bg}`, color:s.color,
                            fontWeight:600,
                        }}>
                          {item.actorRole}
                        </span>
                                                <span>{item.timeAgo}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Card>
            </div>

            {/* ── Row 5: Summary stat bar ──────────────────────────────────────── */}
            <Card style={{ marginBottom:20 }}>
                <div style={{
                    display:'grid',
                    gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',
                    gap:0,
                }}>
                    {[
                        { label:'Avg Resolution',    value: kpi ? `${kpi.avgResolutionTimeHours ?? 0}h` : '—', icon:'⏱️', color:C.blue },
                        { label:'Cancelled Faults',  value: dist?.cancelled ?? '—', icon:'❌', color:C.red },
                        { label:'Total Technicians', value: kpi?.totalTechnicians ?? '—', icon:'👷', color:C.sky },
                        { label:'Total Users',       value: kpi?.totalUsers ?? '—', icon:'👥', color:C.navy },
                        { label:'Approved Payments', value: kpi?.approvedPayments ?? '—', icon:'✅', color:C.green },
                        { label:'On-Time Rate',      value: kpi ? `${kpi.onTimeCompletionRate ?? 0}%` : '—', icon:'🎯', color:C.purple },
                    ].map((s, i) => (
                        <div key={i} style={{
                            padding:'16px 20px',
                            borderRight: `1px solid ${C.border}`,
                            borderTop: `1px solid ${C.border}`,
                            display:'flex', alignItems:'center', gap:12,
                        }}>
                            <span style={{ fontSize:20 }}>{s.icon}</span>
                            <div>
                                <div style={{ fontSize:18, fontWeight:800, color:s.color, fontFamily:'Sora,sans-serif' }}>
                                    {s.value}
                                </div>
                                <div style={{ fontSize:11, color:C.muted }}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

        </div>
    );
}