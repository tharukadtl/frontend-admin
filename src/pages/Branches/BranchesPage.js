import React, { useState, useEffect } from 'react';
import { DataTable, StatusBadge, PageHeader, Btn, Modal, FormField, inputStyle } from '../../components/index';
import branchApi from '../../api/branches';

const EMPTY = { name: '', code: '', address: '', phone: '', managerName: '', district: '' };

export default function BranchesPage() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);

  useEffect(() => { loadBranches(); }, []);

  const loadBranches = async () => {
    setLoading(true);
    try { const res = await branchApi.getAll(); setBranches(res.data || []); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal('form'); };
  const openEdit   = (b) => {
    setForm({ name: b.name, code: b.code, address: b.address, phone: b.phone,
              managerName: b.managerName, district: b.district });
    setEditId(b.id); setModal('form');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!editId) await branchApi.create(form);
      else         await branchApi.update(editId, form);
      setModal(null); loadBranches();
    } catch (err) { alert(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this branch?')) return;
    try { await branchApi.deactivate(id); loadBranches(); }
    catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const columns = [
    { key: 'name',        label: 'Branch Name' },
    { key: 'code',        label: 'Code' },
    { key: 'district',    label: 'District' },
    { key: 'managerName', label: 'Manager', render: v => v || '—' },
    { key: 'phone',       label: 'Phone' },
    { key: 'isActive',    label: 'Status', render: v => <StatusBadge status={v !== false ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'id', label: 'Actions', render: (id, row) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn small onClick={e => { e.stopPropagation(); openEdit(row); }}>Edit</Btn>
        {row.isActive !== false && (
          <Btn small color="#c62828" onClick={e => { e.stopPropagation(); handleDeactivate(id); }}>Deactivate</Btn>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Branches" subtitle="Super Admin only — branch management"
        actions={<Btn onClick={openCreate}>+ Add Branch</Btn>} />

      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
          : <DataTable columns={columns} data={branches} />}
      </div>

      {modal && (
        <Modal title={editId ? 'Edit Branch' : 'Add Branch'} onClose={() => setModal(null)}>
          {[['name','Branch Name',true],['code','Branch Code',true],['district','District',false],
            ['address','Address',false],['phone','Phone',false],['managerName','Manager Name',false]
          ].map(([key, label, req]) => (
            <FormField key={key} label={label} required={req}>
              <input style={inputStyle} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
            </FormField>
          ))}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn color="#757575" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
