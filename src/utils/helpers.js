// Format date to YYYY-MM-DD
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

// Format datetime to readable string
export const formatDateTime = (datetime) => {
  if (!datetime) return '';
  const d = new Date(datetime);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Time ago (e.g., "2 hours ago")
export const timeAgo = (datetime) => {
  if (!datetime) return '';
  const now = new Date();
  const past = new Date(datetime);
  const seconds = Math.floor((now - past) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return formatDate(datetime);
};

// Format currency
export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return 'Rs. 0';
  return `Rs. ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Extract data from paginated response
export const extractData = (response) => {
  // Handle Page<T> from Spring Boot
  if (response?.content) {
    return {
      items: response.content,
      total: response.totalElements,
      pages: response.totalPages,
      current: response.number,
    };
  }
  // Handle direct array
  if (Array.isArray(response)) {
    return { items: response, total: response.length };
  }
  // Handle single object
  return { items: [response], total: 1 };
};

// Role display names
export const getRoleDisplay = (role) => {
  const map = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    TEAM_LEAD: 'Team Lead',
    TECHNICIAN: 'Technician',
    CLIENT: 'Client',
  };
  return map[role] || role;
};

// Status colors
export const getStatusColor = (status) => {
  const colors = {
    // Common
    PENDING: '#e65100',
    ACTIVE: '#1b5e20',
    INACTIVE: '#757575',
    
    // Faults
    REPORTED: '#0d47a1',
    ASSIGNED: '#283593',
    IN_PROGRESS: '#004d40',
    ON_HOLD: '#f57f17',
    COMPLETED: '#1b5e20',
    CANCELLED: '#880e4f',
    
    // Payments
    APPROVED: '#1b5e20',
    REJECTED: '#b71c1c',
    BILLED: '#1b5e20',
    
    // Stock
    IN_STOCK: '#1b5e20',
    LOW_STOCK: '#e65100',
    OUT_OF_STOCK: '#b71c1c',
    
    // Vehicle
    UNDER_MAINTENANCE: '#e65100',
    DECOMMISSIONED: '#757575',
  };
  return colors[status] || '#757575';
};

// Validate email
export const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Validate phone (Sri Lanka format)
export const isValidPhone = (phone) => {
  return /^0\d{9}$/.test(phone);
};

// Handle API errors
export const getErrorMessage = (error) => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

// Download file from blob
export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
