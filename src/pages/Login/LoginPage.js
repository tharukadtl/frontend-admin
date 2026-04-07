import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]     = useState({ username: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.username, form.password);
      if (['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        navigate('/dashboard');
      } else {
        setError('Access denied. This portal is for Admin and Team Lead only.');
        localStorage.clear();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '40px 36px',
        width: 380, boxShadow: '0 16px 48px rgba(0,0,0,0.25)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>📡</div>
          <h1 style={{ margin: '8px 0 4px', fontSize: 22, color: '#1a237e' }}>SLT Field Operations</h1>
          <p style={{ margin: 0, color: '#666', fontSize: 14 }}>Admin Portal</p>
        </div>

        {error && (
          <div style={{
            background: '#ffebee', color: '#c62828', padding: '10px 14px',
            borderRadius: 6, marginBottom: 20, fontSize: 13
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#333' }}>
              Username
            </label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
              style={{
                width: '100%', padding: '10px 14px', border: '1px solid #ddd',
                borderRadius: 6, fontSize: 14, boxSizing: 'border-box', outline: 'none'
              }}
              placeholder="Enter your username"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#333' }}>
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              style={{
                width: '100%', padding: '10px 14px', border: '1px solid #ddd',
                borderRadius: 6, fontSize: 14, boxSizing: 'border-box', outline: 'none'
              }}
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px', background: loading ? '#9fa8da' : '#1a237e',
            color: '#fff', border: 'none', borderRadius: 6, fontSize: 15,
            fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer'
          }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
