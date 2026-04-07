import axios from 'axios';

// Separate axios instance for AI/ML service (Python Flask on port 5000)
const aiAPI = axios.create({
  baseURL: process.env.REACT_APP_AI_URL || 'http://localhost:5000/api/ai',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds for ML processing
});

const aiService = {
  // ═══════════════════════════════════════════════════════════════════════
  // HEALTH CHECK
  // ═══════════════════════════════════════════════════════════════════════
  
  // GET /api/ai/health
  health: () => aiAPI.get('/health'),

  // ═══════════════════════════════════════════════════════════════════════
  // FAULT FORECASTING (Prophet)
  // ═══════════════════════════════════════════════════════════════════════
  
  // GET /api/ai/forecast?days=30
  // Returns: { dates: [], predictions: [], confidence_lower: [], confidence_upper: [], accuracy_metrics: {...} }
  getForecast: (days = 30) =>
    aiAPI.get('/forecast', { params: { days } }),

  // ═══════════════════════════════════════════════════════════════════════
  // DEMAND CLUSTERING (K-means)
  // ═══════════════════════════════════════════════════════════════════════
  
  // GET /api/ai/clusters?n=5
  // Returns: { clusters: [{cluster_id, latitude, longitude, fault_count, faults: [...]}], plot_html: "..." }
  getDemandClusters: (n = 5) =>
    aiAPI.get('/clusters', { params: { n } }),

  // ═══════════════════════════════════════════════════════════════════════
  // ROUTE OPTIMIZATION (Dijkstra)
  // ═══════════════════════════════════════════════════════════════════════
  
  // POST /api/ai/route/nearest
  // Body: { latitude: 6.9271, longitude: 79.8612 }
  // Returns: { nearest_technician: {...}, distance_km, estimated_time_minutes, route_map_html: "..." }
  findNearestTechnician: (latitude, longitude) =>
    aiAPI.post('/route/nearest', { latitude, longitude }),

  // POST /api/ai/route/optimize
  // Body: { fault_locations: [{latitude, longitude, fault_id}], technician_location: {latitude, longitude} }
  // Returns: { optimized_route: [...], total_distance_km, estimated_time_minutes, savings_percent, route_map_html: "..." }
  optimizeRoute: (faultLocations, technicianLocation) =>
    aiAPI.post('/route/optimize', {
      fault_locations: faultLocations,
      technician_location: technicianLocation,
    }),
};

export default aiService;
