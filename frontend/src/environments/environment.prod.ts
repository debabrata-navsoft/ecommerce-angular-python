// NOTE: angular.json defines no `fileReplacements`, so this file is NOT used by
// `ng build --configuration production` — environment.ts is what ships. Either add a
// fileReplacements entry for this file or keep the production values in environment.ts.
export const environment = {
  production: true,

  // Same-origin path: works when the API is reverse-proxied under /api alongside the SSR
  // server. Change to an absolute URL if the API is on its own domain.
  apiUrl: '/api',

  razorpayKey: 'rzp_test_StUXVR38ZRun4I',
};
