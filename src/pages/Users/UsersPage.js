import React, { useState, useEffect } from 'react';
import { DataTable, StatusBadge, PageHeader, Btn, Modal, FormField, inputStyle } from '../../components/index';
import userApi from '../../api/users';
import branchApi from '../../api/branches';

const ROLES = ['ADMIN', 'TEAM_LEAD', 'TECHNICIAN'];
const EMPTY = { fullName: '', username: '', email: '', phone: '', role: 'TECHNICIAN', branchId: '', password: '' };

export default function UsersPage() {
  const [users, setUsers]     = useState([]);
  const [branches, setBranches] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // null | 'create' | 'edit'
  const [form, setForm]       = useState(EMPTY);
  const [editId, setEditId]   = useState(null);
  const [filter, setFilter]   = useState({ role: '', search: '' });
  const [saving, setSaving]   = useState(false);

  useEffect(() => { loadUsers(); loadBranches(); }, []);
  useEffect(() => { applyFilter(); }, [users, filter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await userApi.getAll({ size: 200 });
      setUsers(res.data?.content || res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadBranches = async () => {
    try {
      const res = await branchApi.getAll();
      setBranches(res.data || []);
    } catch (err) { console.error(err); }
  };

  const applyFilter = () => {
    let list = [...users];
    if (filter.role) list = list.filter(u => u.role === filter.role);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(u =>
        u.fullName?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  };

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal('create'); };
  const openEdit   = (u) => {
    setForm({ fullName: u.fullName, username: u.username, email: u.email,
              phone: u.phone, role: u.role, branchId: u.branchId || '', password: '' });
    setEditId(u.id);
    setModal('edit');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal === 'create') await userApi.create(form);
      else                    await userApi.update(editId, form);
      setModal(null);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this user?')) return;
    try { await userApi.deactivate(id); loadUsers(); }
    catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const columns = [
    { key: 'fullName',   label: 'Full Name' },
    { key: 'username',   label: 'Username' },
    { key: 'role',       label: 'Role', render: v => (
      <span style={{ background: '#e8eaf6', color: '#283593', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>{v}</span>
    )},
    { key: 'branchName', label: 'Branch', render: v => v || '—' },
    { key: 'email',      label: 'Email' },
    { key: 'phone',      label: 'Phone' },
    { key: 'isActive',   label: 'Status', render: v => <StatusBadge status={v !== false ? 'ACTIVE' : 'INACTIVE'} /> },
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
      <PageHeader title="Users" subtitle={`${filtered.length} users`}
        actions={<Btn onClick={openCreate}>+ Add User</Btn>} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input placeholder="Search name, username, email..."
          value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })}
          style={{ ...inputStyle, width: 280 }} />
        <select value={filter.role} onChange={e => setFilter({ ...filter, role: e.target.value })}
          style={{ ...inputStyle, width: 160 }}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
        </select>
        <Btn small color="#757575" onClick={() => setFilter({ role: '', search: '' })}>Clear</Btn>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
          : <DataTable columns={columns} data={filtered} />}
      </div>

      {modal && (
        <Modal title={modal === 'create' ? 'Add New User' : 'Edit User'} onClose={() => setModal(null)}>
          <FormField label="Full Name" required>
            <input style={inputStyle} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
          </FormField>
          <FormField label="Username" required>
            <input style={inputStyle} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} disabled={modal === 'edit'} />
          </FormField>
          <FormField label="Email">
            <input type="email" style={inputStyle} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </FormField>
          <FormField label="Phone">
            <input style={inputStyle} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </FormField>
          <FormField label="Role" required>
            <select style={inputStyle} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
            </select>
          </FormField>
          <FormField label="Branch">
            <select style={inputStyle} value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value })}>
              <option value="">-- No Branch --</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </FormField>
          {modal === 'create' && (
            <FormField label="Password" required>
              <input type="password" style={inputStyle} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </FormField>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn color="#757575" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
