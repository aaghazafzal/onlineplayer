// Each provider worker lives on its own subdomain; the workers.dev URL is a fallback
// for networks that block or fail to resolve the custom domain.
export const PROVIDER_ENDPOINTS = {
  terabox: ["https://terabox.onlineplayer.site", "https://terabox-player-api.onlineplayer.workers.dev"],
  instagram: ["https://instagram.onlineplayer.site", "https://instagram-player-api.onlineplayer.workers.dev"],
  spotify: ["https://spotify.onlineplayer.site", "https://spotify-player-api.onlineplayer.workers.dev"],
} as const;

export type ProviderName = keyof typeof PROVIDER_ENDPOINTS;

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * GET a JSON endpoint on a provider worker. Tries the next base URL on network
 * failures and non-JSON 5xx pages (Cloudflare 52x etc.); JSON answers are final,
 * since both URLs run the same worker code.
 */
export async function fetchProviderJson<T = Record<string, unknown>>(
  provider: ProviderName,
  path: string
): Promise<{ status: number; data: T }> {
  let lastError: unknown = null;

  for (const base of PROVIDER_ENDPOINTS[provider]) {
    try {
      const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        // non-JSON error page
      }
      if (res.status >= 500 && !data) {
        lastError = new ApiError(`Server error (${res.status})`, res.status);
        continue;
      }
      if (res.status === 429) {
        throw new ApiError(
          (data as { error?: string } | null)?.error || "Too many requests. Please wait a minute and try again.",
          429
        );
      }
      if (!data) throw new ApiError(`Unexpected response (${res.status})`, res.status);
      return { status: res.status, data: data as T };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      lastError = err;
    }
  }

  if (lastError instanceof DOMException && lastError.name === "TimeoutError") {
    throw new ApiError("The server took too long to respond. Please try again.");
  }
  throw new ApiError("Could not reach the server. Please check your connection and try again.");
}
