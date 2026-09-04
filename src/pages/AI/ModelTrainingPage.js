import React, { useState, useEffect, useCallback, useRef } from 'react';
import { aiReq, aiUpload, aiPostJson, A, Skel, StatusDot, AiCard, AiToast, injectAiStyles } from './aiClient';

// ─── SRS 5.6.7 — CSV Model Training panel ──────────────────────────────────────
// Own page (not a tab under Reports): upload a CSV -> POST /api/ai/train ->
// poll GET /api/ai/train/status/{jobId} -> on completion, show both models'
// candidate + comparison data and require an explicit "Activate Model" per
// model before anything goes live, with rollback available.

const STEPS = [
    { key:'queued',        label:'Queued' },
    { key:'preprocessing', label:'Preprocessing' },
    { key:'training',      label:'Training' },
    { key:'complete',      label:'Complete' },
];

const MODELS = [
    { key:'forecaster', label:'Forecasting Model', icon:'📈', accent:A.blue,
      metricKeys:[
          { k:'mae',      label:'MAE',      lowerBetter:true  },
          { k:'rmse',     label:'RMSE',     lowerBetter:true  },
          { k:'accuracy', label:'Accuracy', lowerBetter:false, suffix:'%' },
      ] },
    { key:'clusterer', label:'Clustering Model', icon:'🗺️', accent:A.violet,
      metricKeys:[
          { k:'inertia',         label:'Inertia',         lowerBetter:true  },
          { k:'silhouetteScore', label:'Silhouette',      lowerBetter:false },
      ] },
];

// ─── Progress stepper ──────────────────────────────────────────────────────────
function ProgressSteps({ status }) {
    const failed = status === 'failed';
    const currentIdx = failed ? STEPS.length : STEPS.findIndex(s => s.key === status);
    return (
        <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:4 }}>
            {STEPS.map((s, i) => {
                const done   = !failed && i < currentIdx;
                const active = !failed && i === currentIdx;
                const col    = failed ? A.pink : (done || active) ? A.neon : A.muted;
                return (
                    <React.Fragment key={s.key}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, minWidth:80 }}>
                            <div style={{
                                width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                                background: (done||active) ? `${col}18` : A.surface,
                                border:`1.5px solid ${col}`,
                                color:col, fontSize:11, fontWeight:800,
                                boxShadow: active ? `0 0 10px ${col}88` : 'none',
                                animation: active ? 'ai-pulse 1.6s ease infinite' : 'none',
                            }}>
                                {done ? '✓' : i+1}
                            </div>
                            <span style={{ fontSize:10, fontWeight:active?800:600, color:col, fontFamily:'monospace', textAlign:'center' }}>{s.label}</span>
                        </div>
                        {i < STEPS.length-1 && (
                            <div style={{ flex:1, height:2, background: (!failed && i < currentIdx) ? A.neon : A.border, marginBottom:18 }}/>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// ─── Upload form ────────────────────────────────────────────────────────────────
function UploadForm({ busy, onStart, error }) {
    const [file, setFile] = useState(null);
    const inputRef = useRef(null);

    const submit = () => {
        if (!file) return;
        onStart(file);
        setFile(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div>
            <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".csv"
                    disabled={busy}
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    style={{ fontSize:11, color:A.text, flex:1, minWidth:200, opacity:busy?0.5:1 }}
                />
                <button onClick={submit} disabled={!file || busy}
                        style={{ padding:'9px 20px', borderRadius:8, border:`1.5px solid ${A.violet}`, background:A.violetL, color:A.violet, cursor:(!file||busy)?'default':'pointer', fontSize:11, fontWeight:800, fontFamily:'Orbitron,sans-serif', opacity:(!file||busy)?0.5:1 }}>
                    {busy ? '⏳ TRAINING…' : '▶ START TRAINING'}
                </button>
            </div>
            <div style={{ padding:'8px 12px', borderRadius:8, background:A.surface, border:`1px solid ${A.border}`, marginBottom:14, fontSize:11, color:A.muted, lineHeight:1.6 }}>
                Expected columns: <code style={{ color:A.text }}>date</code> (required),{' '}
                <code style={{ color:A.text }}>latitude, longitude</code> (for clustering),{' '}
                <code style={{ color:A.text }}>category</code> (optional). One row per historical fault.
                Data older than 24 months is automatically excluded (SRS 5.6.7).
            </div>
            {error && (
                <div style={{ padding:'10px 14px', borderRadius:8, background:A.pinkL, border:`1px solid ${A.pink}66`, color:A.pink, fontSize:12, marginBottom:12 }}>
                    ⚠️ {error}
                </div>
            )}
        </div>
    );
}

// ─── Upload summary (Stage A validation results) ───────────────────────────────
function UploadSummary({ s }) {
    if (!s) return null;
    const skipped = s.skippedRows || {};
    const hasSkips = (skipped.badDates||0) > 0 || (skipped.badGps||0) > 0 || (skipped.tooOld||0) > 0;
    return (
        <div style={{ padding:'12px 14px', borderRadius:10, background:A.surface, border:`1px solid ${A.violet}44`, marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:800, color:A.violet, marginBottom:8 }}>UPLOAD SUMMARY</div>
            <div style={{ fontSize:12, color:A.text, marginBottom:6 }}>
                {s.rowCount} rows ingested · effective range {s.dateRange?.from} → {s.dateRange?.to}
                {s.maxTrainingWindowMonths && ` (capped at ${s.maxTrainingWindowMonths} months)`}
            </div>
            {hasSkips && (
                <div style={{ fontSize:10, color:A.amber, marginBottom:4 }}>
                    Excluded rows —{' '}
                    {skipped.tooOld > 0 && `${skipped.tooOld} too old`}
                    {skipped.badDates > 0 && `${skipped.tooOld>0?', ':''}${skipped.badDates} unparseable date`}
                    {skipped.badGps > 0 && `${(skipped.tooOld>0||skipped.badDates>0)?', ':''}${skipped.badGps} bad GPS`}
                </div>
            )}
            <div style={{ fontSize:10, color:A.muted }}>
                {s.usableForForecasting ? '✅ usable for forecasting' : '—'}
                {'  ·  '}
                {s.usableForClustering ? '✅ usable for clustering' : '⚠️ no GPS columns — clustering unavailable'}
            </div>
        </div>
    );
}

// ─── Metric comparison row ──────────────────────────────────────────────────────
function ComparisonRow({ label, delta, suffix='' }) {
    if (!delta) {
        return (
            <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px solid ${A.border}`, fontSize:11 }}>
                <span style={{ color:A.muted }}>{label}</span>
                <span style={{ color:A.muted }}>—</span>
            </div>
        );
    }
    const col = delta.improved ? A.neon : (delta.change === 0 ? A.muted : A.pink);
    const arrow = delta.change === 0 ? '=' : (delta.improved ? '▲' : '▼');
    return (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:`1px solid ${A.border}`, fontSize:11 }}>
            <span style={{ color:A.muted }}>{label}</span>
            <span style={{ fontFamily:'monospace' }}>
                <span style={{ color:A.text }}>{delta.previous}{suffix}</span>
                <span style={{ color:A.muted, margin:'0 6px' }}>→</span>
                <span style={{ color:A.text, fontWeight:800 }}>{delta.candidate}{suffix}</span>
                <span style={{ color:col, marginLeft:8, fontWeight:800 }}>{arrow} {Math.abs(delta.change)}{suffix}</span>
            </span>
        </div>
    );
}

// ─── One model's candidate result + Activate button ────────────────────────────
function ModelResultCard({ cfg, result, onActivate, activating }) {
    if (!result) return null;

    if (result.status === 'error') {
        return (
            <AiCard title={cfg.label} icon={cfg.icon} accent={A.pink} badge="ERROR">
                <div style={{ fontSize:12, color:A.pink }}>⚠️ {result.message}</div>
            </AiCard>
        );
    }

    const comparison = result.comparison || {};
    const metrics = cfg.key === 'clusterer' ? (result.metrics || {}) : result;

    return (
        <AiCard title={cfg.label} icon={cfg.icon} accent={cfg.accent} badge={`CANDIDATE v${result.versionId}`}>
            {comparison.note && (
                <div style={{ fontSize:11, color:A.muted, marginBottom:10, fontStyle:'italic' }}>{comparison.note}</div>
            )}
            <div style={{ marginBottom:14 }}>
                {cfg.metricKeys.map(m => (
                    <ComparisonRow key={m.k} label={m.label} delta={comparison.delta?.[m.k]} suffix={m.suffix||''}/>
                ))}
                {!comparison.delta && cfg.metricKeys.map(m => (
                    <div key={m.k} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px solid ${A.border}`, fontSize:11 }}>
                        <span style={{ color:A.muted }}>{m.label}</span>
                        <span style={{ color:A.text, fontFamily:'monospace' }}>{metrics[m.k]}{m.suffix||''}</span>
                    </div>
                ))}
            </div>
            <button
                onClick={() => onActivate(cfg.key, result.versionId)}
                disabled={activating}
                style={{ width:'100%', padding:'10px 0', borderRadius:8, border:`1.5px solid ${cfg.accent}`, background:`${cfg.accent}18`, color:cfg.accent, cursor:activating?'default':'pointer', fontSize:11, fontWeight:800, fontFamily:'Orbitron,sans-serif', opacity:activating?0.5:1 }}
            >
                {activating ? '⏳ ACTIVATING…' : `✓ ACTIVATE MODEL (v${result.versionId})`}
            </button>
        </AiCard>
    );
}

// ─── Version history + rollback, per model ─────────────────────────────────────
function VersionHistoryCard({ cfg, versions, onRollback, rollingBack }) {
    const active   = (versions||[]).find(v => v.status === 'active');
    const archived = (versions||[]).filter(v => v.status === 'archived');
    const canRollback = archived.length > 0;

    return (
        <AiCard title={`${cfg.label} — Version History`} icon="🕓" accent={cfg.accent}>
            {active ? (
                <div style={{ padding:'10px 12px', borderRadius:8, background:A.surface, border:`1px solid ${A.neon}44`, marginBottom:12 }}>
                    <div style={{ fontSize:10, fontWeight:800, color:A.neon, marginBottom:4 }}>ACTIVE — v{active.versionId}</div>
                    <div style={{ fontSize:10, color:A.muted }}>{active.createdAt?.slice(0,10)}</div>
                </div>
            ) : (
                <div style={{ fontSize:11, color:A.muted, marginBottom:12 }}>No active version yet.</div>
            )}

            {(versions||[]).length > 0 && (
                <div style={{ marginBottom:12, maxHeight:140, overflowY:'auto' }}>
                    {versions.slice(0, 6).map(v => (
                        <div key={v.versionId} style={{ display:'flex', justifyContent:'space-between', fontSize:10, padding:'4px 0', borderBottom:`1px solid ${A.border}`, color:A.muted }}>
                            <span>v{v.versionId} <span style={{ color: v.status==='active'?A.neon:(v.status==='candidate'?A.amber:A.muted) }}>({v.status})</span></span>
                            <span>{v.createdAt?.slice(0,10)}</span>
                        </div>
                    ))}
                </div>
            )}

            <button
                onClick={() => onRollback(cfg.key)}
                disabled={!canRollback || rollingBack}
                style={{ width:'100%', padding:'9px 0', borderRadius:8, border:`1.5px solid ${A.amber}`, background:canRollback?A.amberL:A.surface, color:canRollback?A.amber:A.muted, cursor:(canRollback&&!rollingBack)?'pointer':'default', fontSize:11, fontWeight:800, fontFamily:'Orbitron,sans-serif', opacity:(canRollback&&!rollingBack)?1:0.5 }}
            >
                {rollingBack ? '⏳ ROLLING BACK…' : '↩ ROLLBACK TO PREVIOUS'}
            </button>
        </AiCard>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function ModelTrainingPage() {
    const [online,  setOnline]  = useState(null);
    const [busy,     setBusy]     = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [job,      setJob]      = useState(null);
    const [versions,  setVersions] = useState({ forecaster:[], clusterer:[] });
    const [activating, setActivating] = useState(null); // model key currently activating
    const [rollingBack, setRollingBack] = useState(null); // model key currently rolling back
    const [toast,    setToast]    = useState(null);

    const notify = useCallback((msg, type='success') => setToast({msg, type}), []);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3200);
        return () => clearTimeout(t);
    }, [toast]);

    useEffect(() => { injectAiStyles(); }, []);

    const check = useCallback(async () => {
        try { await aiReq('/api/ai/health'); setOnline(true); }
        catch { setOnline(false); }
    }, []);

    const refreshVersions = useCallback(async (modelKey) => {
        try {
            const d = await aiReq(`/api/ai/model-versions/${modelKey}`);
            setVersions(v => ({ ...v, [modelKey]: d.versions || [] }));
        } catch (e) { console.error(`versions:${modelKey}`, e); }
    }, []);

    useEffect(() => { check(); }, [check]);
    useEffect(() => {
        if (!online) return;
        MODELS.forEach(m => refreshVersions(m.key));
    }, [online, refreshVersions]);

    // ── Start training ──────────────────────────────────────────────────────────
    const handleStart = async (file) => {
        setUploadError(null);
        setBusy(true);
        try {
            const started = await aiUpload('/api/ai/train', file);
            setJob(started); // { jobId, status:'queued', uploadSummary }
        } catch (e) {
            setUploadError(e.message);
            setBusy(false);
        }
    };

    // ── Poll job status until terminal ──────────────────────────────────────────
    useEffect(() => {
        if (!job?.jobId) return;
        if (job.status === 'complete' || job.status === 'failed') {
            setBusy(false);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const updated = await aiReq(`/api/ai/train/status/${job.jobId}`);
                if (!cancelled) setJob(updated);
            } catch (e) {
                if (!cancelled) { notify(`Status check failed: ${e.message}`, 'error'); setBusy(false); }
            }
        }, 1000);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [job, notify]);

    useEffect(() => {
        if (job?.status === 'complete') {
            MODELS.forEach(m => refreshVersions(m.key));
        }
    }, [job?.status, refreshVersions]);

    // ── Activate / rollback ──────────────────────────────────────────────────────
    const handleActivate = async (modelKey, versionId) => {
        setActivating(modelKey);
        try {
            await aiPostJson(`/api/ai/model-versions/${modelKey}/activate`, { versionId });
            notify(`${modelKey === 'forecaster' ? 'Forecasting' : 'Clustering'} model v${versionId} activated`, 'success');
            await refreshVersions(modelKey);
        } catch (e) {
            notify(`Activate failed: ${e.message}`, 'error');
        } finally {
            setActivating(null);
        }
    };

    const handleRollback = async (modelKey) => {
        setRollingBack(modelKey);
        try {
            const entry = await aiPostJson(`/api/ai/model-versions/${modelKey}/rollback`, {});
            notify(`Rolled back to v${entry.versionId}`, 'success');
            await refreshVersions(modelKey);
        } catch (e) {
            notify(`Rollback failed: ${e.message}`, 'error');
        } finally {
            setRollingBack(null);
        }
    };

    const jobInProgress = job && job.status !== 'complete' && job.status !== 'failed';

    return (
        <div className="ai-page" style={{ background:A.bg, minHeight:'100vh', padding:'28px 32px', fontFamily:'system-ui,sans-serif' }}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28 }}>
                <div>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:4 }}>
                        <h1 style={{ margin:0, fontSize:24, fontWeight:900, color:A.neon, fontFamily:'Orbitron,sans-serif', letterSpacing:1, textShadow:`0 0 20px ${A.neon}55` }}>
                            Model Training
                        </h1>
                        <StatusDot online={online}/>
                    </div>
                    <div style={{ fontSize:11, color:A.muted }}>
                        Upload historical fault data to retrain the Prophet forecaster and K-Means clusterer (SRS 5.6.7)
                    </div>
                </div>
            </div>

            {online === false && (
                <div style={{ background:A.panel, borderRadius:14, padding:'40px 32px', textAlign:'center', border:`2px solid ${A.pink}44` }}>
                    <div style={{ fontSize:52, marginBottom:16 }}>🤖</div>
                    <div style={{ fontSize:20, fontWeight:900, color:A.pink, fontFamily:'Orbitron,sans-serif', marginBottom:10 }}>AI MODULE OFFLINE</div>
                    <button onClick={check} style={{ padding:'10px 24px', borderRadius:8, cursor:'pointer', background:A.neonL, border:`1.5px solid ${A.neon}55`, color:A.neon, fontSize:12, fontWeight:800, fontFamily:'Orbitron,sans-serif' }}>⟳ RETRY</button>
                </div>
            )}

            {online && (
                <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

                    <AiCard title="Upload Training Data" subtitle="POST /api/ai/train — retrains both models asynchronously" icon="📁" accent={A.violet} badge="CSV UPLOAD">
                        <UploadForm busy={busy} onStart={handleStart} error={uploadError}/>

                        {job && (
                            <div style={{ marginTop:8 }}>
                                <ProgressSteps status={job.status}/>
                                {job.status === 'failed' && (
                                    <div style={{ padding:'10px 14px', borderRadius:8, background:A.pinkL, border:`1px solid ${A.pink}66`, color:A.pink, fontSize:12, marginTop:8 }}>
                                        ⚠️ Job failed: {job.error}
                                    </div>
                                )}
                                {jobInProgress && (
                                    <div style={{ fontSize:11, color:A.muted, marginTop:4 }}>Job {job.jobId?.slice(0,8)}… — {job.status}</div>
                                )}
                            </div>
                        )}
                    </AiCard>

                    {job?.uploadSummary && <UploadSummary s={job.uploadSummary}/>}

                    {job?.status === 'complete' && job.result && (
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(340px,1fr))', gap:20 }}>
                            {MODELS.map(cfg => (
                                <ModelResultCard
                                    key={cfg.key}
                                    cfg={cfg}
                                    result={job.result[cfg.key]}
                                    onActivate={handleActivate}
                                    activating={activating === cfg.key}
                                />
                            ))}
                        </div>
                    )}

                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
                        {MODELS.map(cfg => (
                            <VersionHistoryCard
                                key={cfg.key}
                                cfg={cfg}
                                versions={versions[cfg.key]}
                                onRollback={handleRollback}
                                rollingBack={rollingBack === cfg.key}
                            />
                        ))}
                    </div>
                </div>
            )}

            <AiToast toast={toast} onClose={() => setToast(null)}/>
        </div>
    );
}
