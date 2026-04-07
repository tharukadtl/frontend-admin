import React, { useState, useEffect } from 'react';
import jobsAPI from '../../api/jobs';

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      setJobs(response.data.content || response.data || []);
    } catch (error) {
      console.error('Failed to load jobs', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24 }}>Loading jobs...</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 20, color: '#1a237e' }}>Jobs Management</h1>
      
      <div style={{ background: '#fff', borderRadius: 12, padding: 20 }}>
        {jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
            No jobs found
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ padding: 12, textAlign: 'left' }}>Job #</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Fault</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Technician</th>
                <th style={{ padding: 12, textAlign: 'center' }}>Status</th>
                <th style={{ padding: 12, textAlign: 'center' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: 12 }}>{job.jobNumber}</td>
                  <td style={{ padding: 12 }}>{job.fault?.faultNumber || 'N/A'}</td>
                  <td style={{ padding: 12 }}>{job.assignedTechnician?.fullName || 'Unassigned'}</td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      background: job.status === 'COMPLETED' ? '#e8f5e9' : '#fff3e0',
                      color: job.status === 'COMPLETED' ? '#1b5e20' : '#e65100',
                    }}>
                      {job.status}
                    </span>
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    {new Date(job.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
