import React, { useState, useEffect } from 'react';
import { DataTable, StatusBadge, PageHeader, KpiCard, Btn, Modal, FormField, inputStyle } from '../../components/index';
import vehicleApi from '../../api/vehicles';
import branchApi from '../../api/branches';

const EMPTY = { registrationNumber: '', make: '', model: '', modelYear: '', vehicleType: 'VAN',
  fuelType: 'PETROL', branchId: '', currentOdometer: 0, insuranceExpiry: '',
  revenueLicenseExpiry: '', emissionTestExpiry: '', insuranceCompany: '', notes: '' };

export default function VehiclesPage() {
  const [vehicles, setVehicles]     = useState([]);
  const [alertSummary, setSummary]  = useState(null);
  const [branches, setBranches]     = useState([]);
  const [tab, setTab]               = useState('all');
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null);
  const [form, setForm]             = useState(EMPTY);
  const [editId, setEditId]         = useState(null);
  const [saving, setSaving]         = useState(false);

  useEffect(() => { loadAll(); loadBranches(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [vRes, sRes] = await Promise.allSettled([vehicleApi.getAll(), vehicleApi.getAlertSummary()]);
      setVehicles(vRes.status === 'fulfilled' ? (vRes.value.data || []) : []);
      setSummary(sRes.status  === 'fulfilled' ? sRes.value.data : null);
    } finally { setLoading(false); }
  };

  const loadBranches = async () => {
    try { const res = await branchApi.getAll(); setBranches(res.data || []); }
    catch (e) { console.error(e); }
  };

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal('form'); };
  const openEdit   = (v) => {
    setForm({ registrationNumber: v.registrationNumber, make: v.make, model: v.model,
      modelYear: v.modelYear, vehicleType: v.vehicleType, fuelType: v.fuelType,
      branchId: v.branchId || '', currentOdometer: v.currentOdometer || 0,
      insuranceExpiry: v.insuranceExpiry || '', revenueLicenseExpiry: v.revenueLicenseExpiry || '',
      emissionTestExpiry: v.emissionTestExpiry || '', insuranceCompany: v.insuranceCompany || '', notes: v.notes || '' });
    setEditId(v.id); setModal('form');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!editId) await vehicleApi.create(form);
      else         await vehicleApi.update(editId, form);
      setModal(null); loadAll();
    } catch (err) { alert(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleSetStatus = async (id, status) => {
    try { await vehicleApi.setStatus(id, status); loadAll(); }
    catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const expiring = vehicles.filter(v => alertSummary?.expiring?.some(e => e.id === v.id));
  const expired  = vehicles.filter(v => alertSummary?.expired?.some(e => e.id === v.id));
  const displayed = tab === 'all' ? vehicles : tab === 'expiring' ? expiring : expired;

  const columns = [
    { key: 'registrationNumber', label: 'Reg No.' },
    { key: 'make',  label: 'Make' },
    { key: 'model', label: 'Model' },
    { key: 'vehicleType', label: 'Type' },
    { key: 'branchName',  label: 'Branch', render: v => v || '—' },
    { key: 'currentOdometer', label: 'Odometer', render: v => v ? `${Number(v).toLocaleString()} km` : '—' },
    { key: 'insuranceExpiry',       label: 'Insurance Exp.', render: v => v || '—' },
    { key: 'revenueLicenseExpiry',  label: 'Revenue Lic. Exp.', render: v => v || '—' },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'id', label: 'Actions', render: (id, row) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn small onClick={e => { e.stopPropagation(); openEdit(row); }}>Edit</Btn>
        {row.status === 'ACTIVE' && (
          <Btn small color="#e65100" onClick={e => { e.stopPropagation(); handleSetStatus(id, 'UNDER_MAINTENANCE'); }}>Maint.</Btn>
        )}
        {row.status === 'UNDER_MAINTENANCE' && (
          <Btn small color="#1b5e20" onClick={e => { e.stopPropagation(); handleSetStatus(id, 'ACTIVE'); }}>Activate</Btn>
        )}
      </div>
    )},
  ];

  const Tab = ({ id, label, count, color }) => (
    <button onClick={() => setTab(id)} style={{
      padding: '8px 20px', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', fontWeight: 600,
      background: tab === id ? (color || '#1a237e') : '#e8eaf6', color: tab === id ? '#fff' : '#333'
    }}>
      {label}{count ? <span style={{ background: '#c62828', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 6 }}>{count}</span> : ''}
    </button>
  );

  return (
    <div>
      <PageHeader title="Vehicles" subtitle="Fleet management" actions={<Btn onClick={openCreate}>+ Add Vehicle</Btn>} />

      {/* Alert Summary */}
      {alertSummary && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <KpiCard title="Total Vehicles"       value={vehicles.length}                   icon="🚐" color="#1a237e" />
          <KpiCard title="Expiring (30 days)"   value={alertSummary.expiringWithin30Days} icon="⚠️" color="#e65100" />
          <KpiCard title="Already Expired"      value={alertSummary.alreadyExpired}       icon="🔴" color="#c62828" />
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 0, borderBottom: '2px solid #1a237e' }}>
        <Tab id="all"      label="All Vehicles" />
        <Tab id="expiring" label="Expiring Soon" count={alertSummary?.expiringWithin30Days} color="#e65100" />
        <Tab id="expired"  label="Expired Docs"  count={alertSummary?.alreadyExpired}       color="#c62828" />
      </div>

      <div style={{ background: '#fff', borderRadius: '0 10px 10px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
          : <DataTable columns={columns} data={displayed} />}
      </div>

      {modal && (
        <Modal title={editId ? 'Edit Vehicle' : 'Add Vehicle'} onClose={() => setModal(null)} width={600}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Registration Number" required>
              <input style={inputStyle} value={form.registrationNumber} onChange={e => setForm({ ...form, registrationNumber: e.target.value })} placeholder="WP CAE-3456" />
            </FormField>
            <FormField label="Branch">
              <select style={inputStyle} value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value })}>
                <option value="">-- Select Branch --</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </FormField>
            <FormField label="Make" required><input style={inputStyle} value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} /></FormField>
            <FormField label="Model" required><input style={inputStyle} value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></FormField>
            <FormField label="Model Year"><input type="number" style={inputStyle} value={form.modelYear} onChange={e => setForm({ ...form, modelYear: e.target.value })} /></FormField>
            <FormField label="Vehicle Type">
              <select style={inputStyle} value={form.vehicleType} onChange={e => setForm({ ...form, vehicleType: e.target.value })}>
                {['VAN','CAR','MOTORCYCLE','TRUCK','OTHER'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Fuel Type">
              <select style={inputStyle} value={form.fuelType} onChange={e => setForm({ ...form, fuelType: e.target.value })}>
                {['PETROL','DIESEL','ELECTRIC','HYBRID'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Current Odometer (km)"><input type="number" style={inputStyle} value={form.currentOdometer} onChange={e => setForm({ ...form, currentOdometer: e.target.value })} /></FormField>
            <FormField label="Insurance Expiry"><input type="date" style={inputStyle} value={form.insuranceExpiry} onChange={e => setForm({ ...form, insuranceExpiry: e.target.value })} /></FormField>
            <FormField label="Revenue Licence Expiry"><input type="date" style={inputStyle} value={form.revenueLicenseExpiry} onChange={e => setForm({ ...form, revenueLicenseExpiry: e.target.value })} /></FormField>
            <FormField label="Emission Test Expiry"><input type="date" style={inputStyle} value={form.emissionTestExpiry} onChange={e => setForm({ ...form, emissionTestExpiry: e.target.value })} /></FormField>
            <FormField label="Insurance Company"><input style={inputStyle} value={form.insuranceCompany} onChange={e => setForm({ ...form, insuranceCompany: e.target.value })} /></FormField>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn color="#757575" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
