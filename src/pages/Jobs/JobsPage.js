import React, { useState, useEffect, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const tok = () => localStorage.getItem('accessToken');
const req = (method, path, body) =>
    fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: body ? JSON.stringify(body) : undefined,
    }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });
const get   = p      => req('GET',   p);
const post  = (p, b) => req('POST',  p, b);
const patch = (p, b) => req('PATCH', p, b);

const J = {
  bg:'#F0F4F8', surface:'#FFFFFF', s2:'#E8ECF2', border:'#CBD5E1', b2:'#E2E8F0',
  text:'#1E293B', muted:'#64748B', dim:'#94A3B8',
  teal:'#0D9488', tealL:'#CCFBF1', tealD:'#0F766E',
  blue:'#2563EB', blueL:'#DBEAFE',
  violet:'#7C3AED', violetL:'#EDE9FE',
  green:'#15803D', greenL:'#DCFCE7',
  amber:'#B45309', amberL:'#FEF3C7',
  red:'#DC2626', redL:'#FEE2E2',
  white:'#FFFFFF',
};

// QA_Compliance_Consolidated_Report.md — the backend's real initial Job status is PENDING
// (entity/Job.java), not ASSIGNED; this map previously had no PENDING key at all, so a
// genuinely PENDING job fell through Pill's `STATUS[status]||STATUS.ASSIGNED` fallback and
// silently rendered mislabeled as "Assigned", had no filter chip (built from
// Object.entries(STATUS)), and showed zero manual status-change buttons (NEXT[job.status]
// was also undefined). ASSIGNED is left in place, unused by any real backend value today —
// removing it is a separate, out-of-scope naming question (see #10/#11's own DECIDED /
// NOT-A-DEFECT entry: the backend enum itself deliberately stays PENDING).
const STATUS = {
  PENDING:     { l:'Pending',     bg:J.violetL, c:'#6D28D9', d:J.violet  },
  ASSIGNED:    { l:'Assigned',    bg:J.blueL,   c:'#1D4ED8', d:J.blue    },
  ACCEPTED:    { l:'Accepted',    bg:J.tealL,   c:J.tealD,   d:J.teal    },
  TRAVELLING:  { l:'Travelling',  bg:J.amberL,  c:J.amber,   d:J.amber   },
  IN_PROGRESS: { l:'In Progress', bg:'#FFF7ED', c:'#C2410C', d:'#EA580C' },
  PAUSED:      { l:'Paused',      bg:J.s2,      c:J.muted,   d:J.muted   },
  COMPLETED:   { l:'Completed',   bg:J.greenL,  c:J.green,   d:'#16A34A' },
  CANCELLED:   { l:'Cancelled',   bg:J.redL,    c:J.red,     d:'#EF4444' },
};
const PRI = {
  HIGH:  { l:'HIGH', bg:'#FEE2E2', c:'#DC2626', bd:'#FECACA' },
  MEDIUM:{ l:'MED',  bg:'#FEF3C7', c:'#B45309', bd:'#FDE68A' },
  LOW:   { l:'LOW',  bg:J.greenL,  c:J.green,   bd:'#BBF7D0' },
};
const NEXT = {
  // Matches JobService.validateJobTransition's real PENDING transitions (ACCEPTED/CANCELLED;
  // REJECTED is not modeled as a manual admin action here, consistent with every other status
  // in this map).
  PENDING:     ['ACCEPTED','CANCELLED'],
  ASSIGNED:    ['ACCEPTED','CANCELLED'],
  ACCEPTED:    ['TRAVELLING','CANCELLED'],
  TRAVELLING:  ['IN_PROGRESS','CANCELLED'],
  IN_PROGRESS: ['PAUSED','COMPLETED','CANCELLED'],
  PAUSED:      ['IN_PROGRESS','CANCELLED'],
};

const ago = d => {
  if (!d) return '—';
  const s = Math.floor((Date.now()-new Date(d))/1000);
  if (s<60) return `${s}s ago`;
  if (s<3600) return `${Math.floor(s/60)}m ago`;
  if (s<86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};
const fmtDT = d => d ? new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';

const Pill = ({status}) => {
  const s=STATUS[status]||STATUS.ASSIGNED;
  return <span style={{ display:'inline-flex',alignItems:'center',gap:5,padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:700,background:s.bg,color:s.c,border:`1px solid ${s.d}33`,whiteSpace:'nowrap' }}><span style={{width:5,height:5,borderRadius:'50%',background:s.d,flexShrink:0}}/>{s.l}</span>;
};
const PriTag = ({priority}) => {
  const p=PRI[priority]||PRI.LOW;
  return <span style={{padding:'2px 7px',borderRadius:5,fontSize:10,fontWeight:800,letterSpacing:0.5,background:p.bg,color:p.c,border:`1px solid ${p.bd}`}}>{p.l}</span>;
};
const Avt = ({name,size=28}) => (
    <div style={{width:size,height:size,borderRadius:'50%',flexShrink:0,background:`linear-gradient(135deg,${J.tealD},${J.blue})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.38,fontWeight:800,color:J.white}}>{name?.charAt(0)?.toUpperCase()||'?'}</div>
);
const Skel = ({h=14,w='100%',r=6}) => (
    <div style={{height:h,width:w,borderRadius:r,background:`linear-gradient(90deg,${J.s2} 25%,${J.border} 50%,${J.s2} 75%)`,backgroundSize:'400% 100%',animation:'jb-shim 1.4s ease infinite'}}/>
);
const Toast = ({msg,type,onDone}) => {
  useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t);},[onDone]);
  return <div style={{position:'fixed',bottom:24,right:24,zIndex:3000,background:J.surface,border:`2px solid ${type==='success'?J.teal:J.red}`,borderRadius:10,padding:'10px 18px',display:'flex',alignItems:'center',gap:8,fontSize:13,color:J.text,boxShadow:'0 4px 24px rgba(0,0,0,0.12)',animation:'jb-fin 0.2s ease'}}>{type==='success'?'✅':'❌'} {msg}</div>;
};

function JobModal({job,technicians,open,onClose,onSaved}) {
  const [status,setStatus]=useState('');
  const [techId,setTechId]=useState('');
  const [notes,setNotes]=useState('');
  const [saving,setSaving]=useState(false);

  useEffect(()=>{ if(open&&job){setStatus(job.status||'');setTechId(String(job.assignedTo?.id||''));setNotes('');} },[open,job?.id]);
  useEffect(()=>{const fn=e=>e.key==='Escape'&&onClose();if(open)document.addEventListener('keydown',fn);return()=>document.removeEventListener('keydown',fn);},[open,onClose]);

  if(!open||!job)return null;
  const allowed=NEXT[job.status]||[];
  const changed=status!==job.status||(techId&&techId!==String(job.assignedTo?.id||''));

  // Job has no opmcId/workgroupId of its own — resolve it via its Team Lead
  // (technicians already includes TEAM_LEAD-role users, so the job's own
  // dispatching Team Lead should be findable in the same list). This mirrors
  // JobService.reassignJob's real enforcement boundary as closely as static
  // org data allows: same OPMC AND same Work Group as the job's Team Lead.
  // NOTE (not fully closable client-side): the backend's actual guard is
  // narrower still — DaySessionMemberRepository.findActiveMemberForTeamLeadToday
  // requires the technician to be a checked-in member of THIS team lead's
  // *today's active day-session*, not just a static Work Group assignment.
  // A technician can match OPMC+Work Group here and still be rejected server-
  // side if they simply haven't checked in today (or checked into a different
  // team lead's session) — that dynamic, per-day membership has no list
  // endpoint to query from the admin portal today. This filter removes the
  // clearly-wrong-org options; it cannot guarantee zero-failure the way a
  // real active-session-membership endpoint would.
  const jobTeamLead=technicians.find(t=>String(t.id)===String(job.teamLeadId));
  const eligibleTechnicians=jobTeamLead
      ? technicians.filter(t=>t.opmcId===jobTeamLead.opmcId&&t.workgroupId===jobTeamLead.workgroupId)
      : technicians; // Team Lead not resolvable (e.g. missing/deactivated) — fall back to the full list rather than trap the Admin with zero options.

  const save=async()=>{
    setSaving(true);
    try{
      if(status!==job.status) await patch(`/api/jobs/${job.id}/status`,{status,notes}).catch(()=>post(`/api/jobs/${job.id}/update`,{status,notes}));
      if(techId&&techId!==String(job.assignedTo?.id||'')) await post(`/api/jobs/${job.id}/reassign`,{newTechnicianId:Number(techId)});
      onSaved('Job updated','success');onClose();
    }catch(e){onSaved(`Update failed${e?.message?` (${e.message})`:''}`,'error');}finally{setSaving(false);}
  };

  const meta=[
    {l:'Fault',v:job.faultId?`#${job.faultId}`:'—'},{l:'Category',v:job.category||job.fault?.category||'—'},
    {l:'Duration',v:job.estimatedDurationHours?`${job.estimatedDurationHours}h`:'—'},{l:'Created',v:fmtDT(job.createdAt)},
    {l:'Started',v:fmtDT(job.startedAt)},{l:'Completed',v:fmtDT(job.completedAt)},
  ];

  return (
      <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(15,23,42,0.55)',backdropFilter:'blur(5px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24,animation:'jb-fin 0.18s ease'}}>
        <div style={{background:J.surface,borderRadius:16,width:'100%',maxWidth:620,maxHeight:'88vh',display:'flex',flexDirection:'column',border:`1px solid ${J.border}`,boxShadow:'0 24px 64px rgba(0,0,0,0.2)',animation:'jb-sld 0.2s ease'}}>
          <div style={{padding:'18px 22px 14px',borderBottom:`1px solid ${J.border}`,display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexShrink:0,background:`linear-gradient(135deg,${J.tealL}55,transparent)`,borderRadius:'16px 16px 0 0'}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                <span style={{fontWeight:800,fontSize:16,color:J.text}}>Job #{job.id}</span>
                <Pill status={job.status}/>{job.priority&&<PriTag priority={job.priority}/>}
              </div>
              <div style={{fontSize:11,color:J.muted}}>Created {ago(job.createdAt)} · Updated {ago(job.updatedAt)}</div>
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',color:J.muted,fontSize:22,cursor:'pointer'}}>×</button>
          </div>
          <div style={{overflowY:'auto',flex:1,padding:'18px 22px'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:18}}>
              {meta.map((m,i)=><div key={i} style={{padding:'9px 11px',borderRadius:8,background:J.s2,border:`1px solid ${J.b2}`}}><div style={{fontSize:9,color:J.muted,fontWeight:700,letterSpacing:0.5,marginBottom:2}}>{m.l.toUpperCase()}</div><div style={{fontSize:12,fontWeight:700,color:J.text}}>{m.v}</div></div>)}
            </div>
            {job.assignedTo&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderRadius:10,background:J.tealL,border:`1px solid ${J.teal}33`,marginBottom:16}}><Avt name={job.assignedTo.fullName} size={36}/><div><div style={{fontSize:13,fontWeight:700,color:J.text}}>{job.assignedTo.fullName}</div><div style={{fontSize:11,color:J.muted}}>{job.assignedTo.phone}</div></div><span style={{marginLeft:'auto',fontSize:10,fontWeight:700,color:J.teal}}>Currently Assigned</span></div>}
            {(job.address||job.fault?.address)&&<div style={{padding:'9px 12px',borderRadius:8,background:J.s2,border:`1px solid ${J.b2}`,fontSize:12,color:J.muted,marginBottom:16}}>📍 {job.address||job.fault?.address}</div>}
            {job.notes&&<div style={{padding:'9px 12px',borderRadius:8,background:J.amberL,border:`1px solid ${J.amber}33`,fontSize:12,color:J.text,marginBottom:16,lineHeight:1.6}}>📝 {job.notes}</div>}
            <div style={{height:1,background:J.b2,margin:'4px 0 16px'}}/>
            {allowed.length>0&&<div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:J.muted,fontWeight:700,letterSpacing:0.5,marginBottom:6}}>UPDATE STATUS</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {allowed.map(s=>{const sc=STATUS[s];return<button key={s} onClick={()=>setStatus(s)} style={{padding:'6px 14px',borderRadius:8,border:`1.5px solid ${status===s?sc.d:J.border}`,background:status===s?sc.bg:'transparent',color:status===s?sc.c:J.muted,cursor:'pointer',fontSize:11,fontWeight:700,transition:'all 0.12s'}}>{s.replace(/_/g,' ')}</button>;})}
              </div>
            </div>}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:J.muted,fontWeight:700,letterSpacing:0.5,marginBottom:5}}>ASSIGN TECHNICIAN</div>
              <select value={techId} onChange={e=>setTechId(e.target.value)} style={{width:'100%',background:J.s2,border:`1.5px solid ${J.border}`,borderRadius:8,padding:'8px 12px',fontSize:12,color:J.text,outline:'none',cursor:'pointer'}} onFocus={e=>e.target.style.borderColor=J.teal} onBlur={e=>e.target.style.borderColor=J.border}>
                <option value="">— Keep current —</option>
                {eligibleTechnicians.map(t=><option key={t.id} value={t.id}>{t.fullName} {t.phone?`(${t.phone})`:''}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:10,color:J.muted,fontWeight:700,letterSpacing:0.5,marginBottom:5}}>NOTES</div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add notes…" rows={2} style={{width:'100%',background:J.s2,border:`1.5px solid ${J.border}`,borderRadius:8,padding:'8px 12px',fontSize:12,color:J.text,outline:'none',resize:'vertical',fontFamily:'inherit'}} onFocus={e=>e.target.style.borderColor=J.teal} onBlur={e=>e.target.style.borderColor=J.border}/>
            </div>
          </div>
          <div style={{padding:'14px 22px',borderTop:`1px solid ${J.border}`,display:'flex',gap:8,justifyContent:'flex-end',flexShrink:0}}>
            <button onClick={onClose} style={{padding:'8px 16px',borderRadius:8,border:`1.5px solid ${J.border}`,background:'transparent',color:J.text,cursor:'pointer',fontSize:12,fontWeight:600}}>Cancel</button>
            <button onClick={save} disabled={!changed||saving} style={{padding:'8px 20px',borderRadius:8,border:'none',background:changed&&!saving?J.teal:J.dim,color:J.white,cursor:changed&&!saving?'pointer':'not-allowed',fontSize:12,fontWeight:700,transition:'background 0.13s'}}>{saving?'⏳ Saving…':'💾 Save'}</button>
          </div>
        </div>
      </div>
  );
}

export default function JobsPage() {
  const [jobs,setJobs]=useState([]);
  const [techs,setTechs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [sel,setSel]=useState(null);
  const [fStatus,setFStatus]=useState('ALL');
  const [fPri,setFPri]=useState('ALL');
  const [search,setSearch]=useState('');
  const [toast,setToast]=useState(null);
  const [page,setPage]=useState(1);
  const PAGE=20;

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const[j,u]=await Promise.all([get('/api/jobs'),get('/api/users')]);
      setJobs(Array.isArray(j)?j:j?.content||[]);
      const users=Array.isArray(u)?u:u?.content||[];
      setTechs(users.filter(usr=>usr.role==='TECHNICIAN'||usr.role==='TEAM_LEAD'));
    }catch(e){console.error(e);}finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  const counts={};
  jobs.forEach(j=>{counts[j.status]=(counts[j.status]||0)+1;});

  const filtered=jobs.filter(j=>{
    if(fStatus!=='ALL'&&j.status!==fStatus)return false;
    if(fPri!=='ALL'&&j.priority!==fPri)return false;
    if(search){const q=search.toLowerCase();if(!(String(j.id).includes(q)||j.assignedTo?.fullName?.toLowerCase().includes(q)||String(j.faultId||'').includes(q)))return false;}
    return true;
  });
  const totalPg=Math.ceil(filtered.length/PAGE);
  const paged=filtered.slice((page-1)*PAGE,page*PAGE);

  useEffect(()=>{
    const id='jb-css';if(document.getElementById(id))return;
    const s=document.createElement('style');s.id=id;
    s.innerHTML=`
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
      @keyframes jb-shim{0%{background-position:200% 0}100%{background-position:-200% 0}}
      @keyframes jb-fin{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      @keyframes jb-sld{from{opacity:0;transform:translateY(-10px)scale(0.98)}to{opacity:1;transform:none}}
      .jb-page *{box-sizing:border-box;font-family:'Nunito',sans-serif;}
      .jb-row:hover td{background:${J.s2}!important;} .jb-row td{cursor:pointer;}
    `;
    document.head.appendChild(s);
  },[]);

  return (
      <div className="jb-page" style={{background:J.bg,minHeight:'100vh',padding:'28px 32px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
          <div>
            <h1 style={{margin:0,fontSize:24,fontWeight:900,color:J.text,letterSpacing:-0.5}}>Job Management</h1>
            <div style={{fontSize:12,color:J.muted,marginTop:3}}>{jobs.length} total · {filtered.length} filtered</div>
          </div>
          <button onClick={load} style={{padding:'8px 16px',borderRadius:8,border:`1.5px solid ${J.border}`,background:J.surface,cursor:'pointer',fontSize:12,fontWeight:700,color:J.text}} onMouseEnter={e=>e.currentTarget.style.borderColor=J.teal} onMouseLeave={e=>e.currentTarget.style.borderColor=J.border}>🔄 Refresh</button>
        </div>

        {/* Stats */}
        <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
          {[{l:'Total',v:jobs.length,c:J.text},{l:'In Progress',v:counts.IN_PROGRESS||0,c:'#C2410C'},{l:'Completed',v:counts.COMPLETED||0,c:J.green},{l:'Cancelled',v:counts.CANCELLED||0,c:J.red}].map((s,i)=>(
              <div key={i} style={{padding:'10px 18px',borderRadius:10,background:J.surface,border:`1px solid ${J.border}`,boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
                <div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.v}</div>
                <div style={{fontSize:10,color:J.muted,marginTop:1}}>{s.l}</div>
              </div>
          ))}
        </div>

        {/* Status chips */}
        <div style={{display:'flex',gap:5,marginBottom:14,flexWrap:'wrap'}}>
          {[['ALL',`All (${jobs.length})`,null],...Object.entries(STATUS).map(([k,v])=>[k,`${v.l} (${counts[k]||0})`,v])].map(([key,label,sc])=>(
              <button key={key} onClick={()=>{setFStatus(key);setPage(1);}} style={{padding:'5px 13px',borderRadius:20,border:`1px solid ${fStatus===key?(sc?sc.d+'44':J.tealD):J.border}`,cursor:'pointer',fontSize:11,fontWeight:700,transition:'all 0.12s',background:fStatus===key?(sc?sc.bg:J.teal):'transparent',color:fStatus===key?(sc?sc.c:J.white):J.muted,boxShadow:fStatus===key?'0 2px 8px rgba(0,0,0,0.1)':'none'}}>{label}</button>
          ))}
        </div>

        {/* Filters */}
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <div style={{position:'relative',flex:1,minWidth:220}}>
            <span style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:J.dim}}>🔍</span>
            <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search by ID, technician, fault ID…" style={{width:'100%',background:J.surface,border:`1.5px solid ${J.border}`,borderRadius:8,padding:'8px 10px 8px 30px',fontSize:12,color:J.text,outline:'none'}} onFocus={e=>e.target.style.borderColor=J.teal} onBlur={e=>e.target.style.borderColor=J.border}/>
          </div>
          <select value={fPri} onChange={e=>{setFPri(e.target.value);setPage(1);}} style={{background:J.surface,border:`1.5px solid ${J.border}`,borderRadius:8,padding:'8px 12px',fontSize:12,color:J.text,outline:'none',cursor:'pointer'}}>
            <option value="ALL">All Priority</option>
            <option value="HIGH">HIGH</option><option value="MEDIUM">MEDIUM</option><option value="LOW">LOW</option>
          </select>
          {(search||fPri!=='ALL')&&<button onClick={()=>{setSearch('');setFPri('ALL');setPage(1);}} style={{padding:'8px 14px',borderRadius:8,border:`1.5px solid ${J.border}`,background:J.surface,cursor:'pointer',fontSize:11,color:J.muted,fontWeight:700}}>✕</button>}
        </div>

        {/* Table */}
        <div style={{background:J.surface,borderRadius:12,border:`1px solid ${J.border}`,overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
            <tr style={{borderBottom:`2px solid ${J.border}`}}>
              {['Job #','Status','Priority','Assigned To','Fault','Duration','Updated',''].map((h,i)=>(
                  <th key={i} style={{padding:'10px 14px',textAlign:'left',background:J.s2,fontSize:10,fontWeight:800,color:J.muted,letterSpacing:0.6}}>{h}</th>
              ))}
            </tr>
            </thead>
            <tbody>
            {loading?[...Array(7)].map((_,i)=><tr key={i}>{[...Array(8)].map((_,j)=><td key={j} style={{padding:'12px 14px',borderBottom:`1px solid ${J.b2}`}}><Skel h={13}/></td>)}</tr>)
                :paged.length===0?<tr><td colSpan={8} style={{padding:'52px 24px',textAlign:'center',color:J.muted}}><div style={{fontSize:36,marginBottom:8}}>📋</div>No jobs found</td></tr>
                    :paged.map((j,i)=>(
                        <tr key={j.id||i} className="jb-row" style={{borderBottom:`1px solid ${J.b2}`,animation:`jb-fin 0.25s ease ${i*0.02}s both`}} onClick={()=>setSel(j)}>
                          <td style={{padding:'11px 14px',fontSize:13,fontWeight:800,color:J.teal}}>#{j.id}</td>
                          <td style={{padding:'11px 14px'}}><Pill status={j.status}/></td>
                          <td style={{padding:'11px 14px'}}>{j.priority?<PriTag priority={j.priority}/>:<span style={{color:J.dim}}>—</span>}</td>
                          <td style={{padding:'11px 14px'}}>{j.assignedTo?<div style={{display:'flex',alignItems:'center',gap:7}}><Avt name={j.assignedTo.fullName} size={24}/><div><div style={{fontSize:12,fontWeight:700,color:J.text}}>{j.assignedTo.fullName}</div><div style={{fontSize:10,color:J.muted}}>{j.assignedTo.phone}</div></div></div>:<span style={{fontSize:11,padding:'2px 7px',borderRadius:4,background:J.redL,color:J.red,fontWeight:700}}>Unassigned</span>}</td>
                          <td style={{padding:'11px 14px',fontSize:11,color:J.muted}}>{j.faultId?`#${j.faultId}`:'—'}</td>
                          <td style={{padding:'11px 14px',fontSize:11,color:J.muted}}>{j.estimatedDurationHours?`${j.estimatedDurationHours}h`:'—'}</td>
                          <td style={{padding:'11px 14px',fontSize:11,color:J.muted}}>{ago(j.updatedAt)}</td>
                          <td style={{padding:'11px 8px'}} onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>setSel(j)} style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${J.border}`,background:'none',cursor:'pointer',fontSize:11,color:J.muted,transition:'all 0.12s'}} onMouseEnter={e=>{e.currentTarget.style.borderColor=J.teal;e.currentTarget.style.color=J.teal;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=J.border;e.currentTarget.style.color=J.muted;}}>Edit</button>
                          </td>
                        </tr>
                    ))}
            </tbody>
          </table>
          {filtered.length>PAGE&&<div style={{padding:'11px 16px',borderTop:`1px solid ${J.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:J.s2}}>
            <span style={{fontSize:12,color:J.muted}}>{(page-1)*PAGE+1}–{Math.min(page*PAGE,filtered.length)} of {filtered.length}</span>
            <div style={{display:'flex',gap:4}}>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:'5px 12px',borderRadius:6,border:`1px solid ${J.border}`,background:J.surface,cursor:'pointer',fontSize:11,color:J.muted}}>‹</button>
              {[...Array(Math.min(totalPg,5))].map((_,i)=><button key={i+1} onClick={()=>setPage(i+1)} style={{padding:'5px 10px',borderRadius:6,border:'none',cursor:'pointer',background:page===i+1?J.teal:'transparent',color:page===i+1?J.white:J.muted,fontSize:11}}>{i+1}</button>)}
              <button onClick={()=>setPage(p=>Math.min(totalPg,p+1))} disabled={page===totalPg} style={{padding:'5px 12px',borderRadius:6,border:`1px solid ${J.border}`,background:J.surface,cursor:'pointer',fontSize:11,color:J.muted}}>›</button>
            </div>
          </div>}
        </div>

        <JobModal job={sel} technicians={techs} open={!!sel} onClose={()=>{setSel(null);load();}} onSaved={(msg,type)=>setToast({msg,type})}/>
        {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      </div>
  );
}