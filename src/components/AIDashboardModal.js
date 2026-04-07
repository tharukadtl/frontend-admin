import React, { useState, useEffect } from 'react';
import aiService from '../api/ai';
import ForecastChart from './AI/ForecastChart';
import ClusterMap from './AI/ClusterMap';
import RouteOptimizer from './AI/RouteOptimizer';

export default function AIDashboardModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('forecast');
  const [healthStatus, setHealthStatus] = useState(null);

  useEffect(() => {
    checkHealth();
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const checkHealth = async () => {
    try {
      const response = await aiService.health();
      setHealthStatus(response.data);
    } catch (error) {
      setHealthStatus({ status: 'error', message: 'AI Service unavailable' });
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 20,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        width: '95%',
        maxWidth: 1400,
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 28px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>
              🤖 AI/ML Predictive Analytics
            </h2>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Machine learning for fault forecasting, demand clustering, and intelligent routing
            </p>
          </div>
          
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: '#fff',
              width: 40,
              height: 40,
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            ×
          </button>
        </div>

        {/* Health Status */}
        {healthStatus && (
          <div style={{
            padding: '12px 28px',
            background: healthStatus.status === 'healthy' ? '#e8f5e9' : '#ffebee',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>
              {healthStatus.status === 'healthy' ? '✅' : '⚠️'}
            </span>
            <div>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: healthStatus.status === 'healthy' ? '#1b5e20' : '#c62828',
              }}>
                AI Service: {healthStatus.status === 'healthy' ? 'Online and Ready' : 'Offline'}
              </div>
              {healthStatus.model_info && (
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                  {healthStatus.model_info}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '0 28px',
          background: '#f8f9fa',
          borderBottom: '2px solid #1a237e',
        }}>
          <TabButton
            active={activeTab === 'forecast'}
            onClick={() => setActiveTab('forecast')}
            icon="📈"
            label="Fault Forecasting"
          />
          <TabButton
            active={activeTab === 'clusters'}
            onClick={() => setActiveTab('clusters')}
            icon="🗺️"
            label="Demand Hotspots"
          />
          <TabButton
            active={activeTab === 'routing'}
            onClick={() => setActiveTab('routing')}
            icon="🚗"
            label="Route Optimization"
          />
        </div>

        {/* Tab Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: 28,
          background: '#f8f9fa',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 24,
            minHeight: '100%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            {activeTab === 'forecast' && <ForecastChart />}
            {activeTab === 'clusters' && <ClusterMap />}
            {activeTab === 'routing' && <RouteOptimizer />}
          </div>
        </div>

        {/* Modal Footer - Info Cards */}
        <div style={{
          padding: '16px 28px',
          background: '#f8f9fa',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          gap: 16,
        }}>
          <InfoChip icon="🔮" label="Prophet ML" />
          <InfoChip icon="🎯" label="K-means Clustering" />
          <InfoChip icon="🛣️" label="Dijkstra Algorithm" />
          <InfoChip icon="📊" label="Real-time Analysis" />
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '14px 24px',
        border: 'none',
        borderRadius: '8px 8px 0 0',
        background: active ? '#1a237e' : 'transparent',
        color: active ? '#fff' : '#666',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all 0.2s',
      }}
      onMouseOver={(e) => {
        if (!active) {
          e.currentTarget.style.background = '#e8eaf6';
          e.currentTarget.style.color = '#1a237e';
        }
      }}
      onMouseOut={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#666';
        }
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      {label}
    </button>
  );
}

function InfoChip({ icon, label }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      background: '#fff',
      borderRadius: 16,
      fontSize: 12,
      fontWeight: 600,
      color: '#666',
      border: '1px solid #e0e0e0',
    }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}
