import React, { createContext, useContext, useState, useEffect } from 'react';
import authAPI from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');
    
    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse user data', e);
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const response = await authAPI.login(username, password);
    const { accessToken, refreshToken, ...userData } = response.data;
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      localStorage.clear();
      setUser(null);
    }
  };

  // Role check helpers
  const isSuperAdmin = () => user?.role === 'SUPER_ADMIN';
  const isAdmin = () => ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);
  const isTeamLead = () => user?.role === 'TEAM_LEAD';
  const isTechnician = () => user?.role === 'TECHNICIAN';
  const isClient = () => user?.role === 'CLIENT';

  const value = {
    user,
    loading,
    login,
    logout,
    isSuperAdmin,
    isAdmin,
    isTeamLead,
    isTechnician,
    isClient,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
