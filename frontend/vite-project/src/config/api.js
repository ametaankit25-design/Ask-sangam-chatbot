/**
 * Centralized API configuration.
 * - If VITE_API_URL is provided (e.g., http://localhost:5000 in dev), uses `${VITE_API_URL}/api`.
 * - Otherwise defaults to '/api', perfectly resolving via Nginx reverse proxy on EC2 / production.
 */
const envUrl = import.meta.env.VITE_API_URL;

export const API_BASE = envUrl ? `${envUrl.replace(/\/+$/, '')}/api` : '/api';
