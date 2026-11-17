// Nói chuyện với MCP từ xa của Hội Mình (POST <API>/mcp, JSON-RPC) bằng API key.
// Bộ lệnh nằm ở máy chủ (apps/api/src/mcp), không còn bản sao ở đây: máy chủ thêm lệnh là bản stdio này có ngay.
export interface Remote {
  /** Gửi một yêu cầu JSON-RPC, trả `result`. Ném lỗi khi HTTP lỗi hoặc máy chủ trả `error`. */
  request<T>(method: string, params?: unknown): Promise<T>;
}

export function createRemote(apiUrl: string, apiKey: string, fetchImpl: typeof fetch = fetch): Remote {
  const endpoint = `${apiUrl.replace(/\/+$/, '')}/mcp`;
  let id = 0;
  return {
    async request<T>(method: string, params?: unknown): Promise<T> {
      id += 1;
      const res = await fetchImpl(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
      const text = await res.text();
      let data: { result?: T; error?: { message?: string }; code?: string; message?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Máy chủ trả về nội dung không phải JSON (HTTP ${res.status}). Kiểm tra HOIMINH_API_URL: ${endpoint}`);
      }
      if (!res.ok) throw new Error(`${data.code ?? res.status}: ${data.message ?? data.error?.message ?? 'Lỗi máy chủ'}`);
      if (data.error) throw new Error(data.error.message ?? 'Lỗi MCP');
      return data.result as T;
    },
  };
}
