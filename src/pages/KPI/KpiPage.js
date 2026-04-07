import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DataTable, PageHeader, KpiCard, Btn } from '../../components/index';
import kpiApi from '../../api/kpi';

export default function KpiPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [date, setDate]               = useState('');

  useEffect(() => { load(); }, [date]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await kpiApi.getLeaderboard(date || undefined);
      setLeaderboard(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const top5 = leaderboard.slice(0, 5);

  const columns = [
    { key: 'technicianName',   label: 'Technician' },
    { key: 'scoreDate',        label: 'Date' },
    { key: 'jobsAssigned',     label: 'Assigned' },
    { key: 'jobsCompleted',    label: 'Completed' },
    { key: 'slaCompliancePercent', label: 'SLA %', render: v => v ? `${v}%` : '—' },
    { key: 'overallScore',     label: 'Score', render: v => v ? (
      <span style={{ fontWeight: 700, color: Number(v) >= 90 ? '#1b5e20' : Number(v) >= 75 ? '#0d47a1' : Number(v) >= 50 ? '#e65100' : '#c62828' }}>
        {v}/100
      </span>
    ) : '—' },
    { key: 'performanceLabel', label: 'Rating', render: v => (
      <span style={{ fontWeight: 600, color: v === 'EXCELLENT' ? '#1b5e20' : v === 'GOOD' ? '#0d47a1' : v === 'AVERAGE' ? '#e65100' : '#c62828' }}>
        {v || '—'}
      </span>
    )},
  ];

  return (
    <div>
      <PageHeader title="KPI Dashboard" subtitle="Technician performance tracking" />

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard title="Tracked Technicians" value={leaderboard.length} icon="👷" color="#1a237e" />
        <KpiCard title="Avg Score"
          value={leaderboard.length ? Math.round(leaderboard.reduce((s, t) => s + Number(t.overallScore || 0), 0) / leaderboard.length) + '/100' : '—'}
          icon="📊" color="#283593" />
        <KpiCard title="EXCELLENT Performers"
          value={leaderboard.filter(t => t.performanceLabel === 'EXCELLENT').length}
          icon="🏆" color="#1b5e20" />
        <KpiCard title="Need Attention"
          value={leaderboard.filter(t => t.performanceLabel === 'POOR').length}
          icon="⚠️" color="#c62828" />
      </div>

      {/* Date filter + trigger */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <label style={{ fontSize: 14, fontWeight: 600 }}>Score Date:</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }} />
        {date && <Btn small color="#757575" onClick={() => setDate('')}>Today's Data</Btn>}
        <Btn small onClick={load}>↻ Refresh</Btn>
      </div>

      {/* Bar Chart — Top 5 */}
      {top5.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', color: '#1a237e', fontSize: 16 }}>Top 5 Technicians by Score</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={top5} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="technicianName" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [`${v}/100`, 'Score']} />
              <Legend />
              <Bar dataKey="overallScore" name="Score" fill="#1a237e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="jobsCompleted" name="Jobs Done" fill="#4caf50" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
          <h3 style={{ margin: 0, color: '#1a237e' }}>🏆 Full Leaderboard</h3>
        </div>
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
          : <DataTable columns={columns} data={leaderboard} />}
      </div>
    </div>
  );
}
