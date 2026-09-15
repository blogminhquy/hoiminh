// HTTP client tối giản cho API Hội Mình với API key.
export interface Client {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
}

export function createClient(apiUrl: string, apiKey: string, fetchImpl: typeof fetch = fetch): Client {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetchImpl(`${apiUrl}${path}`, { method, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    const data = text ? (JSON.parse(text) as T & { code?: string; message?: string }) : ({} as T & { code?: string; message?: string });
    if (!res.ok) throw new Error(`${data.code ?? res.status}: ${data.message ?? 'Lỗi API'}`);
    return data;
  }
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b ?? {}), patch: (p, b) => call('PATCH', p, b ?? {}) };
}
