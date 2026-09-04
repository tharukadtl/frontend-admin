import React, { useState, useEffect } from 'react';
import { DataTable, StatusBadge, PageHeader, Btn, Modal, FormField, inputStyle } from '../../components/index';
import userApi from '../../api/users';
import opmcApi from '../../api/opmc';
import api from '../../api/axios';

const ROLES = ['ADMIN', 'TEAM_LEAD', 'TECHNICIAN'];
const WORKGROUP_ROLES = ['TECHNICIAN', 'TEAM_LEAD'];
const EMPTY = { fullName: '', username: '', email: '', phone: '', role: 'TECHNICIAN', opmcId: '', workgroupId: '', password: '' };

export default function UsersPage() {
  const [users, setUsers]     = useState([]);
  const [opmcs, setOpmcs] = useState([]);
  const [workgroups, setWorkgroups]   = useState([]);
  const [wgLoading, setWgLoading]     = useState(false);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // null | 'create' | 'edit' | 'import'
  const [form, setForm]       = useState(EMPTY);
  const [editId, setEditId]   = useState(null);
  const [filter, setFilter]   = useState({ role: '', search: '' });
  const [saving, setSaving]   = useState(false);
  const [importFile, setImportFile]   = useState(null);
  const [importing, setImporting]     = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => { loadUsers(); loadOpmcs(); }, []);
  useEffect(() => { applyFilter(); }, [users, filter]);

  // Cascade: Opmc -> Work Group, same pattern as FaultsPage.js's Circuit picker cascade —
  // fetch whenever the modal's selected OPMC changes (including the initial value set by
  // openEdit/openCreate), scoped to only the current OPMC's Work Groups. Only fetches while
  // the create/edit modal is actually open, matching the Circuit picker's own `open` guard.
  useEffect(() => {
    if (!(modal === 'create' || modal === 'edit')) return;
    if (!form.opmcId) { setWorkgroups([]); return; }
    setWgLoading(true);
    api.get('/workgroups', { params: { opmcId: form.opmcId } })
      .then(res => setWorkgroups(Array.isArray(res.data) ? res.data : []))
      .catch(() => setWorkgroups([]))
      .finally(() => setWgLoading(false));
  }, [modal, form.opmcId]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await userApi.getAll({ size: 200 });
      setUsers(res.data?.content || res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadOpmcs = async () => {
    try {
      const res = await opmcApi.getAll();
      setOpmcs(res.data || []);
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
  const openImport = () => { setImportFile(null); setImportResult(null); setModal('import'); };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await userApi.bulkImport(importFile);
      setImportResult(result);
      loadUsers();
    } catch (err) {
      setImportResult({ totalRows: 0, successCount: 0, failureCount: 0, createdUsernames: [], errors: [err.message || 'Import failed'] });
    } finally {
      setImporting(false);
    }
  };

  const openEdit   = (u) => {
    setForm({ fullName: u.fullName, username: u.username, email: u.email,
              phone: u.phone, role: u.role, opmcId: u.opmcId || '',
              workgroupId: u.workgroupId || '', password: '' });
    setEditId(u.id);
    setModal('edit');
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) return alert('Full Name is required.');
    if (!form.username.trim()) return alert('Username is required.');
    if (modal === 'create' && !form.password) return alert('Password is required.');
    // Mirrors the backend's own conditional rule exactly (UserService.java createUser/
    // updateUser: "Work group is required for TECHNICIAN/TEAM_LEAD users.") — caught here
    // client-side so the field itself blocks submission instead of a raw 400 alert.
    if (WORKGROUP_ROLES.includes(form.role) && !form.workgroupId) {
      return alert('Work Group is required for Technician and Team Lead users.');
    }

    const payload = { ...form, opmcId: form.opmcId || null, workgroupId: form.workgroupId || null };
    if (modal === 'edit') delete payload.password;

    setSaving(true);
    try {
      if (modal === 'create') await userApi.create(payload);
      else                    await userApi.update(editId, payload);
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
    { key: 'opmcName', label: 'OPMC', render: v => v || '—' },
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
        actions={<>
          <Btn color="#455a64" onClick={openImport}>⇪ Import CSV</Btn>
          <Btn onClick={openCreate}>+ Add User</Btn>
        </>} />

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

      {(modal === 'create' || modal === 'edit') && (
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
          <FormField label="OPMC">
            <select style={inputStyle} value={form.opmcId}
              onChange={e => setForm({ ...form, opmcId: e.target.value, workgroupId: '' })}>
              <option value="">-- No OPMC --</option>
              {opmcs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </FormField>
          {WORKGROUP_ROLES.includes(form.role) && (
            <FormField label="Work Group" required>
              <select style={inputStyle} value={form.workgroupId} disabled={!form.opmcId || wgLoading}
                onChange={e => setForm({ ...form, workgroupId: e.target.value })}>
                <option value="">
                  {!form.opmcId ? '-- Select an OPMC first --' : wgLoading ? 'Loading...' : '-- Select Work Group --'}
                </option>
                {workgroups.map(wg => <option key={wg.id} value={wg.id}>{wg.name}</option>)}
              </select>
            </FormField>
          )}
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

      {modal === 'import' && (
        <Modal title="Bulk Import Users (CSV)" onClose={() => setModal(null)} width={560}>
          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f5f5f5', border: '1px solid #e0e0e0', marginBottom: 16, fontSize: 12, color: '#555', lineHeight: 1.6 }}>
            Expected columns (no header row is used for data, first line is skipped as the header):{' '}
            <code>username,password,fullName,email,phone,address,role,opmcId,workgroupId</code>.
            Rows with a duplicate username, a missing required field, or an invalid role are skipped and reported below —
            valid rows are still imported.
          </div>

          <FormField label="CSV File" required>
            <input
              type="file"
              accept=".csv"
              disabled={importing}
              onChange={e => setImportFile(e.target.files?.[0] || null)}
              style={inputStyle}
            />
          </FormField>

          {importResult && (
            <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, background: importResult.failureCount > 0 ? '#fff8e1' : '#e8f5e9', border: `1px solid ${importResult.failureCount > 0 ? '#ffc107' : '#4caf50'}` }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#333' }}>
                {importResult.successCount} of {importResult.totalRows} row{importResult.totalRows === 1 ? '' : 's'} imported
                {importResult.failureCount > 0 && ` — ${importResult.failureCount} failed`}
              </div>
              {importResult.createdUsernames?.length > 0 && (
                <div style={{ fontSize: 12, color: '#2e7d32', marginBottom: 8 }}>
                  Created: {importResult.createdUsernames.join(', ')}
                </div>
              )}
              {importResult.errors?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#c62828', marginBottom: 4 }}>Errors:</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#c62828' }}>
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn color="#757575" onClick={() => setModal(null)}>Close</Btn>
            <Btn onClick={handleImport} disabled={!importFile || importing}>
              {importing ? 'Importing...' : 'Import'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
