// Small import-free bridge that lets the AuthContext and the storage
// layer share auth state without forming an import cycle.
//
// - `_token`              : the JWT currently in use (or null when signed out)
// - `_unauthorizedHandler`: a callback storage.js fires when the server
//                           rejects a sync call with 401. AuthContext
//                           registers signOut here so the next render
//                           lands on LoginScreen.
//
// Keep this module dependency-free; both contexts/AuthContext.js and
// utils/storage.js import from it, so any further imports here would
// reintroduce the cycle this file exists to avoid.

let _token = null;
let _unauthorizedHandler = null;

export function getAuthToken() { return _token; }
export function setAuthToken(t) { _token = t || null; }

export function setUnauthorizedHandler(fn) { _unauthorizedHandler = fn || null; }
export function triggerUnauthorized() {
  if (typeof _unauthorizedHandler === 'function') {
    _unauthorizedHandler();
  }
}
