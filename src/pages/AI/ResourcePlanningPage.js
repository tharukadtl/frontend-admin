import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { aiReq, tok, A, Skel, StatusDot, AiCard, AiToast, injectAiStyles } from './aiClient';

// ─── SRS 5.6.8 — Predictive Resource Planning panel (FR-33, Stage 3a + 3b) ────
// Own page under the AI section, not a tab bolted onto AIDashboardPage: the
// SRS's own reviewer split groups 5.6.7 (Model Training) and "5.6.8's UI half"
// together as the AI/ML Dashboard UI screens, and Model Training already
// established that a capability this substantial gets its own page + sidebar
// link rather than a dashboard tab — this panel follows that same precedent.
//
// Advisory only (SRS 5.6.8): GET /api/ai/resource-plan returns suggested
// Technician/Vehicle/Material quantities per predicted hotspot; the Admin
// reviews and can adjust any number before "confirming".
//
// Stage 3b: "Confirm Plan" now POSTs to the fieldops backend (Spring Boot,
// NOT the Flask AI service — this is operational data tied to real OPMC/
// Team Lead entities, not AI/ML output), which persists it so the Team
// Lead's BOD screen can read it as a starting point. The AI module's K-Means
// zones are ephemeral cluster indices recomputed on every call — never
// persisted, no stable link to an OPMC/Team Lead — so the Admin explicitly
// maps each zone to an OPMC below before confirming; there is no automatic
// zone-to-OPMC inference.

const ZONE_PAL  = ['#00FFD1','#FF2D78','#1E90FF','#FFB020','#9B59F5'];
const SHIFT_CFG = {
    MORNING:   { label:'Morning',   icon:'🌅', accent:A.blue   },
    AFTERNOON: { label:'Afternoon', icon:'☀️',  accent:A.amber  },
    EVENING:   { label:'Evening',   icon:'🌆', accent:A.violet },
};
const HORIZONS = [7, 14, 30];

const selectStyle = { padding:'6px 10px', borderRadius:8, border:`1px solid ${A.border}`, background:A.surface, color:A.text, fontSize:11, fontFamily:'monospace' };

function hotspotKey(h) { return `${h.date}__${h.shift}__${h.zoneId}`; }

// ─── fieldops (Spring Boot) client — separate from the Flask AI service ───────
// Resource-plan CONFIRMATION is operational business data tied to a real
// OPMC/Team Lead, so it lives in fieldops/MySQL, not the AI module's
// file-based model storage. Same inline-fetch-helper shape as other
// frontend-admin pages (e.g. OpmcsPage.js) — reuses aiClient's tok().
const FIELDOPS = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const fieldopsReq = (method, path, body) =>
    fetch(`${FIELDOPS}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: body ? JSON.stringify(body) : undefined,
    }).then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.message || data?.error || `${r.status}`);
        return data;
    });

// ─── Insufficient-history state (shared 6-month rule, per Stage 1/2) ──────────
function InsufficientHistory({ historyDays, requiredDays }) {
    const pct = requiredDays ? Math.min(100, Math.round(((historyDays||0) / requiredDays) * 100)) : 0;
    return (
        <div style={{ background:A.panel, borderRadius:14, padding:'40px 32px', textAlign:'center', border:`2px solid ${A.amber}44` }}>
            <div style={{ fontSize:52, marginBottom:16 }}>📉</div>
            <div style={{ fontSize:20, fontWeight:900, color:A.amber, fontFamily:'Orbitron,sans-serif', letterSpacing:1, marginBottom:10 }}>
                INSUFFICIENT HISTORICAL DATA
            </div>
            <div style={{ fontSize:13, color:A.muted, marginBottom:20, lineHeight:1.7 }}>
                Predictive Resource Planning needs at least {requiredDays ?? '—'} days of fault history<br/>
                (the same 6-month minimum Forecasting uses) — only {historyDays ?? 0} days are available right now.
            </div>
            <div style={{ width:280, margin:'0 auto', height:8, borderRadius:4, background:A.surface, overflow:'hidden', border:`1px solid ${A.border}` }}>
                <div style={{ width:`${pct}%`, height:'100%', background:A.amber, borderRadius:4 }}/>
            </div>
            <div style={{ fontSize:11, color:A.muted, marginTop:8 }}>{historyDays ?? 0} / {requiredDays ?? '—'} days</div>
        </div>
    );
}

// ─── Editable quantity input ────────────────────────────────────────────────────
function QtyInput({ value, onChange, accent=A.text, width=56 }) {
    return (
        <input
            type="number" min="0" value={value ?? ''}
            onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
            style={{ width, padding:'4px 6px', borderRadius:6, border:`1px solid ${A.border}`, background:A.surface, color:accent, fontSize:12, fontFamily:'monospace', textAlign:'center' }}
        />
    );
}

// ─── One hotspot row ────────────────────────────────────────────────────────────
function HotspotRow({ h, plan, shortfallIds, onEditTech, onEditVeh, onEditMaterial }) {
    const shift = SHIFT_CFG[h.shift] || { label:h.shift, icon:'•', accent:A.muted };
    const zoneColor = ZONE_PAL[h.zoneId % ZONE_PAL.length];
    const key = hotspotKey(h);
    return (
        <tr style={{ borderBottom:`1px solid ${A.border}` }}>
            <td style={{ padding:'10px 12px', fontSize:11, color:A.text, fontFamily:'monospace', whiteSpace:'nowrap' }}>{h.date}</td>
            <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:800, background:`${shift.accent}18`, color:shift.accent, border:`1px solid ${shift.accent}44` }}>
                    {shift.icon} {shift.label}
                </span>
            </td>
            <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, color:A.text }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:zoneColor, boxShadow:`0 0 6px ${zoneColor}`, flexShrink:0 }}/>
                    {h.zoneName}
                </span>
            </td>
            <td style={{ padding:'10px 12px', fontSize:13, fontWeight:800, color:A.neon, fontFamily:'Orbitron,sans-serif', textAlign:'right' }}>
                {h.predictedFaultCount}
            </td>
            <td style={{ padding:'10px 12px', textAlign:'center' }}>
                <QtyInput value={plan.suggestedTechnicians} onChange={v => onEditTech(key, v)} accent={A.blue}/>
            </td>
            <td style={{ padding:'10px 12px', textAlign:'center' }}>
                <QtyInput value={plan.suggestedVehicles} onChange={v => onEditVeh(key, v)} accent={A.violet}/>
            </td>
            <td style={{ padding:'10px 12px', minWidth:180 }}>
                {plan.materials.length === 0 && <span style={{ fontSize:10, color:A.muted }}>—</span>}
                {plan.materials.map(m => {
                    const short = shortfallIds.has(m.materialId);
                    return (
                        <div key={m.materialId} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, fontSize:10 }}>
                            <span style={{ color: short ? A.pink : A.muted, minWidth:90 }}>{short && '⚠️ '}{m.materialName}</span>
                            <QtyInput value={m.suggestedQuantity} onChange={v => onEditMaterial(key, m.materialId, v)} accent={short ? A.pink : A.text} width={64}/>
                        </div>
                    );
                })}
            </td>
        </tr>
    );
}

// ─── Material shortfalls summary ────────────────────────────────────────────────
function ShortfallsCard({ shortfalls }) {
    const flagged = (shortfalls||[]).filter(s => s.insufficient);
    if (flagged.length === 0) {
        return (
            <AiCard title="Material Shortfalls" subtitle="Current stock vs. total suggested demand across the horizon" icon="📦" accent={A.neon} badge="ALL CLEAR">
                <div style={{ fontSize:12, color:A.muted }}>✅ No materials flagged — current stock covers every suggested quantity.</div>
            </AiCard>
        );
    }
    return (
        <AiCard title="Material Shortfalls" subtitle="Current stock vs. total suggested demand across the horizon" icon="📦" accent={A.pink} badge={`${flagged.length} FLAGGED`}>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {flagged.map(s => (
                    <div key={s.materialId} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6, padding:'8px 12px', borderRadius:8, background:A.pinkL, border:`1px solid ${A.pink}44` }}>
                        <span style={{ fontSize:12, color:A.text, fontWeight:700 }}>⚠️ {s.materialName}</span>
                        <span style={{ fontSize:11, color:A.pink, fontFamily:'monospace' }}>
                            {s.currentStock}{s.unit ? ` ${s.unit}` : ''} on hand <span style={{ color:A.muted }}>/</span> {s.totalSuggestedQuantity}{s.unit ? ` ${s.unit}` : ''} needed
                        </span>
                    </div>
                ))}
            </div>
        </AiCard>
    );
}

// ─── Zone → OPMC assignment (required before confirming, Stage 3b) ────────────
function ZoneOpmcMapCard({ zoneOptions, opmcs, loadingOpmcs, zoneOpmcMap, onChange }) {
    return (
        <AiCard
            title="Zone → OPMC Assignment"
            subtitle="Required before confirming — the AI module's zones aren't linked to an OPMC/Team Lead automatically"
            icon="🏢" accent={A.violet}
            badge={loadingOpmcs ? 'LOADING' : `${zoneOptions.length} ZONE${zoneOptions.length===1?'':'S'}`}
        >
            {loadingOpmcs ? (
                <div style={{ fontSize:11, color:A.muted }}>Loading OPMCs…</div>
            ) : opmcs.length === 0 ? (
                <div style={{ fontSize:11, color:A.pink }}>⚠️ No active OPMCs found — a plan can't be confirmed without at least one.</div>
            ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10 }}>
                    {zoneOptions.map(([zoneId, zoneName]) => {
                        const zoneColor = ZONE_PAL[zoneId % ZONE_PAL.length];
                        const assigned = zoneOpmcMap[zoneId];
                        return (
                            <div key={zoneId} style={{ padding:'10px 12px', borderRadius:8, background:A.surface, border:`1px solid ${assigned ? A.border : A.pink+'66'}` }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                                    <span style={{ width:8, height:8, borderRadius:'50%', background:zoneColor, flexShrink:0 }}/>
                                    <span style={{ fontSize:11, fontWeight:800, color:A.text }}>{zoneName}</span>
                                    {!assigned && <span style={{ fontSize:9, color:A.pink }}>unassigned</span>}
                                </div>
                                <select
                                    value={assigned || ''}
                                    onChange={e => onChange(zoneId, e.target.value ? Number(e.target.value) : null)}
                                    style={{ ...selectStyle, width:'100%' }}
                                >
                                    <option value="">— Select OPMC —</option>
                                    {opmcs.map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
                                </select>
                            </div>
                        );
                    })}
                </div>
            )}
        </AiCard>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function ResourcePlanningPage() {
    const [online,    setOnline]    = useState(null);
    const [horizon,   setHorizon]   = useState(7);
    const [loading,   setLoading]   = useState(false);
    const [raw,       setRaw]       = useState(null);   // last server response, verbatim
    const [planByKey, setPlanByKey] = useState({});     // editable copy, keyed by hotspotKey()
    const [zoneFilter,  setZoneFilter]  = useState('ALL');
    const [shiftFilter, setShiftFilter] = useState('ALL');
    const [confirmed, setConfirmed] = useState(null);   // { payload, result } from the last successful confirm
    const [confirming, setConfirming] = useState(false);
    const [toast,     setToast]     = useState(null);

    // Zone -> OPMC assignment (Stage 3b) — required so a confirmed plan can
    // be looked up by a Team Lead's own OPMC. { [zoneId]: opmcId }
    const [opmcs, setOpmcs] = useState([]);
    const [loadingOpmcs, setLoadingOpmcs] = useState(false);
    const [zoneOpmcMap, setZoneOpmcMap] = useState({});

    const notify = useCallback((msg, type='success') => setToast({msg, type}), []);
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3200);
        return () => clearTimeout(t);
    }, [toast]);
    useEffect(() => { injectAiStyles(); }, []);

    // Active OPMCs for the Zone -> OPMC picker — fieldops, independent of
    // the AI service's online status.
    useEffect(() => {
        setLoadingOpmcs(true);
        fieldopsReq('GET', '/api/opmcs/active')
            .then(list => setOpmcs(Array.isArray(list) ? list : []))
            .catch(e => {
                console.error('opmcs', e);
                notify(`Failed to load OPMCs: ${e.message}`, 'error');
            })
            .finally(() => setLoadingOpmcs(false));
    }, []);

    const check = useCallback(async () => {
        try { await aiReq('/api/ai/health'); setOnline(true); }
        catch { setOnline(false); }
    }, []);
    useEffect(() => { check(); }, [check]);

    const load = useCallback(async () => {
        if (!online) return;
        setLoading(true);
        try {
            const d = await aiReq(`/api/ai/resource-plan?horizon=${horizon}`);
            setRaw(d);
            if (!d.insufficientData) {
                const editable = {};
                (d.hotspots || []).forEach(h => {
                    editable[hotspotKey(h)] = {
                        suggestedTechnicians: h.suggestedTechnicians,
                        suggestedVehicles:    h.suggestedVehicles,
                        materials:            (h.materials || []).map(m => ({ ...m })),
                    };
                });
                setPlanByKey(editable);
            } else {
                setPlanByKey({});
            }
            setConfirmed(null);
        } catch (e) {
            console.error('resource-plan', e);
            notify(`Failed to load resource plan: ${e.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [online, horizon, notify]);

    useEffect(() => { if (online) load(); }, [online, horizon, load]);

    const editTech = useCallback((key, v) => setPlanByKey(p => ({ ...p, [key]: { ...p[key], suggestedTechnicians: v } })), []);
    const editVeh  = useCallback((key, v) => setPlanByKey(p => ({ ...p, [key]: { ...p[key], suggestedVehicles: v } })), []);
    const editMat  = useCallback((key, materialId, v) => setPlanByKey(p => ({
        ...p,
        [key]: { ...p[key], materials: p[key].materials.map(m => m.materialId === materialId ? { ...m, suggestedQuantity: v } : m) },
    })), []);

    const hotspots = raw?.hotspots || [];

    const zoneOptions = useMemo(
        () => [...new Map(hotspots.map(h => [h.zoneId, h.zoneName])).entries()],
        [hotspots]
    );
    const shiftIds = useMemo(() => [...new Set(hotspots.map(h => h.shift))], [hotspots]);

    const filtered = hotspots.filter(h =>
        (zoneFilter === 'ALL' || h.zoneId === Number(zoneFilter)) &&
        (shiftFilter === 'ALL' || h.shift === shiftFilter)
    );

    const shortfallIds = useMemo(
        () => new Set((raw?.materialShortfalls || []).filter(s => s.insufficient).map(s => s.materialId)),
        [raw]
    );

    const totals = useMemo(() => {
        let technicians = 0, vehicles = 0;
        Object.values(planByKey).forEach(p => {
            technicians += Number(p.suggestedTechnicians) || 0;
            vehicles    += Number(p.suggestedVehicles) || 0;
        });
        return { technicians, vehicles, hotspots: hotspots.length };
    }, [planByKey, hotspots.length]);

    const setZoneOpmc = useCallback((zoneId, opmcId) => {
        setZoneOpmcMap(prev => ({ ...prev, [zoneId]: opmcId }));
    }, []);

    const allZonesMapped = zoneOptions.length > 0 && zoneOptions.every(([zoneId]) => !!zoneOpmcMap[zoneId]);

    // Stage 3b: "Confirm Plan" POSTs the reviewed + adjusted plan, along with
    // the Admin's zone->OPMC assignment, to fieldops (Spring Boot) —
    // ResourcePlanConfirmationService persists it per (OPMC, date, shift)
    // so the Team Lead's BOD screen can read it as a starting point.
    const handleConfirm = async () => {
        if (!allZonesMapped) {
            notify('Assign an OPMC to every zone before confirming.', 'error');
            return;
        }
        const payload = {
            horizonDays: raw?.horizonDays,
            generatedAt: raw?.generatedAt,
            confirmedAt: new Date().toISOString(),
            zoneOpmcMap: Object.fromEntries(Object.entries(zoneOpmcMap).map(([zid, bid]) => [String(zid), bid])),
            hotspots: hotspots.map(h => ({
                date: h.date, shift: h.shift, zoneId: h.zoneId, zoneName: h.zoneName,
                predictedFaultCount: h.predictedFaultCount,
                ...planByKey[hotspotKey(h)],
            })),
        };
        console.log('[Resource Planning] Confirm requested:', payload);
        setConfirming(true);
        try {
            const result = await fieldopsReq('POST', '/api/resource-plans/confirm', payload);
            setConfirmed({ payload, result });
            const skipNote = result.skippedCount ? `, ${result.skippedCount} skipped` : '';
            notify(`Plan confirmed — ${result.confirmedCount} hotspot(s) saved${skipNote}. Team Leads will see this as a BOD starting point.`, result.confirmedCount > 0 ? 'success' : 'error');
        } catch (e) {
            console.error('confirm-plan', e);
            notify(`Confirm failed: ${e.message}`, 'error');
        } finally {
            setConfirming(false);
        }
    };

    return (
        <div className="ai-page" style={{ background:A.bg, minHeight:'100vh', padding:'28px 32px', fontFamily:'system-ui,sans-serif' }}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:16 }}>
                <div>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:4 }}>
                        <h1 style={{ margin:0, fontSize:24, fontWeight:900, color:A.neon, fontFamily:'Orbitron,sans-serif', letterSpacing:1, textShadow:`0 0 20px ${A.neon}55` }}>
                            Resource Planning
                        </h1>
                        <StatusDot online={online}/>
                    </div>
                    <div style={{ fontSize:11, color:A.muted }}>
                        Predicted hotspots (date · shift · zone) with suggested Technician/Vehicle/Material quantities — advisory only (SRS 5.6.8)
                    </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <div style={{ display:'flex', border:`1px solid ${A.border}`, borderRadius:8, overflow:'hidden' }}>
                        {HORIZONS.map(h => (
                            <button key={h} onClick={() => setHorizon(h)} disabled={loading}
                                    style={{ padding:'6px 14px', border:'none', cursor:loading?'default':'pointer', fontSize:10, fontWeight:800, fontFamily:'Orbitron,sans-serif', background:horizon===h?A.neon:A.panel, color:horizon===h?A.bg:A.muted, transition:'all 0.12s' }}>
                                {h}D
                            </button>
                        ))}
                    </div>
                    {online && (
                        <button onClick={load} disabled={loading} style={{ padding:'8px 16px', borderRadius:8, border:`1.5px solid ${A.neon}44`, background:A.neonL, color:A.neon, cursor:loading?'default':'pointer', fontSize:11, fontWeight:700, fontFamily:'Orbitron,sans-serif', opacity:loading?0.6:1 }}>
                            {loading ? '⏳ …' : '↻ REFRESH'}
                        </button>
                    )}
                </div>
            </div>

            {/* Offline */}
            {online === false && (
                <div style={{ background:A.panel, borderRadius:14, padding:'40px 32px', textAlign:'center', border:`2px solid ${A.pink}44` }}>
                    <div style={{ fontSize:52, marginBottom:16 }}>🤖</div>
                    <div style={{ fontSize:20, fontWeight:900, color:A.pink, fontFamily:'Orbitron,sans-serif', letterSpacing:1, marginBottom:10 }}>AI MODULE OFFLINE</div>
                    <button onClick={check} style={{ padding:'10px 24px', borderRadius:8, cursor:'pointer', background:A.neonL, border:`1.5px solid ${A.neon}55`, color:A.neon, fontSize:12, fontWeight:800, fontFamily:'Orbitron,sans-serif' }}>⟳ RETRY</button>
                </div>
            )}

            {/* Initial load skeleton */}
            {online && loading && !raw && (
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    <Skel h={90} r={14}/>
                    <Skel h={340} r={14}/>
                </div>
            )}

            {/* Insufficient history */}
            {online && raw?.insufficientData && (
                <InsufficientHistory historyDays={raw.historyDays} requiredDays={raw.requiredDays}/>
            )}

            {/* Normal state */}
            {online && raw && !raw.insufficientData && (
                <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

                    {/* Summary strip */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12 }}>
                        {[
                            { l:'Hotspots',    v:totals.hotspots,        c:A.neon   },
                            { l:'Technicians', v:totals.technicians,     c:A.blue   },
                            { l:'Vehicles',    v:totals.vehicles,        c:A.violet },
                            { l:'Horizon',     v:`${raw.horizonDays}d`,  c:A.amber  },
                        ].map((s,i) => (
                            <div key={i} style={{ padding:'12px 14px', borderRadius:10, background:A.panel, border:`1px solid ${s.c}33` }}>
                                <div style={{ fontSize:20, fontWeight:900, color:s.c, fontFamily:'Orbitron,sans-serif' }}>{s.v}</div>
                                <div style={{ fontSize:10, color:A.muted, marginTop:2 }}>{s.l}</div>
                            </div>
                        ))}
                    </div>

                    <ShortfallsCard shortfalls={raw.materialShortfalls}/>

                    <AiCard title="Predicted Hotspots" subtitle={`GET /api/ai/resource-plan?horizon=${horizon} — sorted by predicted fault count`} icon="🧰" accent={A.neon} badge={`${filtered.length} SHOWN`}>
                        {/* Filters */}
                        <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
                            <select value={zoneFilter} onChange={e => setZoneFilter(e.target.value)} style={selectStyle}>
                                <option value="ALL">All zones</option>
                                {zoneOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                            </select>
                            <select value={shiftFilter} onChange={e => setShiftFilter(e.target.value)} style={selectStyle}>
                                <option value="ALL">All shifts</option>
                                {shiftIds.map(s => <option key={s} value={s}>{SHIFT_CFG[s]?.label || s}</option>)}
                            </select>
                        </div>

                        <div style={{ overflowX:'auto', maxHeight:480, overflowY:'auto', border:`1px solid ${A.border}`, borderRadius:10 }}>
                            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:720 }}>
                                <thead>
                                    <tr style={{ background:A.surface, position:'sticky', top:0 }}>
                                        {['Date','Shift','Zone','Predicted','Technicians','Vehicles','Materials'].map(h => (
                                            <th key={h} style={{ padding:'10px 12px', textAlign: h==='Predicted' ? 'right' : (h==='Technicians'||h==='Vehicles' ? 'center' : 'left'), fontSize:10, color:A.muted, fontWeight:800, textTransform:'uppercase', letterSpacing:0.5 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(h => {
                                        const plan = planByKey[hotspotKey(h)];
                                        if (!plan) return null;
                                        return (
                                            <HotspotRow key={hotspotKey(h)} h={h} plan={plan} shortfallIds={shortfallIds}
                                                        onEditTech={editTech} onEditVeh={editVeh} onEditMaterial={editMat}/>
                                        );
                                    })}
                                    {filtered.length === 0 && (
                                        <tr><td colSpan={7} style={{ padding:20, textAlign:'center', color:A.muted, fontSize:12 }}>No hotspots match the current filters.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </AiCard>

                    <ZoneOpmcMapCard
                        zoneOptions={zoneOptions} opmcs={opmcs} loadingOpmcs={loadingOpmcs}
                        zoneOpmcMap={zoneOpmcMap} onChange={setZoneOpmc}
                    />

                    {/* Confirm */}
                    <AiCard title="Confirm Plan" subtitle="Persists to fieldops so the Team Lead's BOD screen can read it as a starting point" icon="✅" accent={A.neon} badge="ADVISORY ONLY">
                        <div style={{ fontSize:11, color:A.muted, marginBottom:14, lineHeight:1.6 }}>
                            Adjust any Technician, Vehicle, or Material quantity above, assign every zone to an OPMC,
                            then confirm. Per SRS 5.6.8 this stays advisory — the Team Lead sees these numbers as an
                            adjustable starting point on their BOD screen, never a locked/forced value.
                        </div>
                        {!allZonesMapped && zoneOptions.length > 0 && (
                            <div style={{ padding:'8px 12px', borderRadius:8, background:A.pinkL, border:`1px solid ${A.pink}44`, color:A.pink, fontSize:11, marginBottom:12 }}>
                                ⚠️ Assign an OPMC to every zone above before confirming.
                            </div>
                        )}
                        <button
                            onClick={handleConfirm}
                            disabled={!allZonesMapped || confirming}
                            style={{ padding:'10px 22px', borderRadius:8, border:`1.5px solid ${A.neon}`, background:A.neonL, color:A.neon, cursor:(!allZonesMapped||confirming)?'default':'pointer', fontSize:12, fontWeight:800, fontFamily:'Orbitron,sans-serif', opacity:(!allZonesMapped||confirming)?0.5:1 }}
                        >
                            {confirming ? '⏳ CONFIRMING…' : '✓ CONFIRM PLAN'}
                        </button>

                        {confirmed && (
                            <div style={{ marginTop:16 }}>
                                <div style={{ fontSize:11, fontWeight:800, color:A.neon, marginBottom:6 }}>
                                    LAST CONFIRMED — {confirmed.result.confirmedCount} saved
                                    {confirmed.result.skippedCount ? `, ${confirmed.result.skippedCount} skipped` : ''}
                                </div>
                                {confirmed.result.skippedReasons?.length > 0 && (
                                    <div style={{ fontSize:10, color:A.amber, marginBottom:8, lineHeight:1.6 }}>
                                        {confirmed.result.skippedReasons.map((r,i) => <div key={i}>⚠️ {r}</div>)}
                                    </div>
                                )}
                                <pre style={{ maxHeight:220, overflow:'auto', padding:'12px 14px', borderRadius:8, background:A.surface, border:`1px solid ${A.border}`, fontSize:10, color:A.text, fontFamily:'monospace', whiteSpace:'pre-wrap' }}>
                                    {JSON.stringify(confirmed.payload, null, 2)}
                                </pre>
                            </div>
                        )}
                    </AiCard>
                </div>
            )}

            <AiToast toast={toast} onClose={() => setToast(null)}/>
        </div>
    );
}
