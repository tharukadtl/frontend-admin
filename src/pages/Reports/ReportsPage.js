import React, { useState } from 'react';
import { PageHeader, Btn, KpiCard } from '../../components/index';
import reportApi from '../../api/reports';

const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo,   setDateTo]   = useState(today);
  const [results,  setResults]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [reportType, setReportType] = useState('faults');

  const loadReport = async () => {
    setLoading(true);
    setResults(null);
    try {
      const params = { from: dateFrom, to: dateTo };
      let res;
      if (reportType === 'faults')      res = await reportApi.getFaultSummary(params);
      else if (reportType === 'payments') res = await reportApi.getPaymentSummary(params);
      else if (reportType === 'technicians') res = await reportApi.getTechnicianPerformance(params);
      else                               res = await reportApi.getInventoryUsage(params);
      setResults(res.data);
    } catch (err) {
      setResults({ error: err.response?.data?.message || 'Report failed. Please check backend.' });
    } finally { setLoading(false); }
  };

  const exportReport = async () => {
    try {
      const params = { from: dateFrom, to: dateTo };
      let res;
      if (reportType === 'faults')    res = await reportApi.exportFaults(params);
      else                             res = await reportApi.exportPayments(params);
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `slt-${reportType}-report-${dateFrom}-to-${dateTo}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) { alert('Export failed'); }
  };

  const TYPES = [
    { id: 'faults',      label: 'Fault Summary',        icon: '⚡' },
    { id: 'payments',    label: 'Payment Summary',       icon: '💳' },
    { id: 'technicians', label: 'Technician Performance',icon: '👷' },
    { id: 'inventory',   label: 'Inventory Usage',       icon: '📦' },
  ];

  return (
    <div>
      <PageHeader title="Reports" subtitle="Date-range reports with export" />

      {/* Report Type Selector */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {TYPES.map(t => (
          <button key={t.id} onClick={() => { setReportType(t.id); setResults(null); }}
            style={{
              padding: '10px 20px', border: '2px solid',
              borderColor: reportType === t.id ? '#1a237e' : '#ddd',
              background: reportType === t.id ? '#1a237e' : '#fff',
              color: reportType === t.id ? '#fff' : '#444',
              borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Date Range + Actions */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }} />
          </div>
          <Btn onClick={loadReport} disabled={loading}>{loading ? 'Loading...' : '📊 Generate Report'}</Btn>
          {['faults', 'payments'].includes(reportType) && (
            <Btn color="#1b5e20" onClick={exportReport}>⬇ Export CSV</Btn>
          )}
        </div>

        {/* Quick Date Shortcuts */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[
            ['This Month', monthStart, today],
            ['Last 7 Days', new Date(Date.now() - 7*86400000).toISOString().slice(0,10), today],
            ['Last 30 Days', new Date(Date.now() - 30*86400000).toISOString().slice(0,10), today],
          ].map(([label, from, to]) => (
            <button key={label} onClick={() => { setDateFrom(from); setDateTo(to); }}
              style={{ padding: '5px 12px', background: '#e8eaf6', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 12, color: '#283593', fontWeight: 600 }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {results && !results.error && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 20px', color: '#1a237e' }}>
            {TYPES.find(t => t.id === reportType)?.label} — {dateFrom} to {dateTo}
          </h3>

          {/* Render summary stats as KPI cards if present */}
          {results.summary && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
              {Object.entries(results.summary).map(([key, val]) => (
                <KpiCard key={key} title={key.replace(/([A-Z])/g, ' $1').trim()} value={String(val)} icon="📌" color="#283593" />
              ))}
            </div>
          )}

          {/* Raw JSON display as formatted table if array */}
          {Array.isArray(results.data) && results.data.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    {Object.keys(results.data[0]).map(k => (
                      <th key={k} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e0e0e0', whiteSpace: 'nowrap' }}>
                        {k.replace(/([A-Z])/g, ' $1').trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.data.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      {Object.values(row).map((v, j) => (
                        <td key={j} style={{ padding: '8px 12px' }}>{String(v ?? '—')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Fallback: show raw data */}
          {!results.summary && !Array.isArray(results.data) && (
            <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 6, fontSize: 12, overflow: 'auto' }}>
              {JSON.stringify(results, null, 2)}
            </pre>
          )}
        </div>
      )}

      {results?.error && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: 20, borderRadius: 10 }}>
          ⚠️ {results.error}
        </div>
      )}

      {!results && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
          Select a report type and date range, then click Generate Report.
        </div>
      )}
    </div>
  );
}
