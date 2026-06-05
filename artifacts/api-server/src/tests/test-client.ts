const BASE = process.env.API_BASE ?? "http://localhost:8080/api/v1";

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  ok: boolean;
  headers: Record<string, string>;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  extraHeaders?: Record<string, string>,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });

  let responseBody: T;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    responseBody = await res.json() as T;
  } else {
    responseBody = (await res.text()) as unknown as T;
  }

  const headersMap: Record<string, string> = {};
  res.headers.forEach((v, k) => { headersMap[k] = v; });

  return {
    status: res.status,
    body: responseBody,
    ok: res.ok,
    headers: headersMap,
  };
}

export function createClient(defaultToken?: string) {
  return {
    get: <T = unknown>(path: string, token?: string) =>
      request<T>("GET", path, undefined, token ?? defaultToken),

    post: <T = unknown>(path: string, body: unknown, token?: string) =>
      request<T>("POST", path, body, token ?? defaultToken),

    patch: <T = unknown>(path: string, body: unknown, token?: string) =>
      request<T>("PATCH", path, body, token ?? defaultToken),

    put: <T = unknown>(path: string, body: unknown, token?: string) =>
      request<T>("PUT", path, body, token ?? defaultToken),

    delete: <T = unknown>(path: string, token?: string) =>
      request<T>("DELETE", path, undefined, token ?? defaultToken),

    withToken: (token: string) => createClient(token),

    withApiKey: <T = unknown>(method: string, path: string, body?: unknown, apiKey?: string) =>
      request<T>(method, path, body, `gos_${apiKey}`, undefined),
  };
}

export const client = createClient();
