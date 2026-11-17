// API base URL
// Use VITE_API_URL if defined, otherwise dynamically use the current domain (e.g. https://videotool.net)
const API_BASE = import.meta.env.VITE_API_URL ?? (typeof window !== 'undefined' ? window.location.origin : 'https://taivideonhanh.com');
export default API_BASE;
