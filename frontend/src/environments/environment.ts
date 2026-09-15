export const environment = {
  production: false,

  // Base URL of the Node/Express API in server/ — the only backend. Must match the port
  // in server/.env and be listed in its CORS_ORIGINS.
  apiUrl: 'http://localhost:5000/api',

  // Publishable Razorpay key. Only used as a fallback — the payment page prefers the
  // keyId the API returns, so the browser and server can never disagree about it.
  razorpayKey: 'rzp_test_StUXVR38ZRun4I',
};
