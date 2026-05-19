// ─────────────────────────────────────────────────────────────────────────────
// API configuration
//
// Points at the production backend on the deploy host. Store builds and Expo
// Go on any network resolve to the same URL — no LAN auto-detection.
//
// To run against a local dev backend, override API_BASE at the call site or
// temporarily flip the constant below.
// ─────────────────────────────────────────────────────────────────────────────

export const API_BASE = 'https://api.threadia.app';

console.log(`[config] API_BASE → ${API_BASE}`);
