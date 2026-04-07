import api from './axios';

const authAPI = {
  // POST /auth/login
  login: (username, password, deviceInfo = 'Web Browser') =>
    api.post('/auth/login', { username, password, deviceInfo }),

  // POST /auth/otp/send
  sendOTP: (phoneNumber) =>
    api.post('/auth/otp/send', { phoneNumber }),

  // POST /auth/otp/verify
  verifyOTP: (phoneNumber, otp, deviceInfo = 'Web Browser') =>
    api.post('/auth/otp/verify', { phoneNumber, otp, deviceInfo }),

  // POST /auth/refresh
  refreshToken: (refreshToken) =>
    api.post('/auth/refresh', { refreshToken }),

  // POST /auth/logout
  logout: () =>
    api.post('/auth/logout'),
};

export default authAPI;
