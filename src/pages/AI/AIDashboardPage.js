import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { AI, aiReq, A, Skel, StatusDot, AiCard, AiToast, injectAiStyles } from './aiClient';

const CLUSTER_PAL = ['#00FFD1','#FF2D78','#1E90FF','#FFB020','#9B59F5'];

const AiTooltip = ({active,payload,label}) => {
    if(!active||!payload?.length)return null;
    return (
        <div style={{ background:A.panel, border:`1px solid ${A.border}`, borderRadius:8, padding:'10px 14px', fontSize:11, color:A.text, fontFamily:'monospace', boxShadow:'0 4px 20px rgba(0,0,0,0.5)' }}>
            <div style={{ color:A.neon, fontWeight:700, marginBottom:5 }}>{label}</div>
            {payload.map((p,i) => <div key={i} style={{ marginBottom:2 }}><span style={{ color:p.color }}>▸ </span>{p.name}: <b>{typeof p.value==='number'?p.value.toFixed(1):p.value}</b></div>)}
        </div>
    );
};

// ─── Prophet Chart ────────────────────────────────────────────────────────────
function ProphetChart({ data, loading, accuracy }) {
    if (loading) return <Skel h={280} r={8}/>;
    if (!data?.length) return (
        <div style={{ textAlign:'center', padding:'40px 0', color:A.muted }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📊</div>
            <div style={{ color:A.text, fontSize:13, marginBottom:4 }}>No forecast data</div>
            <div style={{ fontSize:11 }}>AI service needs 6+ months of historical fault data</div>
        </div>
    );

    const forecastIdx = data.findIndex(d => d.isForecast);

    return (
        <div>
            {accuracy != null && (
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:20, marginBottom:14, background:A.neonL, border:`1px solid ${A.neon}44`, fontSize:11, fontWeight:800, color:A.neon }}>
                    🎯 Model Accuracy: {accuracy}% &nbsp;·&nbsp; Target ≥85%
                </div>
            )}
            <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data} margin={{ top:10, right:10, left:-20, bottom:0 }}>
                    <defs>
                        <linearGradient id="hGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={A.blue} stopOpacity={0.4}/><stop offset="95%" stopColor={A.blue} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="fGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={A.neon} stopOpacity={0.35}/><stop offset="95%" stopColor={A.neon} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={A.violet} stopOpacity={0.15}/><stop offset="95%" stopColor={A.violet} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke={A.border} vertical={false}/>
                    <XAxis dataKey="date" tick={{ fontSize:9, fill:A.muted, fontFamily:'monospace' }} tickLine={false} axisLine={false} tickFormatter={d=>d?.slice?.(5)||d} interval={Math.max(1,Math.floor(data.length/8))}/>
                    <YAxis tick={{ fontSize:9, fill:A.muted, fontFamily:'monospace' }} tickLine={false} axisLine={false}/>
                    <Tooltip content={<AiTooltip/>}/>
                    {forecastIdx > 0 && (
                        <ReferenceLine x={data[forecastIdx]?.date} stroke={A.neon} strokeDasharray="4 2" strokeWidth={1.5}
                                       label={{ value:'▶ FORECAST', position:'insideTopLeft', fill:A.neon, fontSize:9, fontFamily:'monospace' }}
                        />
                    )}
                    {data[0]?.upper != null && <Area type="monotone" dataKey="upper" name="Upper" stroke="none" fill="url(#cGrad)" dot={false} connectNulls/>}
                    <Area type="monotone" dataKey="actual"   name="Historical" stroke={A.blue} strokeWidth={2.5} fill="url(#hGrad)" dot={false} activeDot={{ r:4, fill:A.blue, strokeWidth:0 }} connectNulls/>
                    <Area type="monotone" dataKey="forecast" name="AI Forecast" stroke={A.neon} strokeWidth={2.5} strokeDasharray="8 3" fill="url(#fGrad)" dot={false} activeDot={{ r:4, fill:A.neon, strokeWidth:0 }} connectNulls/>
                    {data[0]?.lower != null && <Area type="monotone" dataKey="lower" name="Lower" stroke="none" fill="none" dot={false} connectNulls/>}
                    <Legend iconType="circle" iconSize={7} formatter={v=><span style={{ fontSize:10, color:A.muted, fontFamily:'monospace' }}>{v}</span>}/>
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── K-Means Cluster Map (SVG) ────────────────────────────────────────────────
function ClusterMap({ clusters, loading }) {
    if (loading) return <Skel h={320} r={10}/>;
    if (!clusters?.length) return (
        <div style={{ textAlign:'center', padding:'40px 0', color:A.muted, fontSize:12 }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🗺️</div>No cluster data available
        </div>
    );

    const W=560, H=300;
    // Sri Lanka approx bounds
    const LAT_MIN=5.9, LAT_MAX=9.9, LNG_MIN=79.5, LNG_MAX=81.9;
    const toX = lng => ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * (W - 40) + 20;
    const toY = lat => (1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * (H - 40) + 20;

    const RISK_COL = { HIGH:A.pink, MEDIUM:A.amber, LOW:A.neon };

    return (
        <div>
            <div style={{ position:'relative', borderRadius:10, overflow:'hidden', background:A.surface, border:`1px solid ${A.border}` }}>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', display:'block' }}>
                    <defs>
                        <pattern id="aiGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={A.border} strokeWidth="0.5" opacity="0.4"/>
                        </pattern>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="blur"/>
                            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                    </defs>
                    <rect width={W} height={H} fill="url(#aiGrid)"/>
                    {/* Sri Lanka simplified outline */}
                    <polygon
                        points="280,22 315,38 348,82 358,142 338,202 308,252 268,272 228,262 198,222 188,162 198,102 228,52"
                        fill={A.neonL} stroke={A.neon} strokeWidth="1.5" opacity="0.55" filter="url(#glow)"
                    />
                    {clusters.map((c, i) => {
                        const col  = CLUSTER_PAL[i % CLUSTER_PAL.length];
                        const lat  = c.centroid?.lat || c.latitude  || (LAT_MIN + (LAT_MAX-LAT_MIN)*(0.2+i*0.17));
                        const lng  = c.centroid?.lng || c.longitude || (LNG_MIN + (LNG_MAX-LNG_MIN)*(0.2+i*0.14));
                        const cx   = toX(lng);
                        const cy   = toY(lat);
                        const r    = Math.max(12, Math.min(38, (c.faultCount||c.count||20)*0.8));
                        return (
                            <g key={i}>
                                <circle cx={cx} cy={cy} r={r+10} fill={col} opacity="0.06"/>
                                <circle cx={cx} cy={cy} r={r+5}  fill="none" stroke={col} strokeWidth="0.8" opacity="0.25"/>
                                <circle cx={cx} cy={cy} r={r}     fill={col} opacity="0.22" stroke={col} strokeWidth="2" style={{ filter:`drop-shadow(0 0 8px ${col}88)` }}/>
                                <circle cx={cx} cy={cy} r="5"     fill={col} style={{ filter:`drop-shadow(0 0 5px ${col})` }}/>
                                <text x={cx} y={cy-r-8} textAnchor="middle" fill={col} fontSize="10" fontWeight="bold" fontFamily="monospace">{c.regionName||`C${i+1}`}</text>
                                <text x={cx} y={cy+4}   textAnchor="middle" fill={col} fontSize="9"  fontFamily="monospace">{c.faultCount||c.count||0}</text>
                            </g>
                        );
                    })}
                    {/* Legend */}
                    {[['HIGH',A.pink],['MED',A.amber],['LOW',A.neon]].map(([l,col],i) => (
                        <g key={i} transform={`translate(${W-70},${18+i*18})`}>
                            <circle cx="6" cy="6" r="4" fill={col} opacity="0.75"/>
                            <text x="13" y="10" fill={A.muted} fontSize="8" fontFamily="monospace">{l}</text>
                        </g>
                    ))}
                </svg>
            </div>
            {/* Cluster cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:8, marginTop:12 }}>
                {clusters.map((c,i)=>{
                    const col  = CLUSTER_PAL[i%CLUSTER_PAL.length];
                    const risk = RISK_COL[c.riskLevel] || A.neon;
                    return (
                        <div key={i} style={{ padding:'10px 12px', borderRadius:10, background:A.surface, border:`1.5px solid ${col}44` }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
                                <div style={{ width:8, height:8, borderRadius:'50%', background:col, boxShadow:`0 0 6px ${col}` }}/>
                                <span style={{ fontSize:11, fontWeight:800, color:col }}>{c.regionName||`Cluster ${i+1}`}</span>
                            </div>
                            <div style={{ fontSize:22, fontWeight:900, color:A.text, fontFamily:'Orbitron,sans-serif', lineHeight:1 }}>{c.faultCount||c.count||0}</div>
                            <div style={{ fontSize:9, color:A.muted, marginBottom:4 }}>faults in zone</div>
                            {c.riskLevel && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, fontWeight:800, background:`${risk}18`, color:risk }}>{c.riskLevel} RISK</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Model Metrics ────────────────────────────────────────────────────────────
function Metrics({ m, loading }) {
    if (loading) return <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>{[...Array(6)].map((_,i)=><Skel key={i} h={60} r={8}/>)}</div>;
    if (!m) return null;
    const items = [
        { l:'MAE',         v:m.mae?.toFixed(2),              c:A.neon,   d:'Mean Abs Error'  },
        { l:'RMSE',        v:m.rmse?.toFixed(2),             c:A.blue,   d:'Root Mean Sq'    },
        { l:'Accuracy',    v:`${m.accuracy?.toFixed(0)||'—'}%`, c:m.accuracy>=85?A.neon:A.pink, d:'Target ≥85%' },
        { l:'Train Days',  v:m.trainingDays||'—',            c:A.amber,  d:'Data used'       },
        { l:'Horizon',     v:`${m.horizon||30}d`,            c:A.violet, d:'Forecast window' },
        { l:'Last Trained',v:m.lastTrained?.slice?.(0,10)||'—', c:A.muted, d:'Retrain date'  },
    ];
    return (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8 }}>
            {items.map((s,i)=>(
                <div key={i} style={{ padding:'10px 12px', borderRadius:8, background:A.surface, border:`1px solid ${s.c}33` }}>
                    <div style={{ fontSize:18, fontWeight:900, color:s.c, fontFamily:'Orbitron,sans-serif', lineHeight:1 }}>{s.v||'—'}</div>
                    <div style={{ fontSize:10, fontWeight:800, color:s.c, marginTop:2 }}>{s.l}</div>
                    <div style={{ fontSize:9, color:A.muted }}>{s.d}</div>
                </div>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AIDashboardPage() {
    const [online,   setOnline]   = useState(null);
    const [forecast, setForecast] = useState([]);
    const [clusters, setClusters] = useState([]);
    const [metrics,  setMetrics]  = useState(null);
    const [loading,  setLoading]  = useState({ f:false, c:false });
    const [horizon,  setHorizon]  = useState(30);
    const [toast,    setToast]    = useState(null);
    const [lastFetch,setLastFetch]= useState(null);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3200);
        return () => clearTimeout(t);
    }, [toast]);

    const check = useCallback(async () => {
        try { await aiReq('/api/ai/health'); setOnline(true); }
        catch { setOnline(false); }
    }, []);

    const loadAll = useCallback(async () => {
        if (!online) return;
        // Forecast
        setLoading(l => ({ ...l, f:true }));
        try {
            const d = await aiReq(`/api/ai/predictions?horizon=${horizon}`);
            const hist = (d.historical||[]).map(p => ({ date:p.ds||p.date, actual:p.y||p.value, isForecast:false }));
            const fore = (d.forecast||[]).map(p => ({ date:p.ds||p.date, forecast:p.yhat||p.value, upper:p.yhat_upper||p.upper, lower:p.yhat_lower||p.lower, isForecast:true }));
            setForecast([...hist, ...fore]);
            if (d.metrics) setMetrics(d.metrics);
        } catch (e) { console.error('forecast', e); }
        finally { setLoading(l => ({ ...l, f:false })); }
        // Clusters
        setLoading(l => ({ ...l, c:true }));
        try {
            const d = await aiReq(`/api/ai/clusters?n_clusters=5`);
            setClusters(d.clusters || d || []);
        } catch (e) { console.error('clusters', e); }
        finally { setLoading(l => ({ ...l, c:false })); setLastFetch(new Date()); }
    }, [online, horizon]);

    useEffect(() => { check(); }, [check]);
    useEffect(() => { if (online) loadAll(); }, [online, loadAll]);

    useEffect(() => { injectAiStyles(); }, []);

    return (
        <div className="ai-page" style={{ background:A.bg, minHeight:'100vh', padding:'28px 32px', fontFamily:'system-ui,sans-serif' }}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28 }}>
                <div>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:4 }}>
                        <h1 style={{ margin:0, fontSize:24, fontWeight:900, color:A.neon, fontFamily:'Orbitron,sans-serif', letterSpacing:1, textShadow:`0 0 20px ${A.neon}55` }}>
                            AI Intelligence
                        </h1>
                        <StatusDot online={online}/>
                    </div>
                    <div style={{ fontSize:11, color:A.muted }}>
                        Prophet forecasting · K-Means clustering · Dijkstra routing
                        {lastFetch && ` · ${lastFetch.toLocaleTimeString()}`}
                    </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <div style={{ display:'flex', border:`1px solid ${A.border}`, borderRadius:8, overflow:'hidden' }}>
                        {[7,14,30].map(h => (
                            <button key={h} onClick={() => setHorizon(h)} style={{ padding:'6px 14px', border:'none', cursor:'pointer', fontSize:10, fontWeight:800, fontFamily:'Orbitron,sans-serif', background:horizon===h?A.neon:A.panel, color:horizon===h?A.bg:A.muted, transition:'all 0.12s' }}>
                                {h}D
                            </button>
                        ))}
                    </div>
                    {online && (
                        <button onClick={loadAll} style={{ padding:'8px 16px', borderRadius:8, border:`1.5px solid ${A.neon}44`, background:A.neonL, color:A.neon, cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'Orbitron,sans-serif' }}>↻ REFRESH</button>
                    )}
                </div>
            </div>

            {/* Offline */}
            {online === false && (
                <div style={{ background:A.panel, borderRadius:14, padding:'40px 32px', textAlign:'center', border:`2px solid ${A.pink}44`, boxShadow:`0 0 40px ${A.pink}11` }}>
                    <div style={{ fontSize:52, marginBottom:16 }}>🤖</div>
                    <div style={{ fontSize:20, fontWeight:900, color:A.pink, fontFamily:'Orbitron,sans-serif', letterSpacing:1, marginBottom:10 }}>AI MODULE OFFLINE</div>
                    <div style={{ fontSize:13, color:A.muted, marginBottom:20, lineHeight:1.7 }}>The Flask AI service is not responding.<br/>Start with:</div>
                    <code style={{ display:'block', padding:'12px 20px', borderRadius:8, fontSize:13, background:A.surface, border:`1px solid ${A.neon}33`, color:A.neon, letterSpacing:0.5, marginBottom:20 }}>
                        cd slt-ai-module &amp;&amp; python app.py
                    </code>
                    <div style={{ fontSize:11, color:A.muted, marginBottom:16 }}>Expected at: <span style={{ color:A.neon }}>{AI}</span></div>
                    <button onClick={check} style={{ padding:'10px 24px', borderRadius:8, cursor:'pointer', background:A.neonL, border:`1.5px solid ${A.neon}55`, color:A.neon, fontSize:12, fontWeight:800, fontFamily:'Orbitron,sans-serif' }}>⟳ RETRY</button>
                </div>
            )}

            {online && (
                <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

                    {/* Model Training pointer — SRS 5.6.7's CSV upload + retrain flow now
                        lives on its own page (job-based, with Activate/Rollback governance)
                        instead of being a toggle here. */}
                    <Link to="/model-training" style={{ textDecoration:'none' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderRadius:14, background:A.panel, border:`1px solid ${A.violet}33`, cursor:'pointer' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                                <div style={{ width:38, height:38, borderRadius:10, background:`${A.violet}18`, border:`1px solid ${A.violet}33`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🧠</div>
                                <div>
                                    <div style={{ fontSize:14, fontWeight:800, color:A.text, fontFamily:'Orbitron,sans-serif' }}>Retrain from a CSV upload</div>
                                    <div style={{ fontSize:11, color:A.muted, marginTop:2 }}>Model Training panel — upload data, review candidate metrics, activate or roll back</div>
                                </div>
                            </div>
                            <span style={{ color:A.violet, fontSize:18 }}>→</span>
                        </div>
                    </Link>

                    {/* SRS 5.6.8 (FR-33) — combines this page's own forecast + clusters into
                        per-hotspot Technician/Vehicle/Material suggestions; own page, same
                        pattern as Model Training above. */}
                    <Link to="/resource-planning" style={{ textDecoration:'none' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderRadius:14, background:A.panel, border:`1px solid ${A.neon}33`, cursor:'pointer' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                                <div style={{ width:38, height:38, borderRadius:10, background:`${A.neon}18`, border:`1px solid ${A.neon}33`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🧰</div>
                                <div>
                                    <div style={{ fontSize:14, fontWeight:800, color:A.text, fontFamily:'Orbitron,sans-serif' }}>Predictive Resource Planning</div>
                                    <div style={{ fontSize:11, color:A.muted, marginTop:2 }}>Resource Planning panel — predicted hotspots with suggested Technician/Vehicle/Material quantities</div>
                                </div>
                            </div>
                            <span style={{ color:A.neon, fontSize:18 }}>→</span>
                        </div>
                    </Link>

                    {/* Metrics */}
                    <AiCard title="Model Performance" subtitle="Prophet evaluation metrics" icon="📐" accent={A.neon} badge="LIVE METRICS">
                        <Metrics m={metrics} loading={loading.f && !metrics}/>
                    </AiCard>

                    {/* Forecast */}
                    <AiCard title="Fault Volume Forecast" subtitle={`${horizon}-day Prophet prediction with confidence bounds`} icon="📈" accent={A.blue} badge="PROPHET">
                        <ProphetChart data={forecast} loading={loading.f} accuracy={metrics?.accuracy}/>
                    </AiCard>

                    {/* Clusters */}
                    <AiCard title="Geographic Demand Clusters" subtitle="K-Means (k=5) — high-demand zones for technician pre-positioning" icon="🗺️" accent={A.violet} badge="K-MEANS">
                        <ClusterMap clusters={clusters} loading={loading.c}/>
                    </AiCard>

                    {/* Footer */}
                    <div style={{ padding:'12px 16px', borderRadius:8, background:A.surface, border:`1px solid ${A.border}`, fontSize:11, color:A.muted, lineHeight:1.7 }}>
                        <b style={{ color:A.text }}>About:</b> Flask service on port 5000. Prophet trains on 12–24 months of fault data. K-Means groups fault GPS coordinates into 5 demand zones across Sri Lanka.
                    </div>
                </div>
            )}

            <AiToast toast={toast} onClose={() => setToast(null)}/>
        </div>
    );
}