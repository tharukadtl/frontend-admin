import React, { useState, useEffect, useCallback } from 'react';
import { useNotificationSocket } from '../../context/NotificationSocketContext';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const tok = () => localStorage.getItem('accessToken');
const req = (method, path, body) =>
    fetch(`${API}${path}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: body ? JSON.stringify(body) : undefined,
    }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });
const get  = p      => req('GET',  p);
const post = (p, b) => req('POST', p, b);

// ─── Deep blue-black palette with vivid type-colour coding ───────────────────
const N = {
  bg:'#0F1923', panel:'#16232F', surface:'#1C2E3E', lift:'#223444',
  border:'#2A3E52', b2:'#1E3040',
  text:'#D0E8FF', muted:'#4E6880', dim:'#2E4860',
  cyan:'#00D4FF', cyanL:'#002830',
  green:'#00C878', greenL:'#002818',
  orange:'#FF8C42', orangeL:'#201208',
  red:'#FF4D6A', redL:'#20080E',
  violet:'#A78BFA', violetL:'#160E28',
  amber:'#FFBA08', amberL:'#1E1600',
  sky:'#38BDF8', skyL:'#0C2030',
  white:'#FFFFFF',
};

const TYPE_CFG = {
  FAULT_ASSIGNED:       { icon:'🔧', color:N.cyan,   bg:N.cyanL,   label:'Job Assigned'      },
  FAULT_REPORTED:       { icon:'📋', color:N.cyan,   bg:N.cyanL,   label:'New Fault'         },
  FAULT_COMPLETED:      { icon:'✅', color:N.green,  bg:N.greenL,  label:'Completed'         },
  FAULT_ESCALATED:      { icon:'⚠️', color:N.red,    bg:N.redL,    label:'Escalated'         },
  FAULT_UPDATE:         { icon:'🔄', color:N.amber,  bg:N.amberL,  label:'Fault Update'      },
  FAULT_REASSIGNED:     { icon:'🔁', color:N.violet, bg:N.violetL, label:'Reassigned'        },
  PAYMENT_APPROVED:     { icon:'💰', color:N.green,  bg:N.greenL,  label:'Payment Approved'  },
  PAYMENT_REJECTED:     { icon:'❌', color:N.red,    bg:N.redL,    label:'Payment Rejected'  },
  PAYMENT_SUBMITTED:    { icon:'📤', color:N.amber,  bg:N.amberL,  label:'Payment Submitted' },
  MATERIAL_REQUEST:     { icon:'📦', color:N.orange, bg:N.orangeL, label:'Material Request'  },
  MATERIAL_DELIVERED:   { icon:'📬', color:N.green,  bg:N.greenL,  label:'Delivered'         },
  MATERIAL_REQUEST_APPROVED:{ icon:'✅',color:N.green,bg:N.greenL, label:'Request Approved'  },
  MATERIAL_REQUEST_REJECTED:{ icon:'❌',color:N.red,  bg:N.redL,   label:'Request Rejected'  },
  ATTENDANCE_CHECK_IN:  { icon:'🟢', color:N.green,  bg:N.greenL,  label:'Check-In'          },
  ATTENDANCE_CHECK_OUT: { icon:'🔴', color:N.muted,  bg:N.surface, label:'Check-Out'         },
  STOCK_ALERT:          { icon:'⚠️', color:N.orange, bg:N.orangeL, label:'Stock Alert'       },
  TECHNICIAN_ASSIGNED:  { icon:'👷', color:N.sky,    bg:N.skyL,    label:'Tech Assigned'     },
  DEFAULT:              { icon:'📌', color:N.muted,  bg:N.surface, label:'Notification'      },
};

const timeAgo = d => {
  if (!d) return '—';
  const s = Math.floor((Date.now()-new Date(d))/1000);
  if (s<60) return `${s}s ago`;
  if (s<3600) return `${Math.floor(s/60)}m ago`;
  if (s<86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};

const Skel = ({h=14,w='100%',r=6}) => (
    <div style={{height:h,width:w,borderRadius:r,background:`linear-gradient(90deg,${N.surface} 25%,${N.lift} 50%,${N.surface} 75%)`,backgroundSize:'400% 100%',animation:'nt-shim 1.4s ease infinite'}}/>
);

export default function NotificationsPage() {
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [fType,   setFType]   = useState('ALL');
  const [fRead,   setFRead]   = useState('ALL');
  const [search,  setSearch]  = useState('');
  const [marking, setMarking] = useState(new Set());
  const { liveNotifications, connected } = useNotificationSocket();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await get('/api/notifications');
      setNotifs(Array.isArray(d) ? d : d?.content || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live push notifications (e.g. payment submitted) arrive over the admin
  // WebSocket and are never persisted server-side — merge them into the
  // list as they come in rather than waiting for the next manual refresh.
  useEffect(() => {
    if (liveNotifications.length === 0) return;
    setNotifs(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      const toAdd = liveNotifications.filter(n => !existingIds.has(n.id));
      return toAdd.length ? [...toAdd, ...prev] : prev;
    });
  }, [liveNotifications]);

  const markRead = async (id) => {
    setMarking(s => new Set([...s, id]));
    try {
      // Live-pushed notifications have a synthetic id and no backend row.
      if (!String(id).startsWith('ws-')) {
        await post(`/api/notifications/${id}/read`, {});
      }
      setNotifs(ns => ns.map(n => n.id === id ? { ...n, read:true, isRead:true } : n));
    } catch {}
    finally { setMarking(s => { const ns = new Set(s); ns.delete(id); return ns; }); }
  };

  const markAllRead = async () => {
    const unread = notifs.filter(n => !n.read && !n.isRead);
    for (const n of unread) await markRead(n.id);
  };

  const isRead = n => n.read || n.isRead || n.readAt != null;
  const unreadCount = notifs.filter(n => !isRead(n)).length;

  // Dynamic type list
  const allTypes = [...new Set(
      notifs.map(n => n.type || n.notificationType || n.notifType).filter(Boolean)
  )];

  const filtered = notifs.filter(n => {
    const type = n.type || n.notificationType || n.notifType || '';
    if (fType !== 'ALL' && type !== fType) return false;
    if (fRead === 'UNREAD' && isRead(n)) return false;
    if (fRead === 'READ' && !isRead(n)) return false;
    if (search) {
      const q = search.toLowerCase();
      const msg = n.title || n.message || n.body || n.description || '';
      if (!msg.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  useEffect(() => {
    const id = 'nt-css'; if (document.getElementById(id)) return;
    const s = document.createElement('style'); s.id = id;
    s.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
      @keyframes nt-shim{0%{background-position:200% 0}100%{background-position:-200% 0}}
      @keyframes nt-fin{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
      @keyframes nt-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.4)}}
      .nt-page *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
      ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:${N.bg}}
      ::-webkit-scrollbar-thumb{background:${N.border};border-radius:4px}
    `;
    document.head.appendChild(s);
  }, []);

  return (
      <div className="nt-page" style={{ background:N.bg, minHeight:'100vh', padding:'28px 32px' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <h1 style={{ margin:0, fontSize:24, fontWeight:800, color:N.text }}>Notifications</h1>
              {unreadCount > 0 && (
                  <span style={{
                    padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:800,
                    background:N.cyan, color:N.bg,
                    boxShadow:`0 0 10px ${N.cyan}66`,
                  }}>{unreadCount} new</span>
              )}
              <span style={{
                display:'flex', alignItems:'center', gap:5,
                fontSize:10, fontWeight:700, color: connected ? N.green : N.muted,
              }}>
                <span style={{
                  width:6, height:6, borderRadius:'50%',
                  background: connected ? N.green : N.muted,
                }} />
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            <div style={{ fontSize:12, color:N.muted }}>{notifs.length} total notifications</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {unreadCount > 0 && (
                <button onClick={markAllRead} style={{
                  padding:'8px 16px', borderRadius:8,
                  background:N.cyanL, border:`1.5px solid ${N.cyan}55`,
                  color:N.cyan, cursor:'pointer', fontSize:12, fontWeight:700,
                }}>✓ Mark All Read</button>
            )}
            <button onClick={load} style={{
              padding:'8px 16px', borderRadius:8,
              background:N.panel, border:`1.5px solid ${N.border}`,
              color:N.text, cursor:'pointer', fontSize:12, fontWeight:700,
            }}>🔄 Refresh</button>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{
          background:N.panel, borderRadius:12, border:`1px solid ${N.border}`,
          padding:'14px 16px', marginBottom:20,
          display:'flex', gap:10, flexWrap:'wrap', alignItems:'center',
        }}>
          {/* Read filter */}
          <div style={{ display:'flex', border:`1px solid ${N.border}`, borderRadius:8, overflow:'hidden' }}>
            {[['ALL','All'],['UNREAD','Unread'],['READ','Read']].map(([v,l]) => (
                <button key={v} onClick={() => setFRead(v)} style={{
                  padding:'6px 14px', border:'none', cursor:'pointer',
                  fontSize:11, fontWeight:700,
                  background: fRead===v ? N.cyan : 'transparent',
                  color:       fRead===v ? N.bg   : N.muted,
                  transition:'all 0.12s',
                }}>{l}</button>
            ))}
          </div>

          {/* Type filter */}
          <select value={fType} onChange={e => setFType(e.target.value)} style={{
            background:N.surface, border:`1.5px solid ${N.border}`,
            borderRadius:8, padding:'7px 12px', fontSize:11,
            color:N.text, outline:'none', cursor:'pointer',
          }}>
            <option value="ALL">All Types</option>
            {allTypes.map(t => (
                <option key={t} value={t}>
                  {(TYPE_CFG[t] || TYPE_CFG.DEFAULT).label}
                </option>
            ))}
          </select>

          {/* Search */}
          <div style={{ position:'relative', flex:1, minWidth:200 }}>
            <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:N.muted }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
                   placeholder="Search notification messages…"
                   style={{
                     width:'100%', background:N.surface, border:`1.5px solid ${N.border}`,
                     borderRadius:8, padding:'7px 10px 7px 28px',
                     fontSize:12, color:N.text, outline:'none',
                   }}
                   onFocus={e => e.target.style.borderColor = N.cyan}
                   onBlur={e => e.target.style.borderColor = N.border}
            />
          </div>

          <div style={{ marginLeft:'auto', fontSize:11, color:N.dim }}>
            {filtered.length} shown
          </div>
        </div>

        {/* Type legend chips */}
        {allTypes.length > 0 && (
            <div style={{ display:'flex', gap:5, marginBottom:16, flexWrap:'wrap' }}>
              {allTypes.slice(0, 10).map(t => {
                const cfg = TYPE_CFG[t] || TYPE_CFG.DEFAULT;
                const cnt = notifs.filter(n => (n.type||n.notificationType||'') === t).length;
                return (
                    <button key={t} onClick={() => setFType(fType===t?'ALL':t)} style={{
                      padding:'4px 10px', borderRadius:20,
                      border:`1px solid ${fType===t?cfg.color:N.border}`,
                      background: fType===t ? cfg.bg : 'transparent',
                      color: fType===t ? cfg.color : N.muted,
                      cursor:'pointer', fontSize:10, fontWeight:700, transition:'all 0.12s',
                    }}>
                      {cfg.icon} {cfg.label} ({cnt})
                    </button>
                );
              })}
              {fType !== 'ALL' && (
                  <button onClick={() => setFType('ALL')} style={{
                    padding:'4px 10px', borderRadius:20, border:`1px solid ${N.border}`,
                    background:'none', color:N.muted, cursor:'pointer', fontSize:10, fontWeight:700,
                  }}>✕ All types</button>
              )}
            </div>
        )}

        {/* List */}
        {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[...Array(6)].map((_, i) => (
                  <div key={i} style={{ background:N.panel, borderRadius:12, padding:16, border:`1px solid ${N.border}`, display:'flex', gap:12 }}>
                    <Skel h={40} w={40} r={12}/>
                    <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                      <Skel h={13} w="50%"/>
                      <Skel h={11} w="80%"/>
                      <Skel h={9} w="25%"/>
                    </div>
                  </div>
              ))}
            </div>
        ) : filtered.length === 0 ? (
            <div style={{
              textAlign:'center', padding:'64px 24px',
              background:N.panel, borderRadius:12, border:`1px solid ${N.border}`,
            }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🔔</div>
              <div style={{ fontSize:16, fontWeight:700, color:N.text, marginBottom:4 }}>
                {fRead === 'UNREAD' ? "You're all caught up!" : 'No notifications found'}
              </div>
              <div style={{ fontSize:12, color:N.muted }}>
                {fRead === 'UNREAD' ? 'No unread notifications' : 'Try adjusting your filters'}
              </div>
            </div>
        ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {filtered.map((n, i) => {
                const type  = n.type || n.notificationType || n.notifType || 'DEFAULT';
                const cfg   = TYPE_CFG[type] || TYPE_CFG.DEFAULT;
                const unread = !isRead(n);
                const busy   = marking.has(n.id);
                const msg    = n.title || n.message || n.body || n.description || 'Notification';
                const detail = n.message || n.body || n.description || '';

                return (
                    <div key={n.id || i} style={{
                      background: unread ? N.panel : N.bg,
                      borderRadius:12, padding:'14px 16px',
                      border:`1px solid ${unread ? cfg.color+'33' : N.border}`,
                      display:'flex', alignItems:'flex-start', gap:12,
                      transition:'all 0.15s',
                      boxShadow: unread ? `0 2px 12px ${cfg.color}0A` : 'none',
                      animation:`nt-fin 0.3s ease ${i*0.02}s both`,
                      position:'relative',
                    }}>
                      {/* Unread pulse dot */}
                      {unread && (
                          <div style={{
                            position:'absolute', top:10, left:10,
                            width:7, height:7, borderRadius:'50%',
                            background:cfg.color, boxShadow:`0 0 8px ${cfg.color}88`,
                            animation:'nt-pulse 2s ease infinite',
                          }}/>
                      )}

                      {/* Icon */}
                      <div style={{
                        width:44, height:44, borderRadius:11, flexShrink:0,
                        background:`${cfg.color}15`, border:`1px solid ${cfg.color}33`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:20, marginLeft: unread ? 14 : 0,
                      }}>
                        {cfg.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                          <div style={{
                            fontSize:13, fontWeight: unread ? 800 : 600, color:N.text,
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:8,
                          }}>
                            {n.title || msg}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0 }}>
                      <span style={{
                        padding:'2px 7px', borderRadius:20, fontSize:9, fontWeight:800,
                        background:cfg.bg, color:cfg.color,
                        border:`1px solid ${cfg.color}44`, whiteSpace:'nowrap',
                      }}>
                        {cfg.label}
                      </span>
                            <span style={{ fontSize:10, color:N.muted, whiteSpace:'nowrap' }}>
                        {timeAgo(n.createdAt || n.sentAt || n.timestamp)}
                      </span>
                          </div>
                        </div>

                        {detail && detail !== n.title && (
                            <div style={{
                              fontSize:12, color:N.muted, lineHeight:1.5,
                              overflow:'hidden', display:'-webkit-box',
                              WebkitLineClamp:2, WebkitBoxOrient:'vertical',
                              marginBottom:6,
                            }}>
                              {detail}
                            </div>
                        )}

                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {n.actorName && (
                              <span style={{
                                fontSize:10, padding:'1px 6px', borderRadius:4,
                                background:N.surface, border:`1px solid ${N.border}`, color:N.muted,
                              }}>👤 {n.actorName}</span>
                          )}
                          {(n.entityType || n.entityId) && (
                              <span style={{
                                fontSize:10, padding:'1px 6px', borderRadius:4,
                                background:N.surface, border:`1px solid ${N.border}`, color:N.muted,
                              }}>
                        {n.entityType} {n.entityId ? `#${n.entityId}` : ''}
                      </span>
                          )}
                          {unread && (
                              <button onClick={() => markRead(n.id)} disabled={busy} style={{
                                background:'none', border:'none', cursor:'pointer',
                                fontSize:10, color:cfg.color, fontWeight:700,
                                padding:0, opacity:busy?0.5:1,
                              }}>
                                {busy ? '…' : '✓ Mark read'}
                              </button>
                          )}
                          {!unread && (
                              <span style={{ fontSize:10, color:N.dim }}>✓ Read</span>
                          )}
                        </div>
                      </div>
                    </div>
                );
              })}
            </div>
        )}
      </div>
  );
}