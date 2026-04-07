import React, { useState, useEffect } from 'react';
import { DataTable, StatusBadge, PageHeader, Btn, Modal, FormField, inputStyle } from '../../components/index';
import faultApi from '../../api/faults';
import userApi from '../../api/users';

export default function FaultsPage() {
  const [faults, setFaults]       = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [teamLeads, setTeamLeads] = useState([]);
  const [assignModal, setAssignModal] = useState(null);
  const [assignTlId, setAssignTlId]   = useState('');
  const [filter, setFilter]       = useState({ status: '', search: '' });

  useEffect(() => { loadFaults(); loadTeamLeads(); }, []);
  useEffect(() => { applyFilter(); }, [faults, filter]);

  const loadFaults = async () => {
    setLoading(true);
    try {
      const res = await faultApi.getAll({ size: 200 });
      const data = res.data?.content || res.data || [];
      setFaults(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadTeamLeads = async () => {
    try {
      const res = await userApi.getByRole('TEAM_LEAD');
      setTeamLeads(res.data?.content || res.data || []);
    } catch (err) { console.error(err); }
  };

  const applyFilter = () => {
    let list = [...faults];
    if (filter.status) list = list.filter(f => f.status === filter.status);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(f =>
        f.faultNumber?.toLowerCase().includes(q) ||
        f.customerName?.toLowerCase().includes(q) ||
        f.category?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  };

  const handleAssign = async () => {
    if (!assignTlId) return;
    try {
      await faultApi.assign(assignModal.id, assignTlId);
      setAssignModal(null);
      setAssignTlId('');
      loadFaults();
    } catch (err) { alert(err.response?.data?.message || 'Assign failed'); }
  };

  const columns = [
    { key: 'faultNumber',   label: 'Fault #' },
    { key: 'customerName',  label: 'Customer' },
    { key: 'category',      label: 'Category' },
    { key: 'priority',      label: 'Priority', render: v => (
      <span style={{ color: v === 'HIGH' ? '#c62828' : v === 'MEDIUM' ? '#e65100' : '#1b5e20', fontWeight: 600 }}>{v}</span>
    )},
    { key: 'status',        label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'assignedTeamLeadName', label: 'Assigned To', render: v => v || 'Unassigned' },
    { key: 'reportedAt',    label: 'Reported', render: v => v?.slice(0,10) },
    { key: 'id', label: 'Actions', render: (_, row) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn small onClick={e => { e.stopPropagation(); setSelected(row); }}>View</Btn>
        {['REPORTED','PENDING'].includes(row.status) && (
          <Btn small color="#1b5e20" onClick={e => { e.stopPropagation(); setAssignModal(row); }}>Assign</Btn>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Faults" subtitle={`${filtered.length} faults`} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input placeholder="Search fault #, customer, category..."
          value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })}
          style={{ ...inputStyle, width: 280 }} />
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}
          style={{ ...inputStyle, width: 160 }}>
          <option value="">All Statuses</option>
          {['REPORTED','ASSIGNED','IN_PROGRESS','HOLD','COMPLETED','CANCELLED'].map(s =>
            <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
          )}
        </select>
        <Btn onClick={() => setFilter({ status: '', search: '' })} color="#757575" small>Clear</Btn>
        <Btn onClick={loadFaults} small>↻ Refresh</Btn>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Loading...</div>
          : <DataTable columns={columns} data={filtered} onRowClick={setSelected} />}
      </div>

      {/* Detail Modal */}
      {selected && (
        <Modal title={`Fault — ${selected.faultNumber}`} onClose={() => setSelected(null)} width={620}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
            {[
              ['Customer',    selected.customerName],
              ['Category',    selected.category],
              ['Priority',    selected.priority],
              ['Status',      selected.status],
              ['Branch',      selected.branchName],
              ['Reported At', selected.reportedAt?.slice(0,10)],
              ['Assigned To', selected.assignedTeamLeadName || 'Unassigned'],
              ['Location',    selected.locationCity],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {label === 'Status' ? <StatusBadge status={val} /> : (val || '—')}
                </div>
              </div>
            ))}
          </div>
          {selected.description && (
            <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>Description</div>
              <div style={{ fontSize: 14 }}>{selected.description}</div>
            </div>
          )}
        </Modal>
      )}

      {/* Assign Modal */}
      {assignModal && (
        <Modal title={`Assign Fault — ${assignModal.faultNumber}`} onClose={() => setAssignModal(null)}>
          <FormField label="Select Team Lead" required>
            <select value={assignTlId} onChange={e => setAssignTlId(e.target.value)} style={inputStyle}>
              <option value="">-- Select Team Lead --</option>
              {teamLeads.map(tl => (
                <option key={tl.id} value={tl.id}>{tl.fullName} — {tl.branchName}</option>
              ))}
            </select>
          </FormField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn color="#757575" onClick={() => setAssignModal(null)}>Cancel</Btn>
            <Btn color="#1b5e20" onClick={handleAssign} disabled={!assignTlId}>Confirm Assign</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
