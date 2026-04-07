import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();

  const linkStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 20px',
    color: '#333',
    textDecoration: 'none',
    borderRadius: 8,
    transition: 'background 0.2s',
  };

  const activeLinkStyle = {
    ...linkStyle,
    background: '#e8eaf6',
    color: '#1a237e',
    fontWeight: 600,
  };

  return (
    <div style={{
      width: 260,
      background: '#fff',
      borderRight: '1px solid #e0e0e0',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px', borderBottom: '1px solid #e0e0e0' }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#1a237e', fontWeight: 700 }}>
          📡 SLT Field Ops
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
          {user?.fullName}
        </p>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '20px 12px', overflowY: 'auto' }}>
        <NavLink
          to="/dashboard"
          style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}
        >
          <span style={{ fontSize: 20 }}>📊</span>
          <span>Dashboard</span>
        </NavLink>

        {/* ⭐ NEW: AI Dashboard Link (Admin only) */}
        {isAdmin() && (
          <NavLink
            to="/ai-dashboard"
            style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}
          >
            <span style={{ fontSize: 20 }}>🤖</span>
            <span>AI Dashboard</span>
          </NavLink>
        )}

        <NavLink
          to="/faults"
          style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}
        >
          <span style={{ fontSize: 20 }}>⚡</span>
          <span>Faults</span>
        </NavLink>

        <NavLink
          to="/jobs"
          style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}
        >
          <span style={{ fontSize: 20 }}>👷</span>
          <span>Jobs</span>
        </NavLink>

        {isAdmin() && (
          <NavLink
            to="/users"
            style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}
          >
            <span style={{ fontSize: 20 }}>👥</span>
            <span>Users</span>
          </NavLink>
        )}

        {isSuperAdmin() && (
          <NavLink
            to="/branches"
            style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}
          >
            <span style={{ fontSize: 20 }}>🏢</span>
            <span>Branches</span>
          </NavLink>
        )}

        <NavLink
          to="/inventory"
          style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}
        >
          <span style={{ fontSize: 20 }}>📦</span>
          <span>Inventory</span>
        </NavLink>

        <NavLink
          to="/vehicles"
          style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}
        >
          <span style={{ fontSize: 20 }}>🚗</span>
          <span>Vehicles</span>
        </NavLink>

        {isAdmin() && (
          <NavLink
            to="/payments"
            style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}
          >
            <span style={{ fontSize: 20 }}>💰</span>
            <span>Payments</span>
          </NavLink>
        )}

        <NavLink
          to="/kpi"
          style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}
        >
          <span style={{ fontSize: 20 }}>🏆</span>
          <span>KPI</span>
        </NavLink>

        <NavLink
          to="/notifications"
          style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}
        >
          <span style={{ fontSize: 20 }}>🔔</span>
          <span>Notifications</span>
        </NavLink>
      </nav>

      {/* Logout Button */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0' }}>
        <button
          onClick={logout}
          style={{
            width: '100%',
            padding: '12px',
            background: '#fff',
            color: '#c62828',
            border: '1px solid #c62828',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span>🚪</span>
          Logout
        </button>
      </div>
    </div>
  );
}
