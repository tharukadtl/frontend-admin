import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const tok = () => localStorage.getItem('accessToken');
const req = (method, path, body) =>
    fetch(`${API}${path}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: body ? JSON.stringify(body) : undefined,
    }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });
const get  = p      => req('GET',  p);
const post = (p, b) => req('POST', p, b);
const put  = (p, b) => req('PUT',  p, b);

// The 9 real Opmc.Province enum values (fieldops backend) — a controlled list, not free text,
// so a value sent here always resolves cleanly server-side (no ambiguous/unparseable input possible).
const PROVINCES = [
  { value:'WESTERN',        label:'Western' },
  { value:'CENTRAL',        label:'Central' },
  { value:'SOUTHERN',       label:'Southern' },
  { value:'NORTHERN',       label:'Northern' },
  { value:'EASTERN',        label:'Eastern' },
  { value:'NORTH_WESTERN',  label:'North Western' },
  { value:'NORTH_CENTRAL',  label:'North Central' },
  { value:'UVA',            label:'Uva' },
  { value:'SABARAGAMUWA',   label:'Sabaragamuwa' },
];
const provinceLabel = v => PROVINCES.find(p => p.value === v)?.label || v || '';

const B = {
  bg:'#FAFAF7', surface:'#FFFFFF', s2:'#F4F2EC', border:'#D6D2C4', b2:'#E8E5DA',
  text:'#1C1C14', muted:'#666058', dim:'#A8A398',
  forest:'#1A4A2E', forestL:'#E8F2EB', forestD:'#0F3020',
  clay:'#8B4513', clayL:'#F5EBE0',
  slate:'#2C3E50', slateL:'#EBF0F5',
  sky:'#0077AA', skyL:'#E0F4FF',
  gold:'#8B6914', goldL:'#FFF8E0',
  green:'#15803D', greenL:'#DCFCE7',
  red:'#DC2626', redL:'#FEE2E2',
  white:'#FFFFFF',
};

const Skel = ({h=14,w='100%',r=6}) => (
    <div style={{height:h,width:w,borderRadius:r,background:`linear-gradient(90deg,${B.s2} 25%,${B.border} 50%,${B.s2} 75%)`,backgroundSize:'400% 100%',animation:'opmc-shim 1.5s ease infinite'}}/>
);

const Toast = ({msg,type,onDone}) => {
  useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t);},[onDone]);
  return <div style={{position:'fixed',bottom:24,right:24,zIndex:3000,background:B.surface,border:`2px solid ${type==='success'?B.forest:B.red}`,borderRadius:10,padding:'10px 18px',display:'flex',alignItems:'center',gap:8,fontSize:13,color:B.text,boxShadow:'0 4px 20px rgba(0,0,0,0.1)',animation:'opmc-fin 0.2s ease'}}>{type==='success'?'✅':'❌'} {msg}</div>;
};

// ─── OPMC Form Modal ──────────────────────────────────────────────────────────
function OpmcModal({ opmc, open, onClose, onSuccess }) {
  const isEdit = !!opmc;
  const init = { name:'', code:'', address:'', province:'', phone:'', email:'' };
  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(isEdit ? {
      name:opmc.name||'', code:opmc.code||'',
      address:opmc.address||'', province:opmc.province||'',
      phone:opmc.phone||'', email:opmc.email||'',
    } : init);
  }, [open, opmc]);

  useEffect(() => {
    const fn = e => e.key==='Escape' && onClose();
    if (open) document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open, onClose]);

  if (!open) return null;
  const f = k => v => setForm(p => ({ ...p, [k]:v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (isEdit) await put(`/api/opmcs/${opmc.id}`, form);
      else await post('/api/opmcs', form);
      onSuccess(isEdit ? 'OPMC updated' : 'OPMC created', 'success');
      onClose();
    } catch { onSuccess('Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const inp = (label, key, placeholder, type='text', full=false) => (
      <div style={{ gridColumn: full ? '1/-1' : undefined }}>
        <div style={{ fontSize:10, fontWeight:800, color:B.muted, letterSpacing:0.6, textTransform:'uppercase', marginBottom:4 }}>{label}</div>
        <input type={type} value={form[key]} onChange={e => f(key)(e.target.value)} placeholder={placeholder}
               style={{ width:'100%', background:B.s2, border:`1.5px solid ${B.border}`, borderRadius:8, padding:'9px 12px', fontSize:12, color:B.text, outline:'none', transition:'border-color 0.13s' }}
               onFocus={e=>e.target.style.borderColor=B.forest} onBlur={e=>e.target.style.borderColor=B.border}
        />
      </div>
  );

  // Controlled dropdown, not free text — a value picked here always resolves cleanly on the
  // backend (Opmc.Province.valueOf() on an exact enum token), unlike the free-text "Region" field
  // this replaced, which could silently save as no-province on anything that wasn't an exact match
  // (including the field's own former placeholder text, "Western Province").
  const provinceSelect = () => (
      <div>
        <div style={{ fontSize:10, fontWeight:800, color:B.muted, letterSpacing:0.6, textTransform:'uppercase', marginBottom:4 }}>Province</div>
        <select value={form.province} onChange={e => f('province')(e.target.value)}
                style={{ width:'100%', background:B.s2, border:`1.5px solid ${B.border}`, borderRadius:8, padding:'9px 12px', fontSize:12, color:B.text, outline:'none', transition:'border-color 0.13s' }}
                onFocus={e=>e.target.style.borderColor=B.forest} onBlur={e=>e.target.style.borderColor=B.border}
        >
          <option value="">— Select Province —</option>
          {PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
  );

  return (
      <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(28,28,20,0.55)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24,animation:'opmc-fin 0.18s ease'}}>
        <div style={{background:B.surface,borderRadius:16,width:'100%',maxWidth:520,border:`1px solid ${B.border}`,boxShadow:'0 20px 60px rgba(0,0,0,0.15)',animation:'opmc-sld 0.2s ease'}}>
          <div style={{padding:'18px 22px 14px',borderBottom:`1px solid ${B.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:16,fontWeight:800,color:B.text}}>{isEdit?`Edit — ${opmc.name}`:'Add New OPMC'}</div>
            <button onClick={onClose} style={{background:'none',border:'none',color:B.muted,fontSize:20,cursor:'pointer'}}>×</button>
          </div>
          <div style={{padding:'20px 22px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {inp('OPMC Name *','name','e.g. Colombo North','text',true)}
            {inp('OPMC Code','code','e.g. COL-N')}
            {provinceSelect()}
            {inp('Address','address','Full street address…','text',true)}
            {inp('Phone','phone','e.g. 011-2345678','tel')}
            {inp('Email','email','opmc@slt.lk','email')}
          </div>
          <div style={{padding:'14px 22px',borderTop:`1px solid ${B.border}`,display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={onClose} style={{padding:'8px 16px',borderRadius:8,border:`1.5px solid ${B.border}`,background:'transparent',color:B.text,cursor:'pointer',fontSize:12,fontWeight:600}}>Cancel</button>
            <button onClick={save} disabled={!form.name.trim()||saving} style={{padding:'8px 20px',borderRadius:8,border:'none',background:form.name.trim()&&!saving?B.forest:B.dim,color:B.white,cursor:form.name.trim()&&!saving?'pointer':'not-allowed',fontSize:12,fontWeight:700,transition:'background 0.13s'}}>{saving?'⏳ Saving…':isEdit?'💾 Save':'➕ Create'}</button>
          </div>
        </div>
      </div>
  );
}

// ─── OPMC Team Detail ─────────────────────────────────────────────────────────
function OpmcTeam({ opmc, onEdit, onClose }) {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!opmc) return;
    setLoading(true);
    get('/api/users').then(d => {
      const all = Array.isArray(d) ? d : d?.content || [];
      setMembers(all.filter(u =>
          (u.opmc?.id === opmc.id || u.opmcId === opmc.id) &&
          (u.role === 'TECHNICIAN' || u.role === 'TEAM_LEAD')
      ));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [opmc?.id]);

  if (!opmc) return (
      <div style={{ background:B.surface, borderRadius:14, border:`1px solid ${B.border}`, padding:'40px 24px', textAlign:'center', color:B.muted, position:'sticky', top:24 }}>
        <div style={{ fontSize:40, marginBottom:10 }}>🏢</div>
        <div style={{ fontSize:13, fontWeight:600, color:B.text, marginBottom:4 }}>Select an OPMC</div>
        <div style={{ fontSize:12 }}>View team members and OPMC details</div>
      </div>
  );

  const byRole = {};
  members.forEach(m => {
    const r = m.role || 'OTHER';
    if (!byRole[r]) byRole[r] = [];
    byRole[r].push(m);
  });

  const ROLE_ORDER = ['TEAM_LEAD','TECHNICIAN','OTHER'];
  const ROLE_LABEL = { TEAM_LEAD:'Team Lead', TECHNICIAN:'Technicians', OTHER:'Other' };
  const ROLE_COLOR = { TEAM_LEAD:B.forest, TECHNICIAN:B.sky, OTHER:B.muted };

  return (
      <div style={{
        background:B.surface, borderRadius:14, border:`1.5px solid ${B.forest}44`,
        overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.07)',
        position:'sticky', top:24,
      }}>
        {/* Header */}
        <div style={{
          padding:'16px 18px', borderBottom:`1px solid ${B.border}`,
          background:`linear-gradient(135deg,${B.forestL},${B.surface})`,
          display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontSize:20 }}>🏢</span>
              <div style={{ fontSize:15, fontWeight:800, color:B.text }}>{opmc.name}</div>
            </div>
            {opmc.code && (
                <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:B.goldL, color:B.gold, fontWeight:800, marginRight:6 }}>{opmc.code}</span>
            )}
            <span style={{ fontSize:11, color:B.muted }}>{provinceLabel(opmc.province) || 'No province set'}</span>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => navigate(`/work-groups?opmcId=${opmc.id}`)} style={{ padding:'5px 12px', borderRadius:6, border:`1px solid ${B.sky}`, background:B.skyL, color:B.sky, cursor:'pointer', fontSize:11, fontWeight:700 }}>🧭 Work Groups</button>
            <button onClick={() => onEdit(opmc)} style={{ padding:'5px 12px', borderRadius:6, border:`1px solid ${B.forest}`, background:B.forestL, color:B.forest, cursor:'pointer', fontSize:11, fontWeight:700 }}>✏️ Edit</button>
            <button onClick={onClose} style={{ background:'none', border:'none', color:B.muted, fontSize:18, cursor:'pointer', padding:'0 4px' }}>×</button>
          </div>
        </div>

        {/* Contact info */}
        {(opmc.address || opmc.phone || opmc.email) && (
            <div style={{ padding:'12px 18px', borderBottom:`1px solid ${B.b2}` }}>
              {opmc.address && <div style={{ fontSize:11, color:B.muted, marginBottom:4 }}>📍 {opmc.address}</div>}
              {opmc.phone   && <div style={{ fontSize:11, color:B.muted, marginBottom:4 }}>📞 {opmc.phone}</div>}
              {opmc.email   && <div style={{ fontSize:11, color:B.sky }}>✉️ {opmc.email}</div>}
            </div>
        )}

        {/* Members */}
        <div style={{ padding:'14px 18px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:10, fontWeight:800, color:B.muted, letterSpacing:0.6 }}>TEAM MEMBERS</div>
            <span style={{ fontSize:11, fontWeight:700, color:B.text }}>{members.length} total</span>
          </div>

          {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[...Array(3)].map((_, i) => <Skel key={i} h={40} r={8}/>)}
              </div>
          ) : members.length === 0 ? (
              <div style={{ textAlign:'center', padding:'20px 0', color:B.muted, fontSize:12 }}>
                No technicians assigned to this OPMC
              </div>
          ) : (
              ROLE_ORDER.filter(r => byRole[r]?.length).map(role => (
                  <div key={role} style={{ marginBottom:14 }}>
                    <div style={{
                      fontSize:9, fontWeight:800, letterSpacing:0.8, marginBottom:6,
                      color:ROLE_COLOR[role], textTransform:'uppercase',
                    }}>
                      {ROLE_LABEL[role]} ({byRole[role].length})
                    </div>
                    {byRole[role].map((m, i) => (
                        <div key={i} style={{
                          display:'flex', alignItems:'center', gap:8,
                          padding:'7px 8px', borderRadius:8, marginBottom:4,
                          background:B.s2, border:`1px solid ${B.b2}`,
                        }}>
                          <div style={{
                            width:28, height:28, borderRadius:'50%', flexShrink:0,
                            background:`linear-gradient(135deg,${B.forestD},${B.sky})`,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:11, fontWeight:800, color:B.white,
                          }}>
                            {m.fullName?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:B.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {m.fullName}
                            </div>
                            <div style={{ fontSize:10, color:B.muted }}>{m.phone || m.email || '—'}</div>
                          </div>
                          <div style={{
                            width:7, height:7, borderRadius:'50%', flexShrink:0,
                            background: m.isActive !== false ? B.green : B.dim,
                          }}/>
                        </div>
                    ))}
                  </div>
              ))
          )}
        </div>
      </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OpmcsPage() {
  const [opmcs,     setOpmcs]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(null);
  const [editOpmc,   setEditOpmc]   = useState(null);
  const [formOpen,   setFormOpen]   = useState(false);
  const [search,     setSearch]     = useState('');
  const [toast,      setToast]      = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await get('/api/opmcs');
      setOpmcs(Array.isArray(d) ? d : d?.content || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = opmcs.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.name?.toLowerCase().includes(q) ||
        provinceLabel(o.province).toLowerCase().includes(q) ||
        o.code?.toLowerCase().includes(q);
  });

  useEffect(() => {
    const id = 'opmc-css'; if (document.getElementById(id)) return;
    const s = document.createElement('style'); s.id = id;
    s.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
      @keyframes opmc-shim{0%{background-position:200% 0}100%{background-position:-200% 0}}
      @keyframes opmc-fin{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
      @keyframes opmc-sld{from{opacity:0;transform:translateY(-10px)scale(0.98)}to{opacity:1;transform:none}}
      .opmc-page *{box-sizing:border-box;font-family:'Outfit',sans-serif;}
      .opmc-card{transition:all 0.15s;cursor:pointer;}
      .opmc-card:hover{box-shadow:0 6px 24px rgba(0,0,0,0.1)!important;transform:translateY(-2px)!important;}
    `;
    document.head.appendChild(s);
  }, []);

  return (
      <div className="opmc-page" style={{ background:B.bg, minHeight:'100vh', padding:'28px 32px' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
          <div>
            <h1 style={{ margin:0, fontSize:24, fontWeight:800, color:B.text }}>OPMCs</h1>
            <div style={{ fontSize:12, color:B.muted, marginTop:3 }}>
              {opmcs.length} SLT OPMCs across Sri Lanka
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={load} style={{ padding:'8px 14px', borderRadius:8, border:`1.5px solid ${B.border}`, background:B.surface, cursor:'pointer', fontSize:12, fontWeight:700, color:B.text }}>🔄</button>
            <button onClick={() => { setEditOpmc(null); setFormOpen(true); }} style={{
              padding:'8px 18px', borderRadius:8, border:'none',
              background:B.forest, color:B.white, cursor:'pointer', fontSize:12, fontWeight:700,
            }}>➕ Add OPMC</button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position:'relative', marginBottom:20, maxWidth:400 }}>
          <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:B.dim }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, code, province…"
                 style={{ width:'100%', background:B.surface, border:`1.5px solid ${B.border}`, borderRadius:8, padding:'8px 10px 8px 30px', fontSize:12, color:B.text, outline:'none' }}
                 onFocus={e => e.target.style.borderColor = B.forest}
                 onBlur={e => e.target.style.borderColor = B.border}
          />
        </div>

        {/* Two-col layout */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:20, alignItems:'start' }}>

          {/* OPMC grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
            {loading ? [...Array(6)].map((_,i) => (
                <div key={i} style={{ background:B.surface, borderRadius:12, padding:18, border:`1px solid ${B.border}`, display:'flex', flexDirection:'column', gap:10 }}>
                  <Skel h={14} w="70%" r={6}/><Skel h={10} w="40%" r={4}/><Skel h={32} r={8}/>
                </div>
            )) : filtered.length === 0 ? (
                <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'48px 24px', color:B.muted }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>🏢</div>
                  No OPMCs found
                </div>
            ) : filtered.map((o, i) => (
                <div key={o.id||i} className="opmc-card"
                     onClick={() => setSelected(selected?.id === o.id ? null : o)}
                     style={{
                       background:B.surface, borderRadius:12, padding:18,
                       border:`1.5px solid ${selected?.id===o.id ? B.forest : B.border}`,
                       boxShadow: selected?.id===o.id ? `0 4px 20px ${B.forest}22` : '0 1px 4px rgba(0,0,0,0.04)',
                       animation:`opmc-fin 0.3s ease ${i*0.04}s both`,
                     }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    <div style={{
                      width:42, height:42, borderRadius:10, flexShrink:0,
                      background:`linear-gradient(135deg,${B.forestD},${B.sky})`,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
                    }}>🏢</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:B.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {o.name}
                      </div>
                      {o.code && (
                          <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:B.goldL, color:B.gold, fontWeight:800 }}>
                      {o.code}
                    </span>
                      )}
                    </div>
                  </div>

                  {o.province && <div style={{ fontSize:11, color:B.muted, marginBottom:4 }}>📍 {provinceLabel(o.province)}</div>}
                  {o.phone  && <div style={{ fontSize:11, color:B.muted, marginBottom:8 }}>📞 {o.phone}</div>}

                  <div style={{ display:'flex', gap:6, justifyContent:'flex-end', paddingTop:6, borderTop:`1px solid ${B.b2}` }}>
                    <button onClick={e => { e.stopPropagation(); setEditOpmc(o); setFormOpen(true); }} style={{
                      padding:'4px 10px', borderRadius:6, border:`1px solid ${B.border}`,
                      background:'none', cursor:'pointer', fontSize:10, color:B.muted, transition:'all 0.12s',
                    }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor=B.forest; e.currentTarget.style.color=B.forest; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor=B.border; e.currentTarget.style.color=B.muted; }}
                    >✏️ Edit</button>
                    <button onClick={e => { e.stopPropagation(); setSelected(o); }} style={{
                      padding:'4px 10px', borderRadius:6,
                      border:`1px solid ${B.forest}55`, background:B.forestL,
                      cursor:'pointer', fontSize:10, color:B.forest, fontWeight:700,
                    }}>👥 Team</button>
                  </div>
                </div>
            ))}
          </div>

          {/* Detail panel */}
          <div>
            <OpmcTeam
                opmc={selected}
                onEdit={o => { setEditOpmc(o); setFormOpen(true); }}
                onClose={() => setSelected(null)}
            />
          </div>
        </div>

        <OpmcModal
            opmc={editOpmc} open={formOpen}
            onClose={() => { setFormOpen(false); setEditOpmc(null); load(); }}
            onSuccess={(msg, type) => setToast({ msg, type })}
        />
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
      </div>
  );
}
