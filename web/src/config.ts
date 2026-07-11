// Backend connection config for the web frontend
// Web app and backend run on the same machine, so we use localhost
// The LAN IP (from /network-info) is only used in the QR payload for mobile
export const API_BASE_URL = "http://127.0.0.1:8000";
export const WS_BASE_URL = "ws://127.0.0.1:8000";
