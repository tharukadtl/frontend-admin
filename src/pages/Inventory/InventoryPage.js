import React, { useState, useEffect } from 'react';
import { DataTable, StatusBadge, PageHeader, KpiCard, Btn, Modal, FormField, inputStyle } from '../../components/index';
import inventoryApi from '../../api/inventory';

export default function InventoryPage() {
  const [tab, setTab]           = useState('materials'); // materials | requests | alerts
  const [materials, setMaterials] = useState([]);
  const [requests, setRequests] = useState([]);
  const [alerts, setAlerts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewForm, setReviewForm]   = useState({ decision: 'APPROVED', reason: '' });
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustForm, setAdjustForm]   = useState({ transactionType: 'STOCK_IN', quantity: '', notes: '' });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [mRes, rRes, aRes] = await Promise.allSettled([
        inventoryApi.getMaterials(),
        inventoryApi.getPendingRequests(),
        inventoryApi.getLowStockAlerts(),
      ]);
      setMaterials(mRes.status === 'fulfilled' ? (mRes.value.data || []) : []);
      setRequests(rRes.status  === 'fulfilled' ? (rRes.value.data  || []) : []);
      setAlerts(aRes.status    === 'fulfilled' ? (aRes.value.data  || []) : []);
    } finally { setLoading(false); }
  };

  const filteredMaterials = materials.filter(m =>
    !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const handleReview = async () => {
    try {
      await inventoryApi.reviewRequest(reviewModal.id, reviewForm);
      setReviewModal(null);
      setReviewForm({ decision: 'APPROVED', reason: '' });
      loadAll();
    } catch (err) { alert(err.response?.data?.message || 'Review failed'); }
  };

  const handleAdjust = async () => {
    try {
      await inventoryApi.adjustStock(adjustModal.id, { ...adjustForm, quantity: Number(adjustForm.quantity) });
      setAdjustModal(null);
      setAdjustForm({ transactionType: 'STOCK_IN', quantity: '', notes: '' });
      loadAll();
    } catch (err) { alert(err.response?.data?.message || 'Adjust failed'); }
  };

  const materialColumns = [
    { key: 'name',          label: 'Material Name' },
    { key: 'sku',           label: 'SKU' },
    { key: 'unit',          label: 'Unit' },
    { key: 'currentStock',  label: 'Stock', render: (v, row) => `${v} ${row.unit || ''}` },
    { key: 'minimumThreshold', label: 'Min Threshold' },
    { key: 'chargeType',    label: 'Type', render: v => (
      <span style={{ background: v === 'FOC' ? '#e8f5e9' : '#fff3e0', color: v === 'FOC' ? '#1b5e20' : '#e65100', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>{v}</span>
    )},
    { key: 'unitPrice',     label: 'Unit Price', render: v => v ? `Rs. ${Number(v).toLocaleString()}` : '—' },
    { key: 'stockStatus',   label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'id', label: '', render: (id, row) => (
      <Btn small onClick={e => { e.stopPropagation(); setAdjustModal(row); }}>Adjust Stock</Btn>
    )},
  ];

  const requestColumns = [
    { key: 'materialName',     label: 'Material' },
    { key: 'requestedByName',  label: 'Requested By' },
    { key: 'quantityRequested',label: 'Qty' },
    { key: 'reason',           label: 'Reason' },
    { key: 'status',           label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'id', label: 'Action', render: (id, row) => row.status === 'PENDING' ? (
      <Btn small color="#1b5e20" onClick={e => { e.stopPropagation(); setReviewModal(row); }}>Review</Btn>
    ) : null },
  ];

  const Tab = ({ id, label, count }) => (
    <button onClick={() => setTab(id)} style={{
      padding: '8px 20px', border: 'none', borderRadius: '6px 6px 0 0',
      background: tab === id ? '#1a237e' : '#e8eaf6', color: tab === id ? '#fff' : '#333',
      cursor: 'pointer', fontWeight: 600, fontSize: 14
    }}>
      {label} {count > 0 && <span style={{ background: '#c62828', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 6 }}>{count}</span>}
    </button>
  );

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Stock management and material requests">
        <div style={{ display: 'flex', gap: 12 }}>
          <KpiCard title="Low Stock" value={alerts.length} icon="⚠️" color="#e65100" />
          <KpiCard title="Pending Requests" value={requests.length} icon="📋" color="#6a1b9a" />
        </div>
      </PageHeader>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 0, borderBottom: '2px solid #1a237e' }}>
        <Tab id="materials" label="Materials"        count={0} />
        <Tab id="requests"  label="Pending Requests" count={requests.length} />
        <Tab id="alerts"    label="Low Stock Alerts" count={alerts.length} />
      </div>

      <div style={{ background: '#fff', borderRadius: '0 10px 10px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: 0, overflow: 'hidden' }}>
        {tab === 'materials' && (
          <div>
            <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
              <input placeholder="Search material name or SKU..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ ...inputStyle, width: 300 }} />
            </div>
            {loading ? <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
              : <DataTable columns={materialColumns} data={filteredMaterials} />}
          </div>
        )}

        {tab === 'requests' && (
          loading ? <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
            : <DataTable columns={requestColumns} data={requests} />
        )}

        {tab === 'alerts' && (
          loading ? <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
            : <DataTable
                columns={[
                  { key: 'name',         label: 'Material' },
                  { key: 'sku',          label: 'SKU' },
                  { key: 'currentStock', label: 'Current Stock' },
                  { key: 'minimumThreshold', label: 'Min Threshold' },
                  { key: 'stockStatus',  label: 'Status', render: v => <StatusBadge status={v} /> },
                ]}
                data={alerts} />
        )}
      </div>

      {/* Review Modal */}
      {reviewModal && (
        <Modal title={`Review Request — ${reviewModal.materialName}`} onClose={() => setReviewModal(null)}>
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
            <div style={{ fontSize: 13, color: '#666' }}>Requested by <strong>{reviewModal.requestedByName}</strong> — Qty: <strong>{reviewModal.quantityRequested}</strong></div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Reason: {reviewModal.reason}</div>
          </div>
          <FormField label="Decision" required>
            <select style={inputStyle} value={reviewForm.decision} onChange={e => setReviewForm({ ...reviewForm, decision: e.target.value })}>
              <option value="APPROVED">Approve</option>
              <option value="REJECTED">Reject</option>
            </select>
          </FormField>
          {reviewForm.decision === 'REJECTED' && (
            <FormField label="Rejection Reason" required>
              <input style={inputStyle} value={reviewForm.reason} onChange={e => setReviewForm({ ...reviewForm, reason: e.target.value })} />
            </FormField>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn color="#757575" onClick={() => setReviewModal(null)}>Cancel</Btn>
            <Btn color={reviewForm.decision === 'APPROVED' ? '#1b5e20' : '#c62828'} onClick={handleReview}>
              {reviewForm.decision === 'APPROVED' ? 'Approve' : 'Reject'}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Adjust Stock Modal */}
      {adjustModal && (
        <Modal title={`Adjust Stock — ${adjustModal.name}`} onClose={() => setAdjustModal(null)}>
          <div style={{ marginBottom: 16, fontSize: 14, color: '#666' }}>
            Current stock: <strong>{adjustModal.currentStock} {adjustModal.unit}</strong>
          </div>
          <FormField label="Transaction Type" required>
            <select style={inputStyle} value={adjustForm.transactionType} onChange={e => setAdjustForm({ ...adjustForm, transactionType: e.target.value })}>
              <option value="STOCK_IN">Stock In (Add)</option>
              <option value="STOCK_OUT">Stock Out (Deduct)</option>
              <option value="ADJUSTMENT">Direct Adjustment</option>
            </select>
          </FormField>
          <FormField label="Quantity" required>
            <input type="number" style={inputStyle} value={adjustForm.quantity} onChange={e => setAdjustForm({ ...adjustForm, quantity: e.target.value })} />
          </FormField>
          <FormField label="Notes">
            <input style={inputStyle} value={adjustForm.notes} onChange={e => setAdjustForm({ ...adjustForm, notes: e.target.value })} />
          </FormField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn color="#757575" onClick={() => setAdjustModal(null)}>Cancel</Btn>
            <Btn onClick={handleAdjust} disabled={!adjustForm.quantity}>Apply</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
