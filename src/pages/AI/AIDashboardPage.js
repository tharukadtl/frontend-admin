import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import aiService from '../../api/ai';
import ForecastChart from '../../components/AI/ForecastChart';
import ClusterMap from '../../components/AI/ClusterMap';
import RouteOptimizer from '../../components/AI/RouteOptimizer';

export default function AIDashboardPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('forecast');
    const [healthStatus, setHealthStatus] = useState(null);

    useEffect(() => {
        checkHealth();
    }, []);

    const checkHealth = async () => {
        try {
            const response = await aiService.health();
            setHealthStatus(response.data);
        } catch (error) {
            setHealthStatus({ status: 'error', message: 'AI Service unavailable' });
        }
    };

    const TabButton = ({ id, label, icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            style={{
                padding: '14px 28px',
                border: 'none',
                borderRadius: '10px 10px 0 0',
                background: activeTab === id ? '#1a237e' : '#e8eaf6',
                color: activeTab === id ? '#fff' : '#333',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'all 0.2s',
            }}
        >
            <span style={{ fontSize: 20 }}>{icon}</span>
            {label}
        </button>
    );

    return (
        <div style={{ padding: '28px 36px', background: '#f4f6fb', minHeight: '100vh' }}>
            {/* Header with Back Button */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                    <button
                        onClick={() => navigate('/dashboard')}
                        style={{
                            padding: '8px 16px',
                            background: '#fff',
                            color: '#1a237e',
                            border: '1px solid #1a237e',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        ← Back to Dashboard
                    </button>
                </div>

                <h1 style={{ margin: '0 0 8px', fontSize: 32, color: '#1a237e', fontWeight: 700 }}>
                    🤖 AI/ML Predictive Analytics
                </h1>
                <p style={{ margin: '0 0 12px', color: '#666', fontSize: 15 }}>
                    Advanced machine learning for fault forecasting, demand clustering, and intelligent routing
                </p>

                {/* Health Status Badge */}
                {healthStatus && (
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 16px',
                        background: healthStatus.status === 'healthy' ? '#e8f5e9' : '#ffebee',
                        color: healthStatus.status === 'healthy' ? '#1b5e20' : '#c62828',
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 600,
                    }}>
                        <span>{healthStatus.status === 'healthy' ? '✅' : '⚠️'}</span>
                        AI Service: {healthStatus.status === 'healthy' ? 'Online' : 'Offline'}
                        {healthStatus.model_info && (
                            <span style={{ marginLeft: 4, opacity: 0.8 }}>
                • {healthStatus.model_info}
              </span>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div style={{
                display: 'flex',
                gap: 6,
                marginBottom: 0,
                borderBottom: '3px solid #1a237e',
            }}>
                <TabButton id="forecast" label="Fault Forecasting" icon="📈" />
                <TabButton id="clusters" label="Demand Hotspots" icon="🗺️" />
                <TabButton id="routing" label="Route Optimization" icon="🚗" />
            </div>

            {/* Tab Content */}
            <div style={{
                background: '#fff',
                borderRadius: '0 12px 12px 12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                padding: 28,
                minHeight: 600,
            }}>
                {activeTab === 'forecast' && <ForecastChart />}
                {activeTab === 'clusters' && <ClusterMap />}
                {activeTab === 'routing' && <RouteOptimizer />}
            </div>

            {/* Feature Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 20,
                marginTop: 28,
            }}>
                <FeatureCard
                    icon="🔮"
                    title="Prophet Time-Series Forecasting"
                    description="Utilizes Facebook Prophet algorithm with additive regression model to predict future fault occurrences"
                    metrics={['MAE < 5', 'RMSE < 7', 'MAPE < 15%', 'R² > 0.85']}
                    color="#1976d2"
                />
                <FeatureCard
                    icon="🎯"
                    title="K-means Geographic Clustering"
                    description="Unsupervised learning algorithm that groups faults by location to identify high-demand zones"
                    metrics={['3-7 clusters', 'Elbow method', 'Silhouette score', 'Plotly visualization']}
                    color="#388e3c"
                />
                <FeatureCard
                    icon="🛣️"
                    title="Dijkstra Shortest Path Routing"
                    description="Graph-based algorithm for optimal route planning with 15-20% travel time reduction"
                    metrics={['O(n²) complexity', '40-60 km/h avg', 'Multi-stop optimization', 'Interactive maps']}
                    color="#f57c00"
                />
            </div>

            {/* Technical Details */}
            <div style={{
                marginTop: 28,
                padding: 24,
                background: '#fff',
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}>
                <h3 style={{ fontSize: 18, color: '#1a237e', marginBottom: 16 }}>
                    🔧 Technical Implementation
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div>
                        <h4 style={{ fontSize: 14, color: '#666', marginBottom: 8, fontWeight: 600 }}>
                            Backend Stack
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#333', lineHeight: 1.8 }}>
                            <li>Python 3.9+ with Flask web framework</li>
                            <li>Prophet v1.1+ for forecasting</li>
                            <li>Scikit-learn for K-means clustering</li>
                            <li>NetworkX for graph algorithms</li>
                            <li>Plotly for interactive visualizations</li>
                        </ul>
                    </div>
                    <div>
                        <h4 style={{ fontSize: 14, color: '#666', marginBottom: 8, fontWeight: 600 }}>
                            Data Requirements
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#333', lineHeight: 1.8 }}>
                            <li>Minimum 100 historical fault records</li>
                            <li>Latitude/longitude coordinates required</li>
                            <li>Daily aggregation for forecasting</li>
                            <li>Real-time technician location tracking</li>
                            <li>MySQL database integration</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FeatureCard({ icon, title, description, metrics, color }) {
    return (
        <div style={{
            padding: '24px',
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            borderTop: `4px solid ${color}`,
        }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color, marginBottom: 8 }}>
                {title}
            </h3>
            <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 16 }}>
                {description}
            </p>
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
            }}>
                {metrics.map((metric, index) => (
                    <span
                        key={index}
                        style={{
                            padding: '4px 10px',
                            background: '#f5f5f5',
                            color: '#333',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                        }}
                    >
            {metric}
          </span>
                ))}
            </div>
        </div>
    );
}
