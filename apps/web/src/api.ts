import type { HistoricalDashboard, PredictionDashboard } from './types';

const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${base}${path}`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export function loadPredictions() {
  return request<PredictionDashboard>('/api/v1/predictions');
}

export function loadHistoricalDashboard() {
  return request<HistoricalDashboard>('/api/v1/dashboard');
}
