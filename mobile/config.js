// ─────────────────────────────────────────────────────────────────────────────
// API configuration
//
// Your backend is running on port 5001.
// From a real phone / Expo Go, you CANNOT use localhost — use your machine's
// local network IP instead.
//
// Mac:     System Preferences → Network, or run: ipconfig getifaddr en0
// Windows: ipconfig | findstr "IPv4"
// Linux:   hostname -I
//
// Your current local IP appears to be: 192.168.1.33
// ─────────────────────────────────────────────────────────────────────────────

// Ngrok tunnel — no router/firewall issues
export const API_BASE = 'https://volatile-barometer-remold.ngrok-free.dev';
