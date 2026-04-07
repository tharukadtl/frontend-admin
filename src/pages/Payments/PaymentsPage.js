import React, { useState, useEffect } from 'react';
import { DataTable, StatusBadge, PageHeader, KpiCard, Btn, Modal, FormField, inputStyle } from '../../components/index';
import paymentApi from '../../api/payments';

export default function PaymentsPage() {
  const [payments, setPayments]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [reviewModal, setReviewModal] = useState(null);
  const [form, setForm]           = useState({ decision: 'APPROVED', adjustedAmount: '', reason: '' });
  const [saving, setSaving]       = useState(false);

  useEffect(() => { loadPayments(); }, []);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await paymentApi.getPending();
      setPayments(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openReview = (p) => {
    setReviewModal(p);
    setForm({ decision: 'APPROVED', adjustedAmount: p.totalAmount, reason: '' });
  };

  const handleReview = async () => {
    setSaving(true);
    try {
      const body = {
        decision:       form.decision,
        reason:         form.reason || undefined,
        adjustedAmount: form.adjustedAmount ? Number(form.adjustedAmount) : undefined,
      };
      await paymentApi.review(reviewModal.id, body);
      setReviewModal(null);
      loadPayments();
    } catch (err) { alert(err.response?.data?.message || 'Review failed'); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'paymentNumber',    label: 'Payment #' },
    { key: 'jobNumber',        label: 'Job #', render: v => v || '—' },
    { key: 'teamLeadName',     label: 'Submitted By' },
    { key: 'materialsFocTotal', label: 'FOC Materials', render: v => `Rs. ${Number(v || 0).toLocaleString()}` },
    { key: 'materialsChargeableTotal', label: 'Chargeable', render: v => `Rs. ${Number(v || 0).toLocaleString()}` },
    { key: 'labourCharge',     label: 'Labour', render: v => `Rs. ${Number(v || 0).toLocaleString()}` },
    { key: 'totalAmount',      label: 'Total', render: v => <strong>Rs. {Number(v || 0).toLocaleString()}</strong> },
    { key: 'status',           label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'submittedAt',      label: 'Submitted', render: v => v?.slice(0,10) },
    { key: 'id', label: 'Action', render: (_, row) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn small onClick={e => { e.stopPropagation(); setSelected(row); }}>View</Btn>
        {row.status === 'PENDING' && (
          <Btn small color="#1b5e20" onClick={e => { e.stopPropagation(); openReview(row); }}>Review</Btn>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Payments" subtitle="Approval queue" />

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard title="Pending Approval" value={payments.filter(p => p.status === 'PENDING').length} icon="⏳" color="#e65100" />
        <KpiCard title="Total Value Pending" icon="💰" color="#1a237e"
          value={`Rs. ${payments.filter(p => p.status === 'PENDING').reduce((s, p) => s + Number(p.totalAmount || 0), 0).toLocaleString()}`} />
      </div>

      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
          : <DataTable columns={columns} data={payments} onRowClick={setSelected} />}
      </div>

      {/* Detail Modal */}
      {selected && (
        <Modal title={`Payment — ${selected.paymentNumber}`} onClose={() => setSelected(null)} width={640}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 16 }}>
            {[
              ['Payment #', selected.paymentNumber],
              ['Job #', selected.jobNumber || '—'],
              ['Submitted By', selected.teamLeadName],
              ['Status', null],
              ['FOC Materials', `Rs. ${Number(selected.materialsFocTotal || 0).toLocaleString()}`],
              ['Chargeable Materials', `Rs. ${Number(selected.materialsChargeableTotal || 0).toLocaleString()}`],
              ['Labour Charge', `Rs. ${Number(selected.labourCharge || 0).toLocaleString()}`],
              ['Total Amount', `Rs. ${Number(selected.totalAmount || 0).toLocaleString()}`],
              ['Approved Amount', selected.approvedAmount ? `Rs. ${Number(selected.approvedAmount).toLocaleString()}` : '—'],
              ['Bill Reference', selected.billReference || '—'],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {label === 'Status' ? <StatusBadge status={selected.status} /> : val}
                </div>
              </div>
            ))}
          </div>
          {selected.workSummary && (
            <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>Work Summary</div>
              <div style={{ fontSize: 14 }}>{selected.workSummary}</div>
            </div>
          )}
          {selected.customerSignatureUrl && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>Customer Signature</div>
              <img src={selected.customerSignatureUrl} alt="Signature" style={{ maxHeight: 80, border: '1px solid #eee', borderRadius: 4 }} />
            </div>
          )}
          {selected.status === 'PENDING' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Btn color="#1b5e20" onClick={() => { setSelected(null); openReview(selected); }}>Review Payment</Btn>
            </div>
          )}
        </Modal>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <Modal title={`Review — ${reviewModal.paymentNumber}`} onClose={() => setReviewModal(null)}>
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6, fontSize: 14 }}>
            Total Amount: <strong>Rs. {Number(reviewModal.totalAmount || 0).toLocaleString()}</strong>
          </div>
          <FormField label="Decision" required>
            <select style={inputStyle} value={form.decision} onChange={e => setForm({ ...form, decision: e.target.value })}>
              <option value="APPROVED">Approve</option>
              <option value="REJECTED">Reject</option>
            </select>
          </FormField>
          {form.decision === 'APPROVED' && (
            <FormField label="Adjusted Amount (optional — leave blank to approve full amount)">
              <input type="number" style={inputStyle} value={form.adjustedAmount} onChange={e => setForm({ ...form, adjustedAmount: e.target.value })} />
            </FormField>
          )}
          <FormField label={form.decision === 'REJECTED' ? 'Rejection Reason *' : 'Notes (optional)'}>
            <input style={inputStyle} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
          </FormField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn color="#757575" onClick={() => setReviewModal(null)}>Cancel</Btn>
            <Btn color={form.decision === 'APPROVED' ? '#1b5e20' : '#c62828'}
              onClick={handleReview} disabled={saving || (form.decision === 'REJECTED' && !form.reason)}>
              {saving ? 'Saving...' : form.decision === 'APPROVED' ? 'Approve & Bill' : 'Reject'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
