import type { HistoricalDashboard, PredictionDashboard } from './types';

const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { accept: 'application/json', ...(init?.headers || {}) }
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export function loadPredictions() {
  return request<PredictionDashboard>('/api/v1/predictions');
}

export function rebuildAndLoadPredictions() {
  return request<{
    rebuild: {
      accepted: boolean;
      joined: boolean;
      coolingDown: boolean;
      retryAfterSeconds: number;
      status: 'running' | 'succeeded' | 'failed';
      completedAt?: string;
    };
    dashboard: PredictionDashboard;
  }>('/api/v1/predictions/refresh', { method: 'POST' });
}

export function loadHistoricalDashboard() {
  return request<HistoricalDashboard>('/api/v1/dashboard');
}
