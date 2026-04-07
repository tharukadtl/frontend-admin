import React, { useState, useEffect, useCallback } from 'react';
import { Area, AreaChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import aiService from '../../api/ai';

export default function ForecastChart() {
    const [loading, setLoading]           = useState(false);
    const [forecastData, setForecastData] = useState(null);
    const [days, setDays]                 = useState(30);
    const [error, setError]               = useState(null);

    // FIX 2: accept forecastDays as param so we never read stale state
    const loadForecast = useCallback(async (forecastDays) => {
        setLoading(true);
        setError(null);
        try {
            const response = await aiService.getForecast(forecastDays);
            const data = response.data;

            const chartData = data.dates.map((date, index) => ({
                date:      new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                predicted: Math.round(data.predictions[index]       ?? 0),
                lower:     Math.round(data.confidence_lower[index]  ?? 0),
                upper:     Math.round(data.confidence_upper[index]  ?? 0),
            }));

            setForecastData({
                chartData,
                metrics: data.accuracy_metrics ?? null,
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load forecast');
            console.error('Forecast error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadForecast(30); // initial load with default 30 days
    }, [loadForecast]);

    // FIX 2: pass newDays directly — no setTimeout, no stale closure
    const handleDaysChange = (newDays) => {
        setDays(newDays);
        loadForecast(newDays);
    };

    // FIX 1: safe formatter — never crashes if metric value is null/undefined
    const fmt = (val, decimals = 2) =>
        val != null && !isNaN(val) ? Number(val).toFixed(decimals) : 'N/A';

    // ── Loading ──
    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
                <div style={{ fontSize: 16, color: '#666' }}>
                    Training Prophet model and generating forecast...
                </div>
                <div style={{ fontSize: 13, color: '#999', marginTop: 8 }}>
                    This may take 10–15 seconds
                </div>
            </div>
        );
    }

    // ── Error ──
    if (error) {
        return (
            <div style={{ padding: 40, textAlign: 'center', background: '#ffebee', borderRadius: 8, color: '#c62828' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Forecast Generation Failed</div>
                <div style={{ fontSize: 14, marginBottom: 20 }}>{error}</div>
                <button
                    onClick={() => loadForecast(days)}
                    style={{
                        padding: '10px 24px', background: '#1a237e', color: '#fff',
                        border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!forecastData) return null;

    const { metrics } = forecastData;

    return (
        <div>
            {/* Header with controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ margin: '0 0 4px', fontSize: 20, color: '#1a237e' }}>
                        📈 Fault Forecast (Prophet ML Model)
                    </h2>
                    <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                        Time-series prediction using Facebook Prophet with confidence intervals
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#666' }}>Forecast Period:</span>
                    {[7, 14, 30, 60, 90].map(d => (
                        <button
                            key={d}
                            onClick={() => handleDaysChange(d)}
                            style={{
                                padding: '6px 16px',
                                border: days === d ? '2px solid #1a237e' : '1px solid #ddd',
                                borderRadius: 6,
                                background: days === d ? '#e8eaf6' : '#fff',
                                color: days === d ? '#1a237e' : '#666',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: days === d ? 600 : 400,
                            }}
                        >
                            {d} days
                        </button>
                    ))}
                </div>
            </div>

            {/* Accuracy Metrics — safe via fmt() */}
            {metrics && (
                <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                    <MetricCard label="Mean Absolute Error"     value={fmt(metrics.mae)}           icon="📊" color="#1976d2" />
                    <MetricCard label="Root Mean Squared Error" value={fmt(metrics.rmse)}          icon="📉" color="#7b1fa2" />
                    <MetricCard label="Mean Absolute % Error"   value={`${fmt(metrics.mape, 1)}%`} icon="🎯" color="#388e3c" />
                    <MetricCard label="R² Score"                value={fmt(metrics.r2, 3)}         icon="✅" color="#f57c00" />
                </div>
            )}

            {/* Forecast Chart */}
            <div style={{ background: '#f9fafb', padding: 20, borderRadius: 8, border: '1px solid #e0e0e0' }}>
                <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={forecastData.chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#666" />
                        <YAxis
                            label={{ value: 'Number of Faults', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                            tick={{ fontSize: 12 }}
                            stroke="#666"
                        />
                        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: 12 }} />
                        <Legend wrapperStyle={{ paddingTop: 20 }} iconType="circle" />
                        <Area type="monotone" dataKey="upper" stackId="1" stroke="none" fill="#bbdefb" fillOpacity={0.3} name="Upper Confidence" />
                        <Area type="monotone" dataKey="lower" stackId="1" stroke="none" fill="#bbdefb" fillOpacity={0.3} name="Lower Confidence" />
                        <Line type="monotone" dataKey="predicted" stroke="#1a237e" strokeWidth={3} dot={{ r: 4, fill: '#1a237e' }} name="Predicted Faults" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Insights */}
            <div style={{ marginTop: 20, padding: 16, background: '#e3f2fd', borderRadius: 8, borderLeft: '4px solid #1976d2' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1565c0', marginBottom: 8 }}>💡 Insights</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#333', lineHeight: 1.8 }}>
                    <li>Model trained on historical fault data using Facebook Prophet algorithm</li>
                    <li>Confidence intervals (shaded area) show prediction uncertainty range</li>
                    <li>Lower MAPE indicates higher forecast accuracy (target: &lt;15%)</li>
                    <li>Use forecast to plan resource allocation and staffing levels</li>
                </ul>
            </div>

            <button
                onClick={() => loadForecast(days)}
                style={{
                    marginTop: 20, padding: '10px 24px', background: '#1a237e', color: '#fff',
                    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8,
                }}
            >
                🔄 Refresh Forecast
            </button>
        </div>
    );
}

function MetricCard({ label, value, icon, color }) {
    return (
        <div style={{
            flex: 1, minWidth: 140, padding: '12px 16px',
            background: '#fff', border: `2px solid ${color}`, borderRadius: 8,
        }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color, marginBottom: 2 }}>{value}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
        </div>
    );
}