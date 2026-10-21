import { projectId, publicAnonKey } from "../../utils/supabase/info";

export type SimulationOutcome = "outage" | "recovered";

export type SimulationRun = {
  id: string;
  startedAt: string;
  completedAt: string;
  outcome: SimulationOutcome;
  stagesReached: number;
  elapsedSeconds: number;
  finalMetrics: {
    failedRequests: number;
    responseTimeMs: number;
    successRate: number;
    activeFaults: number;
  };
};

const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-d25f2502`;
const clientIdKey = "resilience-lab-client-id";

function getClientId() {
  const existing = window.localStorage.getItem(clientIdKey);
  if (existing) return existing;

  const clientId = crypto.randomUUID();
  window.localStorage.setItem(clientIdKey, clientId);
  return clientId;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${publicAnonKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? `Request failed with status ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

export async function getSimulationHistory() {
  const clientId = getClientId();
  return request<{ runs: SimulationRun[]; total: number }>(
    `/runs?clientId=${encodeURIComponent(clientId)}&limit=20`,
  );
}

export async function saveSimulationRun(run: SimulationRun) {
  return request<{ run: SimulationRun }>("/runs", {
    method: "POST",
    body: JSON.stringify({ ...run, clientId: getClientId() }),
  });
}
