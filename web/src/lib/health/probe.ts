export interface HealthCheckResult {
  status: "ready" | "unavailable" | "unknown";
  reason?: string;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 3000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "Accept": "application/json",
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function probeUrl(url: string): Promise<HealthCheckResult> {
  try {
    const response = await fetchWithTimeout(url);

    if (response.status === 200) {
      try {
        const data = await response.json();
        if (data.status === "ready") {
          return { status: "ready" };
        }
        if (data.status === "ok") {
          return { status: "ready" };
        }
        return {
          status: "unavailable",
          reason: "API did not acknowledge health",
        };
      } catch {
        return {
          status: "unavailable",
          reason: "API response was not valid JSON",
        };
      }
    }

    if (response.status === 503) {
      return {
        status: "unavailable",
        reason: "The database is not reachable",
      };
    }

    return {
      status: "unavailable",
      reason: `API returned status ${response.status}`,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        status: "unavailable",
        reason: "Request timeout after 3 seconds",
      };
    }
    return {
      status: "unavailable",
      reason: "The API did not answer",
    };
  }
}

export async function probeHealth(): Promise<HealthCheckResult> {
  const apiBaseUrl = process.env.API_BASE_URL;
  if (!apiBaseUrl) {
    return {
      status: "unknown",
      reason: "API_BASE_URL not configured",
    };
  }

  return probeUrl(`${apiBaseUrl}/healthz`);
}

export async function probeReadiness(): Promise<HealthCheckResult> {
  const apiBaseUrl = process.env.API_BASE_URL;
  if (!apiBaseUrl) {
    return {
      status: "unknown",
      reason: "API_BASE_URL not configured",
    };
  }

  return probeUrl(`${apiBaseUrl}/readyz`);
}
