import React, { useState, useEffect } from 'react';
import aiService from '../../api/ai';

export default function RouteOptimizer() {
  const [mode, setMode] = useState('nearest'); // 'nearest' | 'optimize'
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Nearest technician mode
  const [faultLat, setFaultLat] = useState('6.9271');
  const [faultLon, setFaultLon] = useState('79.8612');

  // Route optimization mode
  const [faultLocations, setFaultLocations] = useState([
    { latitude: 6.9271, longitude: 79.8612, faultId: 'FLT-001' },
    { latitude: 6.9310, longitude: 79.8450, faultId: 'FLT-002' },
    { latitude: 6.9180, longitude: 79.8700, faultId: 'FLT-003' },
  ]);
  const [techLat, setTechLat] = useState('6.9200');
  const [techLon, setTechLon] = useState('79.8500');

  const findNearest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await aiService.findNearestTechnician(
        parseFloat(faultLat),
        parseFloat(faultLon)
      );
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to find nearest technician');
      console.error('Route error:', err);
    } finally {
      setLoading(false);
    }
  };

  const optimizeRoute = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await aiService.optimizeRoute(
        faultLocations.map(f => ({
          latitude: parseFloat(f.latitude),
          longitude: parseFloat(f.longitude),
          fault_id: f.faultId,
        })),
        {
          latitude: parseFloat(techLat),
          longitude: parseFloat(techLon),
        }
      );
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to optimize route');
      console.error('Optimization error:', err);
    } finally {
      setLoading(false);
    }
  };

  const addFaultLocation = () => {
    setFaultLocations([
      ...faultLocations,
      { latitude: 6.9000, longitude: 79.8000, faultId: `FLT-${String(faultLocations.length + 1).padStart(3, '0')}` },
    ]);
  };

  const removeFaultLocation = (index) => {
    setFaultLocations(faultLocations.filter((_, i) => i !== index));
  };

  const updateFaultLocation = (index, field, value) => {
    const updated = [...faultLocations];
    updated[index][field] = value;
    setFaultLocations(updated);
  };

  return (
    <div>
      {/* Mode Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '2px solid #e0e0e0' }}>
        <button
          onClick={() => setMode('nearest')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: mode === 'nearest' ? '3px solid #1a237e' : 'none',
            background: 'transparent',
            color: mode === 'nearest' ? '#1a237e' : '#666',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          🎯 Find Nearest Technician
        </button>
        <button
          onClick={() => setMode('optimize')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: mode === 'optimize' ? '3px solid #1a237e' : 'none',
            background: 'transparent',
            color: mode === 'optimize' ? '#1a237e' : '#666',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          🛣️ Optimize Multi-Stop Route
        </button>
      </div>

      {/* Nearest Technician Mode */}
      {mode === 'nearest' && (
        <div>
          <h3 style={{ fontSize: 18, color: '#1a237e', marginBottom: 16 }}>
            Find Nearest Available Technician
          </h3>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
            Uses Dijkstra's algorithm to find the shortest path from fault location to the nearest technician
          </p>

          <div style={{
            background: '#f9fafb',
            padding: 20,
            borderRadius: 8,
            marginBottom: 20,
          }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }}>
                Fault Location Latitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={faultLat}
                onChange={(e) => setFaultLat(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: 'monospace',
                }}
                placeholder="e.g., 6.9271"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }}>
                Fault Location Longitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={faultLon}
                onChange={(e) => setFaultLon(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: 'monospace',
                }}
                placeholder="e.g., 79.8612"
              />
            </div>

            <button
              onClick={findNearest}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? '#ccc' : '#1a237e',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {loading ? '⏳ Calculating...' : '🔍 Find Nearest Technician'}
            </button>
          </div>

          {/* Nearest Result */}
          {result && result.nearest_technician && (
            <div style={{
              background: '#e8f5e9',
              padding: 20,
              borderRadius: 8,
              border: '2px solid #388e3c',
            }}>
              <h4 style={{ fontSize: 16, color: '#2e7d32', marginBottom: 16 }}>
                ✅ Nearest Technician Found
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Technician</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>
                    {result.nearest_technician.name || `ID: ${result.nearest_technician.id}`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Distance</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#1a237e' }}>
                    {result.distance_km.toFixed(2)} km
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Estimated Time</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#f57c00' }}>
                    {result.estimated_time_minutes} min
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Location</div>
                  <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#333' }}>
                    {result.nearest_technician.latitude.toFixed(4)}, {result.nearest_technician.longitude.toFixed(4)}
                  </div>
                </div>
              </div>

              {result.route_map_html && (
                <div
                  dangerouslySetInnerHTML={{ __html: result.route_map_html }}
                  style={{ width: '100%', height: 400, marginTop: 16 }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Multi-Stop Route Optimization Mode */}
      {mode === 'optimize' && (
        <div>
          <h3 style={{ fontSize: 18, color: '#1a237e', marginBottom: 16 }}>
            Optimize Multi-Stop Route
          </h3>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
            Calculates the most efficient route to visit multiple fault locations, reducing travel time by 15-20%
          </p>

          <div style={{
            background: '#f9fafb',
            padding: 20,
            borderRadius: 8,
            marginBottom: 20,
          }}>
            {/* Technician Start Location */}
            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '2px solid #e0e0e0' }}>
              <h4 style={{ fontSize: 15, color: '#333', marginBottom: 12 }}>
                📍 Technician Starting Location
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={techLat}
                    onChange={(e) => setTechLat(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #ddd',
                      borderRadius: 6,
                      fontSize: 13,
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={techLon}
                    onChange={(e) => setTechLon(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #ddd',
                      borderRadius: 6,
                      fontSize: 13,
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Fault Locations */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 15, color: '#333', marginBottom: 12 }}>
                🎯 Fault Locations to Visit
              </h4>
              {faultLocations.map((fault, index) => (
                <div
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 1fr 1fr 40px',
                    gap: 8,
                    marginBottom: 8,
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="text"
                    value={fault.faultId}
                    onChange={(e) => updateFaultLocation(index, 'faultId', e.target.value)}
                    style={{
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: 'monospace',
                    }}
                    placeholder="ID"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    value={fault.latitude}
                    onChange={(e) => updateFaultLocation(index, 'latitude', e.target.value)}
                    style={{
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: 'monospace',
                    }}
                    placeholder="Latitude"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    value={fault.longitude}
                    onChange={(e) => updateFaultLocation(index, 'longitude', e.target.value)}
                    style={{
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: 'monospace',
                    }}
                    placeholder="Longitude"
                  />
                  <div style={{ fontSize: 20, color: '#1a237e', fontWeight: 700 }}>
                    {index + 1}
                  </div>
                  <button
                    onClick={() => removeFaultLocation(index)}
                    disabled={faultLocations.length <= 2}
                    style={{
                      padding: '6px',
                      background: faultLocations.length <= 2 ? '#eee' : '#ffebee',
                      color: faultLocations.length <= 2 ? '#999' : '#c62828',
                      border: 'none',
                      borderRadius: 4,
                      cursor: faultLocations.length <= 2 ? 'not-allowed' : 'pointer',
                      fontSize: 16,
                    }}
                    title="Remove location"
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                onClick={addFaultLocation}
                style={{
                  marginTop: 8,
                  padding: '8px 16px',
                  background: '#e8eaf6',
                  color: '#1a237e',
                  border: '1px dashed #1a237e',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                + Add Fault Location
              </button>
            </div>

            <button
              onClick={optimizeRoute}
              disabled={loading || faultLocations.length < 2}
              style={{
                width: '100%',
                padding: '12px',
                background: loading || faultLocations.length < 2 ? '#ccc' : '#1a237e',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: loading || faultLocations.length < 2 ? 'not-allowed' : 'pointer',
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {loading ? '⏳ Optimizing...' : '🚀 Optimize Route'}
            </button>
          </div>

          {/* Optimization Result */}
          {result && result.optimized_route && (
            <div style={{
              background: '#e3f2fd',
              padding: 20,
              borderRadius: 8,
              border: '2px solid #1976d2',
            }}>
              <h4 style={{ fontSize: 16, color: '#0d47a1', marginBottom: 16 }}>
                ✅ Optimized Route Generated
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Total Distance</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1976d2' }}>
                    {result.total_distance_km.toFixed(2)} km
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Estimated Time</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#f57c00' }}>
                    {result.estimated_time_minutes} min
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Time Saved</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#2e7d32' }}>
                    {result.savings_percent.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h5 style={{ fontSize: 14, color: '#0d47a1', marginBottom: 8 }}>
                  📋 Optimized Visit Order:
                </h5>
                <ol style={{ margin: 0, paddingLeft: 24, fontSize: 13, lineHeight: 2 }}>
                  {result.optimized_route.map((stop, index) => (
                    <li key={index} style={{ color: '#333' }}>
                      <strong>{stop.fault_id}</strong> — ({stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)})
                    </li>
                  ))}
                </ol>
              </div>

              {result.route_map_html && (
                <div
                  dangerouslySetInnerHTML={{ __html: result.route_map_html }}
                  style={{ width: '100%', height: 500, marginTop: 16 }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 20,
          padding: 16,
          background: '#ffebee',
          borderRadius: 8,
          color: '#c62828',
          borderLeft: '4px solid #c62828',
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Info */}
      <div style={{
        marginTop: 24,
        padding: 16,
        background: '#fff3e0',
        borderRadius: 8,
        borderLeft: '4px solid #f57c00',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e65100', marginBottom: 8 }}>
          💡 How It Works
        </div>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#333', lineHeight: 1.8 }}>
          <li><strong>Dijkstra's Algorithm:</strong> Finds shortest path between two points on a weighted graph</li>
          <li><strong>Travel Time Estimation:</strong> Average speed 40 km/h in urban areas, 60 km/h highways</li>
          <li><strong>Route Optimization:</strong> Uses nearest neighbor heuristic for multi-stop planning</li>
          <li><strong>Expected Savings:</strong> 15-20% reduction in total travel time vs random order</li>
        </ul>
      </div>
    </div>
  );
}
