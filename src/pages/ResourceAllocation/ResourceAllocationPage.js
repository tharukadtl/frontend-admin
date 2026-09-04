import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// ─── API ──────────────────────────────────────────────────────────────────────
const API   = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const token = () => localStorage.getItem('accessToken');
const req   = (method, path, body) =>
    fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token()}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then(r => {
      if (!r.ok) return r.json().then(e => { throw new Error(e?.message || `${r.status}`); });
      return r.json();
    });
const get  = path      => req('GET',  path);
const post = (path, b) => req('POST', path, b);

// ─── Palette (matches FaultsPage's dark theme) ─────────────────────────────────
const C = {
  bg:       '#0D1117',
  surface:  '#161B22',
  surface2: '#1C2333',
  border:   '#30363D',
  text:     '#E6EDF3',
  muted:    '#7D8590',
  accent:   '#58A6FF',
  accentD:  '#1F6FEB',
  green:    '#3FB950',
  orange:   '#D29922',
  red:      '#F85149',
  purple:   '#BC8CFF',
};

const inputStyle = {
  width: '100%', background: C.surface2, border: `1px solid ${C.border}`,
  borderRadius: 8, color: C.text, fontSize: 13, padding: '9px 12px',
  outline: 'none', fontFamily: 'DM Mono,monospace',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SRS 5.5.3 (v1.9) — OPMC pool -> Work Group allocation. The OPMC pool itself is
// Material.currentStock (already OPMC-scoped); this page is only the middle tier
// an Admin allocates from that pool into a Work Group's balance, which the Work
// Group's Team Lead then distributes from via the mobile Material Request flow.
// ═══════════════════════════════════════════════════════════════════════════════
export default function ResourceAllocationPage() {
  const { user: currentUser } = useAuth();
  const [workGroups,  setWorkGroups]  = useState([]);
  const [materials,   setMaterials]   = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [toast,       setToast]       = useState(null);

  const [wgId,     setWgId]     = useState('');
  const [matId,    setMatId]    = useState('');
  const [quantity, setQuantity] = useState('');
  const [allocating, setAllocating] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const wgPath = currentUser?.role === 'SUPER_ADMIN'
          ? '/api/workgroups'
          : `/api/workgroups?opmcId=${currentUser?.opmcId}`;
      const [wg, mats] = await Promise.all([
        get(wgPath),
        get('/api/inventory/stock/levels'),
      ]);
      setWorkGroups(Array.isArray(wg) ? wg.filter(w => w.isActive) : []);
      setMaterials(Array.isArray(mats) ? mats : []);
    } catch (e) {
      console.error('Resource allocation fetch error:', e);
    } finally { setLoading(false); }
  }, [currentUser]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!wgId) { setAllocations([]); return; }
    get(`/api/resource-allocations/work-group/${wgId}`)
        .then(a => setAllocations(Array.isArray(a) ? a : []))
        .catch(() => setAllocations([]));
  }, [wgId, allocating]);

  const selectedWorkGroup = workGroups.find(w => String(w.id) === String(wgId));

  const doAllocate = async () => {
    if (!wgId || !matId || !quantity || Number(quantity) <= 0) return;
    setAllocating(true);
    try {
      await post('/api/resource-allocations', {
        workGroupId: Number(wgId),
        materialId: Number(matId),
        quantity: Number(quantity),
      });
      showToast(`Allocated ${quantity} to ${selectedWorkGroup?.name}`, 'success');
      setQuantity('');
      setMatId('');
      await fetchAll();
    } catch (e) {
      showToast(e.message || 'Allocation failed', 'error');
    } finally { setAllocating(false); }
  };

  const selectedMaterial = materials.find(m => String(m.materialId) === String(matId));

  return (
      <div style={{ background: C.bg, minHeight: '100vh', padding: 28, fontFamily: 'DM Mono,monospace' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: C.text, fontSize: 22, fontWeight: 700, margin: 0, fontFamily: 'Bricolage Grotesque,sans-serif' }}>
            Resource Allocation
          </h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>
            Allocate materials from the OPMC pool to a Work Group. Its Team Lead then distributes
            from that allocation to themself or a Technician via the mobile Material Request flow.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>

          {/* ── Allocate form ──────────────────────────────────────────── */}
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20,
            height: 'fit-content',
          }}>
            <h3 style={{ color: C.text, fontSize: 14, margin: '0 0 16px' }}>Allocate to Work Group</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5 }}>
                  WORK GROUP *
                </label>
                <select value={wgId} onChange={e => setWgId(e.target.value)} style={inputStyle}>
                  <option value="">— Select Work Group —</option>
                  {workGroups.map(wg => (
                      <option key={wg.id} value={wg.id}>
                        {wg.name} ({wg.opmcName})
                      </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5 }}>
                  MATERIAL *
                </label>
                <select value={matId} onChange={e => setMatId(e.target.value)} style={inputStyle}>
                  <option value="">— Select material —</option>
                  {materials.map(m => (
                      <option key={m.materialId} value={m.materialId}>
                        {m.materialName} — {m.currentStock} {m.unit} in OPMC pool
                      </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5 }}>
                  QUANTITY *{selectedMaterial ? ` (${selectedMaterial.unit})` : ''}
                </label>
                <input
                    type="number" min="0.001" step="0.001"
                    value={quantity} onChange={e => setQuantity(e.target.value)}
                    placeholder="0"
                    style={inputStyle}
                />
              </div>
              <button
                  onClick={doAllocate}
                  disabled={!wgId || !matId || !quantity || allocating}
                  style={{
                    padding: '10px 16px', borderRadius: 8, border: 'none',
                    background: (!wgId || !matId || !quantity || allocating) ? C.border : C.accentD,
                    color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: (!wgId || !matId || !quantity || allocating) ? 'not-allowed' : 'pointer',
                  }}
              >
                {allocating ? '⏳ Allocating…' : '📦 Allocate'}
              </button>
            </div>
          </div>

          {/* ── Current allocations for selected Work Group ───────────────── */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ color: C.text, fontSize: 14, margin: '0 0 16px' }}>
              {selectedWorkGroup ? `${selectedWorkGroup.name}'s Current Allocations` : 'Select a Work Group to view its allocations'}
            </h3>
            {loading ? (
                <div style={{ color: C.muted, fontSize: 13 }}>Loading…</div>
            ) : !wgId ? (
                <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: 40 }}>
                  Pick a Work Group on the left to see what's currently allocated to it.
                </div>
            ) : allocations.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: 40 }}>
                  No materials allocated to this Work Group yet.
                </div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                  <tr>
                    {['Material', 'Allocated', 'OPMC Pool Remaining', 'Updated'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '8px 10px', fontSize: 11, color: C.muted,
                          borderBottom: `1px solid ${C.border}`, fontWeight: 700,
                        }}>{h}</th>
                    ))}
                  </tr>
                  </thead>
                  <tbody>
                  {allocations.map(a => (
                      <tr key={a.materialId}>
                        <td style={{ padding: '10px', fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}` }}>
                          {a.materialName}
                        </td>
                        <td style={{ padding: '10px', fontSize: 13, color: C.green, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>
                          {a.allocatedQuantity}
                        </td>
                        <td style={{ padding: '10px', fontSize: 13, color: C.muted, borderBottom: `1px solid ${C.border}` }}>
                          {a.opmcRemainingStock}
                        </td>
                        <td style={{ padding: '10px', fontSize: 12, color: C.muted, borderBottom: `1px solid ${C.border}` }}>
                          {a.updatedAt ? new Date(a.updatedAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                  ))}
                  </tbody>
                </table>
            )}
          </div>
        </div>

        {toast && (
            <div style={{
              position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
              padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: toast.type === 'error' ? '#3D1F1F' : '#1C2D1C',
              color: toast.type === 'error' ? C.red : C.green,
              border: `1px solid ${toast.type === 'error' ? C.red : C.green}33`,
            }}>
              {toast.msg}
            </div>
        )}
      </div>
  );
}
