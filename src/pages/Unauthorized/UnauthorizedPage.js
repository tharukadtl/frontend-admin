import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function UnauthorizedPage() {
    const { logout } = useAuth();
    const navigate = useNavigate();

    return (
        <div style={{ padding: 40, textAlign: 'center' }}>
            <h2>Access Denied</h2>
            <p>You don't have permission to view this page.</p>
            <button onClick={() => { logout(); navigate('/login'); }}>
                Logout
            </button>
        </div>
    );
}