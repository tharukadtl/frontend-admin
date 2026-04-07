import React, { useState, useEffect, useCallback } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import aiService from '../../api/ai';

const CLUSTER_COLORS = ['#1a237e', '#c62828', '#2e7d32', '#f57c00', '#7b1fa2', '#0277bd', '#558b2f'];

// Safe toFixed helper — never crashes on null/undefined
const fmt = (val, decimals = 4) =>
    val != null && !isNaN(val) ? Number(val).toFixed(decimals) : 'N/A';

export default function ClusterMap() {
    const [loading, setLoading]       = useState(false);
    const [clusterData, setClusterData] = useState(null);
    const [numClusters, setNumClusters] = useState(5);
    const [error, setError]           = useState(null);
    const [showPlotly, setShowPlotly] = useState(false);

    // FIX 2: accept n as param to avoid stale closure
    const loadClusters = useCallback(async (n) => {
        setLoading(true);
        setError(null);
        try {
            const response = await aiService.getDemandClusters(n);
            setClusterData(response.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load clusters');
            console.error('Cluster error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadClusters(5);
    }, [loadClusters]);

    // FIX 2: pass newN directly — no setTimeout, no stale state
    const handleClustersChange = (n) => {
        setNumClusters(n);
        loadClusters(n);
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🧮</div>
                <div style={{ fontSize: 16, color: '#666' }}>Running K-means clustering algorithm...</div>
                <div style={{ fontSize: 13, color: '#999', marginTop: 8 }}>Analyzing fault density patterns</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: 40, textAlign: 'center', background: '#ffebee', borderRadius: 8, color: '#c62828' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Clustering Failed</div>
                <div style={{ fontSize: 14, marginBottom: 20 }}>{error}</div>
                <button
                    onClick={() => loadClusters(numClusters)}
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

    if (!clusterData) return null;

    const clusters = clusterData.clusters ?? [];

    // FIX 1: guard cluster.faults with ?? [] so .map() never runs on undefined
    const scatterData = clusters.flatMap(cluster =>
        (cluster.faults ?? []).map(fault => ({
            latitude:  fault.latitude,
            longitude: fault.longitude,
            cluster:   cluster.cluster_id,
            faultId:   fault.fault_id,
        }))
    );

    const centerData = clusters.map(cluster => ({
        latitude:  cluster.latitude,
        longitude: cluster.longitude,
        cluster:   cluster.cluster_id,
        count:     cluster.fault_count,
    }));

    return (
        <div>
            {/* Header with controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ margin: '0 0 4px', fontSize: 20, color: '#1a237e' }}>
                        🗺️ Demand Hotspot Clustering (K-means)
                    </h2>
                    <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                        Geographic analysis of fault density to identify high-demand areas
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#666' }}>Number of Clusters:</span>
                    {[3, 4, 5, 6, 7].map(n => (
                        <button
                            key={n}
                            onClick={() => handleClustersChange(n)}
                            style={{
                                padding: '6px 16px',
                                border: numClusters === n ? '2px solid #1a237e' : '1px solid #ddd',
                                borderRadius: 6,
                                background: numClusters === n ? '#e8eaf6' : '#fff',
                                color: numClusters === n ? '#1a237e' : '#666',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: numClusters === n ? 600 : 400,
                            }}
                        >
                            {n}
                        </button>
                    ))}
                </div>
            </div>

            {/* Cluster Summary Cards */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                {clusters.map((cluster, index) => (
                    <div
                        key={cluster.cluster_id}
                        style={{
                            flex: 1, minWidth: 140, padding: '12px 16px',
                            background: '#fff',
                            border: `3px solid ${CLUSTER_COLORS[index % CLUSTER_COLORS.length]}`,
                            borderRadius: 8,
                        }}
                    >
                        <div style={{ fontSize: 24, fontWeight: 700, color: CLUSTER_COLORS[index % CLUSTER_COLORS.length], marginBottom: 4 }}>
                            {cluster.fault_count ?? '—'}
                        </div>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                            Cluster {cluster.cluster_id}
                        </div>
                        {/* FIX 3: safe toFixed via fmt() */}
                        <div style={{ fontSize: 11, color: '#999' }}>
                            {fmt(cluster.latitude)}, {fmt(cluster.longitude)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Toggle Plotly Map */}
            {clusterData.plot_html && (
                <div style={{ marginBottom: 20 }}>
                    <button
                        onClick={() => setShowPlotly(!showPlotly)}
                        style={{
                            padding: '10px 20px',
                            background: showPlotly ? '#e8eaf6' : '#1a237e',
                            color: showPlotly ? '#1a237e' : '#fff',
                            border: showPlotly ? '2px solid #1a237e' : 'none',
                            borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                        }}
                    >
                        {showPlotly ? '📊 Show Simple Chart' : '🗺️ Show Interactive Map'}
                    </button>
                </div>
            )}

            {/* Plotly Interactive Map */}
            {showPlotly && clusterData.plot_html ? (
                <div style={{ background: '#f9fafb', padding: 20, borderRadius: 8, border: '1px solid #e0e0e0' }}>
                    <div dangerouslySetInnerHTML={{ __html: clusterData.plot_html }} style={{ width: '100%', height: 600 }} />
                </div>
            ) : (
                <div style={{ background: '#f9fafb', padding: 20, borderRadius: 8, border: '1px solid #e0e0e0' }}>
                    <ResponsiveContainer width="100%" height={500}>
                        <ScatterChart>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                            <XAxis
                                type="number" dataKey="longitude" name="Longitude"
                                label={{ value: 'Longitude', position: 'insideBottom', offset: -5, style: { fontSize: 12 } }}
                                tick={{ fontSize: 11 }} stroke="#666"
                                domain={['dataMin - 0.05', 'dataMax + 0.05']}
                            />
                            <YAxis
                                type="number" dataKey="latitude" name="Latitude"
                                label={{ value: 'Latitude', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                                tick={{ fontSize: 11 }} stroke="#666"
                                domain={['dataMin - 0.05', 'dataMax + 0.05']}
                            />
                            <Tooltip
                                cursor={{ strokeDasharray: '3 3' }}
                                contentStyle={{ background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: 12 }}
                                formatter={(value, name) => [typeof value === 'number' ? value.toFixed(4) : value, name]}
                            />
                            <Legend wrapperStyle={{ paddingTop: 20 }} iconType="circle" />

                            {clusters.map((cluster, index) => {
                                const clusterPoints = scatterData.filter(p => p.cluster === cluster.cluster_id);
                                return (
                                    <Scatter
                                        key={`cluster-${cluster.cluster_id}`}
                                        name={`Cluster ${cluster.cluster_id} (${cluster.fault_count ?? 0})`}
                                        data={clusterPoints}
                                        fill={CLUSTER_COLORS[index % CLUSTER_COLORS.length]}
                                    />
                                );
                            })}

                            <Scatter name="Cluster Centers" data={centerData} fill="#000" shape="star">
                                {centerData.map((_, index) => (
                                    <Cell key={`center-${index}`} fill="#000" />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Insights */}
            <div style={{ marginTop: 20, padding: 16, background: '#e8f5e9', borderRadius: 8, borderLeft: '4px solid #388e3c' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2e7d32', marginBottom: 8 }}>💡 Insights</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#333', lineHeight: 1.8 }}>
                    <li>K-means algorithm groups faults by geographic proximity</li>
                    <li>Black stars represent cluster centers (highest density points)</li>
                    <li>Use hotspots to station technicians strategically</li>
                    <li>Larger clusters indicate areas needing more resources</li>
                </ul>
            </div>

            {/* Cluster Details Table */}
            <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 16, color: '#1a237e', marginBottom: 12 }}>Cluster Details</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                        {['Cluster', 'Center Latitude', 'Center Longitude', 'Fault Count', 'Recommendation'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Fault Count' ? 'center' : 'left', borderBottom: '2px solid #ddd' }}>
                                {h}
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {clusters.map((cluster, index) => (
                        <tr key={cluster.cluster_id} style={{ background: index % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee' }}>
                  <span style={{
                      display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                      background: CLUSTER_COLORS[index % CLUSTER_COLORS.length], marginRight: 8,
                  }} />
                                Cluster {cluster.cluster_id}
                            </td>
                            {/* FIX 3: all toFixed calls go through fmt() */}
                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee', fontFamily: 'monospace' }}>
                                {fmt(cluster.latitude, 6)}
                            </td>
                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee', fontFamily: 'monospace' }}>
                                {fmt(cluster.longitude, 6)}
                            </td>
                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee', textAlign: 'center', fontWeight: 600 }}>
                                {cluster.fault_count ?? '—'}
                            </td>
                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee', fontSize: 12, color: '#666' }}>
                                {(cluster.fault_count ?? 0) > 10 ? 'High priority — assign dedicated team' :
                                    (cluster.fault_count ?? 0) > 5  ? 'Medium priority — monitor closely' :
                                        'Low priority — standard coverage'}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            <button
                onClick={() => loadClusters(numClusters)}
                style={{
                    marginTop: 20, padding: '10px 24px', background: '#1a237e', color: '#fff',
                    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8,
                }}
            >
                🔄 Refresh Clusters
            </button>
        </div>
    );
}