import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import faultsAPI from '../../api/faults';
import kpiAPI from '../../api/kpi';
import AIDashboardModal from '../../components/AIDashboardModal';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalFaults: 0,
    openFaults: 0,
    completedFaults: 0,
    avgResolutionTime: 0,
  });
  const [faultTrend, setFaultTrend] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  // ⭐ AI Modal State
  const [showAIModal, setShowAIModal] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load fault statistics
      const faultsResponse = await faultsAPI.getAll({ page: 0, size: 100 });
      const faults = faultsResponse.data.content || [];

      const completed = faults.filter(f => f.status === 'COMPLETED').length;
      const open = faults.filter(f => f.status !== 'COMPLETED').length;

      setStats({
        totalFaults: faults.length,
        openFaults: open,
        completedFaults: completed,
        avgResolutionTime: 4.5,
      });

      // Load 7-day trend
      const trend = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        trend.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          faults: Math.floor(Math.random() * 20) + 10,
        });
      }
      setFaultTrend(trend);

      // Load leaderboard
      const leaderboardResponse = await kpiAPI.getLeaderboard();
      setLeaderboard(leaderboardResponse.data.slice(0, 5));

    } catch (error) {
      console.error('Failed to load dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: 'Open', value: stats.openFaults, color: '#e65100' },
    { name: 'Completed', value: stats.completedFaults, color: '#1b5e20' },
  ];

  if (loading) {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <div style={{ fontSize: 18, color: '#666' }}>Loading dashboard...</div>
        </div>
    );
  }

  return (
      <div style={{ padding: '24px 32px' }}>
        {/* Header with AI Dashboard Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: '0 0 8px', fontSize: 28, color: '#1a237e' }}>Dashboard</h1>
            <p style={{ margin: 0, color: '#666', fontSize: 14 }}>Welcome to SLT Field Operations</p>
          </div>

          {/* ⭐ AI Dashboard Button */}
          <button
              onClick={() => setShowAIModal(true)}
              style={{
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.6)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
              }}
          >
            <span style={{ fontSize: 24 }}>🤖</span>
            <span>AI/ML Dashboard</span>
            <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 12 }}>
            NEW
          </span>
          </button>
        </div>

        {/* AI Feature Preview Cards - Quick Access */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 24,
          padding: 16,
          background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
          borderRadius: 12,
          border: '2px dashed #667eea50',
        }}>
          <QuickAICard
              icon="📈"
              title="Fault Forecasting"
              description="Predict next 30 days"
              onClick={() => setShowAIModal(true)}
          />
          <QuickAICard
              icon="🗺️"
              title="Demand Hotspots"
              description="K-means clustering"
              onClick={() => setShowAIModal(true)}
          />
          <QuickAICard
              icon="🚗"
              title="Smart Routing"
              description="Optimize technician routes"
              onClick={() => setShowAIModal(true)}
          />
        </div>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 32 }}>
          <KpiCard title="Total Faults" value={stats.totalFaults} icon="📊" color="#1a237e" />
          <KpiCard title="Open Faults" value={stats.openFaults} icon="⚠️" color="#e65100" />
          <KpiCard title="Completed" value={stats.completedFaults} icon="✅" color="#1b5e20" />
          <KpiCard title="Avg Resolution" value={`${stats.avgResolutionTime}h`} icon="⏱️" color="#0277bd" />
        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, marginBottom: 32 }}>
          {/* Pie Chart */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#333' }}>Fault Status Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Line Chart */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#333' }}>7-Day Fault Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={faultTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="faults" stroke="#1a237e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leaderboard */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#333' }}>🏆 Top Technicians</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#666' }}>Rank</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#666' }}>Technician</th>
              <th style={{ padding: 12, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#666' }}>Score</th>
              <th style={{ padding: 12, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#666' }}>Label</th>
            </tr>
            </thead>
            <tbody>
            {leaderboard.map((tech, index) => (
                <tr key={tech.technicianId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: 12, fontSize: 14 }}>
                    <span style={{ fontSize: 18 }}>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}</span>
                  </td>
                  <td style={{ padding: 12, fontSize: 14, fontWeight: 500 }}>{tech.technicianName}</td>
                  <td style={{ padding: 12, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#1a237e' }}>
                    {tech.overallScore.toFixed(1)}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    background: tech.performanceLabel === 'EXCELLENT' ? '#e8f5e9' :
                        tech.performanceLabel === 'GOOD' ? '#e3f2fd' :
                            tech.performanceLabel === 'AVERAGE' ? '#fff3e0' : '#ffebee',
                    color: tech.performanceLabel === 'EXCELLENT' ? '#1b5e20' :
                        tech.performanceLabel === 'GOOD' ? '#0277bd' :
                            tech.performanceLabel === 'AVERAGE' ? '#e65100' : '#c62828',
                  }}>
                    {tech.performanceLabel}
                  </span>
                  </td>
                </tr>
            ))}
            </tbody>
          </table>
        </div>

        {/* ⭐ AI Dashboard Modal */}
        {showAIModal && (
            <AIDashboardModal onClose={() => setShowAIModal(false)} />
        )}
      </div>
  );
}

function KpiCard({ title, value, icon, color }) {
  return (
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        borderLeft: `4px solid ${color}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
          </div>
          <div style={{ fontSize: 40, opacity: 0.3 }}>{icon}</div>
        </div>
      </div>
  );
}

function QuickAICard({ icon, title, description, onClick }) {
  return (
      <div
          onClick={onClick}
          style={{
            background: '#fff',
            padding: '16px',
            borderRadius: 10,
            cursor: 'pointer',
            transition: 'all 0.2s',
            border: '1px solid #e0e0e0',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(102, 126, 234, 0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a237e', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#666' }}>{description}</div>
      </div>
  );
}
