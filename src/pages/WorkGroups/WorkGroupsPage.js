import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

// Critical #2 (QA_Compliance_Consolidated_Report.md) — Work Group management had a fully-built
// backend (WorkGroupController) and no UI at all. Structural clone of OpmcsPage.js's own
// convention (bespoke fetch wrapper, palette, card-grid + sticky detail-panel layout, Skel/Toast,
// modal form) rather than the shared DataTable/Modal component library UsersPage.js uses — the
// two Super-Admin-adjacent management pages (Opmcs, WorkGroups) share one visual language.

const API = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const tok = () => localStorage.getItem('accessToken');

// Same shape as OpmcsPage.js's req/get/post/put, with one addition: on failure, parse the
// response body for a real backend `message` before falling back to the bare status code —
// mirrors the existing precedent in api/users.js's bulkImport() rather than inventing a new
// pattern. OpmcsPage.js itself is intentionally left untouched; this wrapper lives only here.
const req = (method, path, body) =>
  fetch(`${API}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => {
    if (!r.ok) {
      const data = await r.json().catch(() => null);
      throw new Error(data?.message || `${r.status}`);
    }
    return r.json();
  });
const get   = p      => req('GET',   p);
const post  = (p, b) => req('POST',  p, b);
const put   = (p, b) => req('PUT',   p, b);
const patch = p      => req('PATCH', p);

// A bare numeric status (network failure before any body could be parsed, or a handler that
// sent no `message`) still reads as the old generic toast; anything else — the backend's own
// business-rule explanation — is shown verbatim. Used uniformly by every catch on this page.
const errMsg = e => (/^\d+$/.test(e.message) ? 'Save failed' : e.message);

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
    <div style={{height:h,width:w,borderRadius:r,background:`linear-gradient(90deg,${B.s2} 25%,${B.border} 50%,${B.s2} 75%)`,backgroundSize:'400% 100%',animation:'wg-shim 1.5s ease infinite'}}/>
);

const Toast = ({msg,type,onDone}) => {
  useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t);},[onDone]);
  return <div style={{position:'fixed',bottom:24,right:24,zIndex:3000,background:B.surface,border:`2px solid ${type==='success'?B.forest:B.red}`,borderRadius:10,padding:'10px 18px',display:'flex',alignItems:'center',gap:8,fontSize:13,color:B.text,boxShadow:'0 4px 20px rgba(0,0,0,0.1)',animation:'wg-fin 0.2s ease',maxWidth:420}}>{type==='success'?'✅':'❌'} {msg}</div>;
};

// ─── Work Group Form Modal ──────────────────────────────────────────────────
// Create/edit — name, OPMC, Team Lead (scoped to the selected OPMC). Team Lead candidates are
// filtered client-side to exclude anyone the parent's own `workGroups` list already shows as
// leading a DIFFERENT Work Group — a UX nicety only; WorkGroupService's own
// `alreadyLeadsAnother` check (RES-020) remains the real authority and still fires (surfaced
// verbatim via errMsg) if this client-side filter is ever stale.
function WorkGroupModal({ wg, open, opmcs, workGroups, defaultOpmcId, onClose, onSuccess }) {
  const isEdit = !!wg;
  const init = { name:'', opmcId: defaultOpmcId || '', teamLeadId:'' };
  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(isEdit ? {
      name: wg.name || '', opmcId: wg.opmcId || '', teamLeadId: wg.teamLeadId || '',
    } : init);
  }, [open, wg]);

  useEffect(() => {
    const fn = e => e.key === 'Escape' && onClose();
    if (open) document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !form.opmcId) { setLeads([]); return; }
    setLeadsLoading(true);
    get(`/api/users?role=TEAM_LEAD&opmcId=${form.opmcId}&activeOnly=true`)
      .then(list => {
        const takenBySomeoneElse = new Set(
          workGroups.filter(w => w.teamLeadId && (!isEdit || w.id !== wg.id)).map(w => w.teamLeadId)
        );
        setLeads((Array.isArray(list) ? list : []).filter(u => !takenBySomeoneElse.has(u.id)));
      })
      .catch(() => setLeads([]))
      .finally(() => setLeadsLoading(false));
  }, [open, form.opmcId]);

  if (!open) return null;

  const activeOpmcs = opmcs.filter(o => o.status !== 'INACTIVE');

  const save = async () => {
    if (!form.name.trim() || !form.opmcId) return;
    setSaving(true);
    const body = {
      name: form.name.trim(),
      opmcId: Number(form.opmcId),
      teamLeadId: form.teamLeadId ? Number(form.teamLeadId) : null,
    };
    try {
      if (isEdit) await put(`/api/workgroups/${wg.id}`, body);
      else await post('/api/workgroups', body);
      onSuccess(isEdit ? 'Work Group updated' : 'Work Group created', 'success');
      onClose();
    } catch (e) { onSuccess(errMsg(e), 'error'); }
    finally { setSaving(false); }
  };

  const label = (t) => (
      <div style={{ fontSize:10, fontWeight:800, color:B.muted, letterSpacing:0.6, textTransform:'uppercase', marginBottom:4 }}>{t}</div>
  );
  const selStyle = { width:'100%', background:B.s2, border:`1.5px solid ${B.border}`, borderRadius:8, padding:'9px 12px', fontSize:12, color:B.text, outline:'none' };

  return (
      <div className="wg-modal" onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(28,28,20,0.55)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24,animation:'wg-fin 0.18s ease'}}>
        <div style={{background:B.surface,borderRadius:16,width:'100%',maxWidth:480,border:`1px solid ${B.border}`,boxShadow:'0 20px 60px rgba(0,0,0,0.15)',animation:'wg-sld 0.2s ease'}}>
          <div style={{padding:'18px 22px 14px',borderBottom:`1px solid ${B.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:16,fontWeight:800,color:B.text}}>{isEdit?`Edit — ${wg.name}`:'Add New Work Group'}</div>
            <button onClick={onClose} style={{background:'none',border:'none',color:B.muted,fontSize:20,cursor:'pointer'}}>×</button>
          </div>
          <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:12}}>
            <div>
              {label('Work Group Name *')}
              <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. North Colombo Field Team"
                     style={selStyle} onFocus={e=>e.target.style.borderColor=B.forest} onBlur={e=>e.target.style.borderColor=B.border}/>
            </div>
            <div>
              {label('OPMC *')}
              <select value={form.opmcId} disabled={isEdit}
                      onChange={e=>setForm(p=>({...p,opmcId:e.target.value,teamLeadId:''}))} style={selStyle}>
                <option value="">— Select OPMC —</option>
                {activeOpmcs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              {isEdit && <div style={{fontSize:10,color:B.muted,marginTop:4}}>OPMC cannot be changed after creation.</div>}
            </div>
            <div>
              {label('Team Lead')}
              <select value={form.teamLeadId} disabled={!form.opmcId || leadsLoading}
                      onChange={e=>setForm(p=>({...p,teamLeadId:e.target.value}))} style={selStyle}>
                <option value="">
                  {!form.opmcId ? '— Select an OPMC first —' : leadsLoading ? 'Loading…' : '— No Team Lead —'}
                </option>
                {leads.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
              <div style={{fontSize:10,color:B.muted,marginTop:4}}>
                Only shows this OPMC's Team Leads not already leading another Work Group.
              </div>
            </div>
          </div>
          <div style={{padding:'14px 22px',borderTop:`1px solid ${B.border}`,display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={onClose} style={{padding:'8px 16px',borderRadius:8,border:`1.5px solid ${B.border}`,background:'transparent',color:B.text,cursor:'pointer',fontSize:12,fontWeight:600}}>Cancel</button>
            <button onClick={save} disabled={!form.name.trim()||!form.opmcId||saving} style={{padding:'8px 20px',borderRadius:8,border:'none',background:form.name.trim()&&form.opmcId&&!saving?B.forest:B.dim,color:B.white,cursor:form.name.trim()&&form.opmcId&&!saving?'pointer':'not-allowed',fontSize:12,fontWeight:700}}>{saving?'⏳ Saving…':isEdit?'💾 Save':'➕ Create'}</button>
          </div>
        </div>
      </div>
  );
}

// ─── Work Group Roster Detail ────────────────────────────────────────────────
// Technician membership only — Team Lead assignment/reassignment lives in WorkGroupModal
// (PUT /api/workgroups/{id}), not here. "Move to Work Group" is the only membership action:
// PUT /api/users/{id} can only SET workgroupId, never clear it (confirmed directly against
// UserService.updateUser — no branch nulls it out), so there is no true "Remove" — a technician
// can only ever be moved to a different real Work Group, never unassigned outright. Documented
// here, not treated as a bug to work around.
function WorkGroupRoster({ workGroup, workGroups, onEdit, onClose, onToast, onChanged }) {
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(null); // userId currently being moved
  const [toggling, setToggling] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    if (!workGroup) return;
    setLoading(true);
    get(`/api/users?role=TECHNICIAN&opmcId=${workGroup.opmcId}`)
      .then(list => setTechs(Array.isArray(list) ? list : []))
      .catch(() => setTechs([]))
      .finally(() => setLoading(false));
  }, [workGroup]);

  useEffect(() => { load(); }, [load]);

  if (!workGroup) return (
      <div style={{ background:B.surface, borderRadius:14, border:`1px solid ${B.border}`, padding:'40px 24px', textAlign:'center', color:B.muted, position:'sticky', top:24 }}>
        <div style={{ fontSize:40, marginBottom:10 }}>🧭</div>
        <div style={{ fontSize:13, fontWeight:600, color:B.text, marginBottom:4 }}>Select a Work Group</div>
        <div style={{ fontSize:12 }}>View its roster and Team Lead</div>
      </div>
  );

  const members  = techs.filter(t => String(t.workgroupId) === String(workGroup.id));
  const others   = workGroups.filter(w => w.opmcId === workGroup.opmcId && w.id !== workGroup.id && w.isActive !== false);
  const isActive = workGroup.isActive !== false;

  const moveTo = async (userId, newWorkgroupId) => {
    const u = techs.find(t => t.id === userId);
    if (!u) return;
    setMoving(userId);
    try {
      await put(`/api/users/${userId}`, {
        fullName: u.fullName, email: u.email, phone: u.phone,
        role: u.role, opmcId: u.opmcId, workgroupId: Number(newWorkgroupId),
      });
      onToast('Technician moved', 'success');
      load();
      onChanged();
    } catch (e) { onToast(errMsg(e), 'error'); }
    finally { setMoving(null); }
  };

  const addToThisGroup = (userId) => moveTo(userId, workGroup.id);

  const toggleActive = async () => {
    setToggling(true);
    try {
      await patch(`/api/workgroups/${workGroup.id}/${isActive ? 'deactivate' : 'activate'}`);
      onToast(isActive ? 'Work Group deactivated' : 'Work Group activated', 'success');
      onChanged();
    } catch (e) { onToast(errMsg(e), 'error'); }
    finally { setToggling(false); }
  };

  const addCandidates = techs.filter(t => String(t.workgroupId) !== String(workGroup.id) && t.isActive !== false);

  return (
      <div style={{
        background:B.surface, borderRadius:14, border:`1.5px solid ${B.forest}44`,
        overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.07)',
        position:'sticky', top:24,
      }}>
        <div style={{
          padding:'16px 18px', borderBottom:`1px solid ${B.border}`,
          background:`linear-gradient(135deg,${B.forestL},${B.surface})`,
          display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontSize:20 }}>🧭</span>
              <div style={{ fontSize:15, fontWeight:800, color:B.text }}>{workGroup.name}</div>
            </div>
            <span style={{ fontSize:11, color:B.muted }}>{workGroup.opmcName}</span>
            {!isActive && (
                <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:B.redL, color:B.red, fontWeight:800, marginLeft:6 }}>INACTIVE</span>
            )}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => onEdit(workGroup)} style={{ padding:'5px 12px', borderRadius:6, border:`1px solid ${B.forest}`, background:B.forestL, color:B.forest, cursor:'pointer', fontSize:11, fontWeight:700 }}>✏️ Edit</button>
            <button onClick={onClose} style={{ background:'none', border:'none', color:B.muted, fontSize:18, cursor:'pointer', padding:'0 4px' }}>×</button>
          </div>
        </div>

        <div style={{ padding:'12px 18px', borderBottom:`1px solid ${B.b2}` }}>
          <div style={{ fontSize:11, color:B.muted, marginBottom:6 }}>👑 Team Lead</div>
          <div style={{ fontSize:13, fontWeight:700, color:B.text }}>
            {workGroup.teamLeadName || <span style={{ color:B.dim, fontWeight:500 }}>Unassigned</span>}
          </div>
        </div>

        <div style={{ padding:'12px 18px', borderBottom:`1px solid ${B.b2}` }}>
          <button onClick={toggleActive} disabled={toggling} style={{
            width:'100%', padding:'7px 0', borderRadius:8, border:`1.5px solid ${isActive ? B.red : B.forest}`,
            background: isActive ? B.redL : B.forestL, color: isActive ? B.red : B.forest,
            cursor: toggling ? 'default' : 'pointer', fontSize:11, fontWeight:700,
          }}>
            {toggling ? '⏳ …' : isActive ? '⏸ Deactivate Work Group' : '▶ Activate Work Group'}
          </button>
        </div>

        <div style={{ padding:'14px 18px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:10, fontWeight:800, color:B.muted, letterSpacing:0.6 }}>TECHNICIANS</div>
            <span style={{ fontSize:11, fontWeight:700, color:B.text }}>{members.length} total</span>
          </div>

          {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[...Array(3)].map((_, i) => <Skel key={i} h={40} r={8}/>)}
              </div>
          ) : members.length === 0 ? (
              <div style={{ textAlign:'center', padding:'16px 0', color:B.muted, fontSize:12 }}>
                No technicians in this Work Group yet
              </div>
          ) : members.map(m => (
              <div key={m.id} style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'7px 8px', borderRadius:8, marginBottom:6,
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
                <select
                    disabled={moving === m.id || others.length === 0}
                    value=""
                    onChange={e => e.target.value && moveTo(m.id, e.target.value)}
                    title={others.length === 0 ? 'No other active Work Group in this OPMC to move to' : 'Move to another Work Group'}
                    style={{ fontSize:10, borderRadius:6, border:`1px solid ${B.border}`, background:B.surface, color:B.text, padding:'3px 4px', maxWidth:110 }}
                >
                  <option value="">{moving === m.id ? 'Moving…' : '↔ Move to…'}</option>
                  {others.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
          ))}

          <button onClick={() => setAddOpen(o => !o)} style={{
            width:'100%', marginTop:8, padding:'7px 0', borderRadius:8,
            border:`1.5px dashed ${B.border}`, background:'transparent', color:B.muted,
            cursor:'pointer', fontSize:11, fontWeight:700,
          }}>
            {addOpen ? '▲ Hide' : '➕ Add a Technician'}
          </button>

          {addOpen && (
              addCandidates.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'12px 0', color:B.muted, fontSize:11 }}>
                    No other active Technician in this OPMC to add
                  </div>
              ) : (
                  <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6, maxHeight:220, overflowY:'auto' }}>
                    {addCandidates.map(t => (
                        <div key={t.id} style={{
                          display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
                          padding:'6px 8px', borderRadius:8, background:B.s2, border:`1px solid ${B.b2}`,
                        }}>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:600, color:B.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.fullName}</div>
                            <div style={{ fontSize:9, color:B.dim }}>{t.workgroupId ? 'currently in another Work Group' : 'unassigned'}</div>
                          </div>
                          <button onClick={() => addToThisGroup(t.id)} disabled={moving === t.id} style={{
                            padding:'4px 10px', borderRadius:6, border:`1px solid ${B.forest}55`,
                            background:B.forestL, color:B.forest, cursor:'pointer', fontSize:10, fontWeight:700, flexShrink:0,
                          }}>{moving === t.id ? '…' : '＋ Add'}</button>
                        </div>
                    ))}
                  </div>
              )
          )}
        </div>
      </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WorkGroupsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [workGroups, setWorkGroups] = useState([]);
  const [opmcs,       setOpmcs]     = useState([]);
  const [loading,     setLoading]   = useState(true);
  const [selected,    setSelected]  = useState(null);
  const [editWg,      setEditWg]    = useState(null);
  const [formOpen,    setFormOpen]  = useState(false);
  const [search,      setSearch]    = useState('');
  const [opmcFilter,  setOpmcFilter] = useState(searchParams.get('opmcId') || '');
  const [toast,       setToast]     = useState(null);

  const showToast = (msg, type) => setToast({ msg, type });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Unfiltered on purpose (no ?opmcId=) — the server-side opmcId filter routes to
      // findActiveByOpmcId, which would silently hide inactive Work Groups from this
      // management page. Filtering by OPMC and by search both happen client-side instead,
      // matching OpmcsPage.js's own client-side search pattern.
      const [wgs, ops] = await Promise.all([get('/api/workgroups'), get('/api/opmcs')]);
      setWorkGroups(Array.isArray(wgs) ? wgs : []);
      setOpmcs(Array.isArray(ops) ? ops : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const p = new URLSearchParams(searchParams);
    if (opmcFilter) p.set('opmcId', opmcFilter); else p.delete('opmcId');
    setSearchParams(p, { replace: true });
  }, [opmcFilter]);

  // Keep the sticky detail panel's own data current after a roster action changes workGroups
  // (e.g. activate/deactivate) without a full page reload.
  const selectedFresh = useMemo(
      () => selected ? workGroups.find(w => w.id === selected.id) || null : null,
      [selected, workGroups]
  );

  const filtered = workGroups.filter(w => {
    if (opmcFilter && String(w.opmcId) !== String(opmcFilter)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return w.name?.toLowerCase().includes(q) ||
        w.opmcName?.toLowerCase().includes(q) ||
        w.teamLeadName?.toLowerCase().includes(q);
  });

  useEffect(() => {
    const id = 'wg-css'; if (document.getElementById(id)) return;
    const s = document.createElement('style'); s.id = id;
    s.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
      @keyframes wg-shim{0%{background-position:200% 0}100%{background-position:-200% 0}}
      @keyframes wg-fin{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
      @keyframes wg-sld{from{opacity:0;transform:translateY(-10px)scale(0.98)}to{opacity:1;transform:none}}
      .wg-page *{box-sizing:border-box;font-family:'Outfit',sans-serif;}
      .wg-card{transition:all 0.15s;cursor:pointer;}
      .wg-card:hover{box-shadow:0 6px 24px rgba(0,0,0,0.1)!important;transform:translateY(-2px)!important;}
    `;
    document.head.appendChild(s);
  }, []);

  return (
      <div className="wg-page" style={{ background:B.bg, minHeight:'100vh', padding:'28px 32px' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
          <div>
            <h1 style={{ margin:0, fontSize:24, fontWeight:800, color:B.text }}>Work Groups</h1>
            <div style={{ fontSize:12, color:B.muted, marginTop:3 }}>
              {workGroups.length} Work Groups across all OPMCs
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={load} style={{ padding:'8px 14px', borderRadius:8, border:`1.5px solid ${B.border}`, background:B.surface, cursor:'pointer', fontSize:12, fontWeight:700, color:B.text }}>🔄</button>
            <button onClick={() => { setEditWg(null); setFormOpen(true); }} style={{
              padding:'8px 18px', borderRadius:8, border:'none',
              background:B.forest, color:B.white, cursor:'pointer', fontSize:12, fontWeight:700,
            }}>➕ Add Work Group</button>
          </div>
        </div>

        <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
          <div style={{ position:'relative', maxWidth:360, flex:1, minWidth:220 }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:B.dim }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, OPMC, Team Lead…"
                   style={{ width:'100%', background:B.surface, border:`1.5px solid ${B.border}`, borderRadius:8, padding:'8px 10px 8px 30px', fontSize:12, color:B.text, outline:'none' }}
                   onFocus={e => e.target.style.borderColor = B.forest}
                   onBlur={e => e.target.style.borderColor = B.border}
            />
          </div>
          <select value={opmcFilter} onChange={e => setOpmcFilter(e.target.value)}
                  style={{ background:B.surface, border:`1.5px solid ${B.border}`, borderRadius:8, padding:'8px 12px', fontSize:12, color:B.text, outline:'none' }}>
            <option value="">All OPMCs</option>
            {opmcs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:20, alignItems:'start' }}>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
            {loading ? [...Array(6)].map((_,i) => (
                <div key={i} style={{ background:B.surface, borderRadius:12, padding:18, border:`1px solid ${B.border}`, display:'flex', flexDirection:'column', gap:10 }}>
                  <Skel h={14} w="70%" r={6}/><Skel h={10} w="40%" r={4}/><Skel h={32} r={8}/>
                </div>
            )) : filtered.length === 0 ? (
                <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'48px 24px', color:B.muted }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>🧭</div>
                  No Work Groups found
                </div>
            ) : filtered.map((w, i) => (
                <div key={w.id} className="wg-card"
                     onClick={() => setSelected(selected?.id === w.id ? null : w)}
                     style={{
                       background:B.surface, borderRadius:12, padding:18,
                       border:`1.5px solid ${selected?.id===w.id ? B.forest : B.border}`,
                       boxShadow: selected?.id===w.id ? `0 4px 20px ${B.forest}22` : '0 1px 4px rgba(0,0,0,0.04)',
                       animation:`wg-fin 0.3s ease ${i*0.04}s both`,
                       opacity: w.isActive === false ? 0.6 : 1,
                     }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    <div style={{
                      width:42, height:42, borderRadius:10, flexShrink:0,
                      background:`linear-gradient(135deg,${B.forestD},${B.sky})`,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
                    }}>🧭</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:B.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {w.name}
                      </div>
                      {w.isActive === false && (
                          <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:B.redL, color:B.red, fontWeight:800 }}>INACTIVE</span>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize:11, color:B.muted, marginBottom:4 }}>🏢 {w.opmcName}</div>
                  <div style={{ fontSize:11, color:B.muted, marginBottom:8 }}>
                    👑 {w.teamLeadName || <span style={{ color:B.dim }}>Unassigned</span>}
                  </div>

                  <div style={{ display:'flex', gap:6, justifyContent:'flex-end', paddingTop:6, borderTop:`1px solid ${B.b2}` }}>
                    <button onClick={e => { e.stopPropagation(); setEditWg(w); setFormOpen(true); }} style={{
                      padding:'4px 10px', borderRadius:6, border:`1px solid ${B.border}`,
                      background:'none', cursor:'pointer', fontSize:10, color:B.muted,
                    }}>✏️ Edit</button>
                    <button onClick={e => { e.stopPropagation(); setSelected(w); }} style={{
                      padding:'4px 10px', borderRadius:6,
                      border:`1px solid ${B.forest}55`, background:B.forestL,
                      cursor:'pointer', fontSize:10, color:B.forest, fontWeight:700,
                    }}>👥 Roster</button>
                  </div>
                </div>
            ))}
          </div>

          <div>
            <WorkGroupRoster
                workGroup={selectedFresh}
                workGroups={workGroups}
                onEdit={w => { setEditWg(w); setFormOpen(true); }}
                onClose={() => setSelected(null)}
                onToast={showToast}
                onChanged={load}
            />
          </div>
        </div>

        <WorkGroupModal
            wg={editWg} open={formOpen} opmcs={opmcs} workGroups={workGroups}
            defaultOpmcId={opmcFilter}
            onClose={() => { setFormOpen(false); setEditWg(null); load(); }}
            onSuccess={showToast}
        />
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
      </div>
  );
}
