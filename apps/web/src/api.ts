import type { DashboardResponse } from './types';

const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function loadDashboard(): Promise<DashboardResponse> {
  const response = await fetch(`${base}/api/v1/dashboard`, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);
  return response.json();
}
