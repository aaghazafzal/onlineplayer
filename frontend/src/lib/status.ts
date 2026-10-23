"use client";

import { useEffect, useState } from "react";

const STATUS_URL = "https://status.onlineplayer.site/api/status";

export interface ServiceStatus {
  ok: boolean;
  latencyMs: number;
  uptime: number | null; // % over the last 24h
  lastCheckedAt: number | null;
}

export type ServiceId = "site" | "terabox" | "resolver" | "instagram" | "spotify";

/**
 * Live state of each service from the health monitor (checked every 15 minutes).
 * Returns null while loading or if the monitor is unreachable; callers then show nothing.
 */
export function useServiceStatus(): Partial<Record<ServiceId, ServiceStatus>> | null {
  const [status, setStatus] = useState<Partial<Record<ServiceId, ServiceStatus>> | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(STATUS_URL, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.checks) return;
        const out: Partial<Record<ServiceId, ServiceStatus>> = {};
        for (const [id, c] of Object.entries<{ ok: boolean; latencyMs: number; lastCheckedAt?: number }>(data.checks)) {
          out[id as ServiceId] = {
            ok: Boolean(c.ok),
            latencyMs: c.latencyMs,
            uptime: data.uptime?.[id] ?? null,
            lastCheckedAt: c.lastCheckedAt ?? null,
          };
        }
        setStatus(out);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  return status;
}

export function formatLatency(ms: number) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}
