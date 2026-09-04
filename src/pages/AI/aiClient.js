// src/pages/AI/aiClient.js — shared Flask AI-service client + palette + chrome
// ============================================================================
// Extracted from AIDashboardPage.js (Stage D) so ModelTrainingPage.js doesn't
// duplicate the auth/fetch/envelope-unwrapping logic, the dark "deep space"
// visual language, or the card/skeleton/status chrome — both pages talk to
// the same Flask service and belong to the same AI section of the portal.

import React from 'react';

export const AI  = process.env.REACT_APP_AI_URL || 'http://localhost:5000';
export const tok = () => localStorage.getItem('accessToken');

// The Flask AI service wraps most responses as {success, data, message};
// /api/ai/health is the one exception and returns a flat object. Unwrap
// the envelope here, once, so every caller can just read fields directly
// off the result.
export const unwrap = body => (body && body.success === true && 'data' in body) ? body.data : body;

export const aiReq = path =>
    fetch(`${AI}${path}`, { headers: { Authorization: `Bearer ${tok()}` } })
        .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
        .then(unwrap);

export const aiUpload = (path, file) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${AI}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}` },
        body: form,
    }).then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error || `${r.status}`);
        return unwrap(data);
    });
};

// JSON POST — used by the Stage B model-versions activate/rollback calls
// and (via ModelTrainingPage) anywhere else a plain JSON body is needed.
export const aiPostJson = (path, body) =>
    fetch(`${AI}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
    }).then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error || `${r.status}`);
        return unwrap(data);
    });

// ─── Deep space AI palette ────────────────────────────────────────────────────
export const A = {
    bg:'#070B14', panel:'#0C1220', surface:'#101828', lift:'#162034',
    border:'#1E2E44', b2:'#162030',
    text:'#C8E0FF', muted:'#3A5570', dim:'#263848',
    neon:'#00FFD1', neonD:'#00A880', neonL:'#00201A',
    pink:'#FF2D78', pinkL:'#1E0014',
    blue:'#1E90FF', blueL:'#001428',
    amber:'#FFB020', amberL:'#1E1600',
    violet:'#9B59F5', violetL:'#120A28',
    white:'#FFFFFF',
};

// ─── Shared chrome ─────────────────────────────────────────────────────────────
export const Skel = ({h=14,w='100%',r=6}) => (
    <div style={{height:h,width:w,borderRadius:r,background:`linear-gradient(90deg,${A.surface} 25%,${A.lift} 50%,${A.surface} 75%)`,backgroundSize:'400% 100%',animation:'ai-shim 1.5s ease infinite'}}/>
);

export const StatusDot = ({ online }) => (
    <span style={{
        display:'inline-flex', alignItems:'center', gap:5,
        padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:800,
        background: online ? A.neonL : '#1A0810',
        border:`1px solid ${online ? A.neon : A.pink}44`,
        color: online ? A.neon : A.pink,
    }}>
    <span style={{
        width:6, height:6, borderRadius:'50%',
        background: online ? A.neon : A.pink,
        boxShadow: online ? `0 0 8px ${A.neon}` : 'none',
        animation: online ? 'ai-pulse 2s ease infinite' : 'none',
    }}/>
        {online ? 'AI Online' : 'AI Offline'}
  </span>
);

export const AiCard = ({ title, subtitle, icon, accent=A.neon, badge, children }) => (
    <div style={{ background:A.panel, borderRadius:14, border:`1px solid ${accent}33`, overflow:'hidden', boxShadow:`0 4px 24px ${accent}06` }}>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${A.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:`linear-gradient(135deg,${accent}08,transparent)` }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:38, height:38, borderRadius:10, flexShrink:0, background:`${accent}18`, border:`1px solid ${accent}33`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{icon}</div>
                <div>
                    <div style={{ fontSize:14, fontWeight:800, color:A.text, fontFamily:'Orbitron,sans-serif', letterSpacing:0.5 }}>{title}</div>
                    {subtitle && <div style={{ fontSize:11, color:A.muted, marginTop:2 }}>{subtitle}</div>}
                </div>
            </div>
            {badge && <div style={{ fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:4, background:`${accent}18`, color:accent, border:`1px solid ${accent}44` }}>{badge}</div>}
        </div>
        <div style={{ padding:'18px 20px' }}>{children}</div>
    </div>
);

// Toast — same inline convention every page in this app uses (no shared Toast
// component exists app-wide); kept here once so both AI pages render it
// identically instead of each re-implementing the box.
export const AiToast = ({ toast, onClose }) => {
    if (!toast) return null;
    return (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:3000, background:A.panel, border:`2px solid ${toast.type==='error'?A.pink:A.neon}`, borderRadius:10, padding:'10px 18px', fontSize:12, color:A.text, display:'flex', alignItems:'center', gap:10, animation:'ai-toastin 0.22s ease', fontFamily:'monospace', maxWidth:360 }}>
            <span>{toast.type==='error'?'❌':'✅'}</span>
            <span style={{ flex:1 }}>{toast.msg}</span>
            <button onClick={onClose} style={{ background:'none', border:'none', color:A.muted, cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 2px' }}>×</button>
        </div>
    );
};

// One-time CSS injection (fonts, keyframes) shared by both AI pages — guarded
// by element id so whichever page mounts first wins and the other no-ops.
export function injectAiStyles() {
    const id = 'ai-css';
    if (document.getElementById(id)) return;
    const s = document.createElement('style'); s.id = id;
    s.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
      @keyframes ai-shim{0%{background-position:200% 0}100%{background-position:-200% 0}}
      @keyframes ai-fin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      @keyframes ai-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.4)}}
      @keyframes ai-toastin{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
      .ai-page *{box-sizing:border-box;}
      ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:${A.bg}}
      ::-webkit-scrollbar-thumb{background:${A.border};border-radius:4px}
    `;
    document.head.appendChild(s);
}
