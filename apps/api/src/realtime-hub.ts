// Durable Object RealtimeHub: mỗi người dùng một hub (idFromName(userId)) giữ WebSocket của mọi tab và thiết bị.
// Dùng WebSocket Hibernation: khi không có gì gửi, Durable Object được Cloudflare cho "ngủ" mà kết nối vẫn mở,
// nên hàng nghìn người mở web cùng lúc không tốn phí thời gian chạy.
//
// Viết dạng class thường (state, env) thay vì kế thừa DurableObject của "cloudflare:workers", để test được trên Node.

/** Phần DurableObjectState mà hub dùng (đủ để thay bằng bản giả trong test). */
export interface HubState {
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  setWebSocketAutoResponse?(pair: WebSocketRequestResponsePair): void;
}

/** Phần chỉ có trên Workers (WebSocketPair, response 101); test thay bằng bản giả. */
export interface HubRuntime {
  pair(): { client: WebSocket; server: WebSocket };
  upgrade(client: WebSocket): Response;
}
const workerRuntime: HubRuntime = {
  pair: () => {
    const p = new WebSocketPair();
    return { client: p[0], server: p[1] };
  },
  upgrade: (client) => new Response(null, { status: 101, webSocket: client }),
};

/** Mỗi người tối đa bấy nhiêu kết nối (tab, thiết bị); quá thì đóng kết nối cũ nhất. */
export const MAX_SOCKETS = 20;

export class RealtimeHub {
  constructor(private readonly state: HubState, _env?: unknown, private readonly runtime: HubRuntime = workerRuntime) {
    // Trình duyệt gửi "ping" mỗi 30 giây để giữ kết nối; Cloudflare tự trả "pong" mà không đánh thức hub.
    if (typeof WebSocketRequestResponsePair !== 'undefined') state.setWebSocketAutoResponse?.(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/publish' && request.method === 'POST') {
      const event = await request.text();
      let sent = 0;
      for (const ws of this.state.getWebSockets()) {
        try {
          ws.send(event);
          sent += 1;
        } catch {
          // Kết nối đã chết: Cloudflare sẽ gọi webSocketClose, không cần làm gì thêm.
        }
      }
      return Response.json({ sent });
    }
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('Cần WebSocket', { status: 426 });
    const open = this.state.getWebSockets();
    for (const old of open.slice(0, Math.max(0, open.length - MAX_SOCKETS + 1))) old.close(1013, 'Quá nhiều kết nối');
    const { client, server } = this.runtime.pair();
    this.state.acceptWebSocket(server);
    return this.runtime.upgrade(client);
  }

  /** Hub chỉ phát xuống; tin trình duyệt gửi lên (ngoài ping tự trả lời) bị bỏ qua. */
  async webSocketMessage(): Promise<void> {}

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code, reason);
    } catch {
      // đã đóng
    }
  }
}
