export type BegEvent = {
  request_id: string;
  country: string;
  at: string;
};

export type BegSnapshot = {
  type: 'reset-request-count';
  cycle_id: string;
  since: string;
  count: number;
  events: BegEvent[];
};

type Cycle = { id: string | null; since: string | null };

export class BegCounter {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname.endsWith('/live')) {
      return this.live(request);
    }

    const snapshot = await this.ensureCycle(this.cycleFrom(request));
    if (request.method === 'POST') {
      const country = request.headers.get('x-country') || '??';
      const next: BegSnapshot = {
        ...snapshot,
        count: snapshot.count + 1,
        events: [
          { request_id: crypto.randomUUID(), country, at: new Date().toISOString() },
          ...snapshot.events,
        ].slice(0, 16),
      };

      await this.state.storage.put('snapshot', next);
      this.broadcast(next);

      return this.json(next);
    }

    return this.json(snapshot);
  }

  private cycleFrom(request: Request): Cycle {
    return {
      id: request.headers.get('x-cycle-id'),
      since: request.headers.get('x-cycle-since'),
    };
  }

  private async ensureCycle(cycle: Cycle): Promise<BegSnapshot> {
    const current = await this.state.storage.get<BegSnapshot>('snapshot');
    if (!current) {
      const first = this.emptySnapshot(cycle);
      await this.state.storage.put('snapshot', first);
      return first;
    }

    if (cycle.id && cycle.since && current.cycle_id !== cycle.id) {
      const next = this.emptySnapshot(cycle);
      await this.state.storage.put('snapshot', next);
      this.broadcast(next);
      return next;
    }

    return current;
  }

  private emptySnapshot(cycle: Cycle): BegSnapshot {
    return {
      type: 'reset-request-count',
      cycle_id: cycle.id ?? 'unresolved',
      since: cycle.since ?? new Date().toISOString(),
      count: 0,
      events: [],
    };
  }

  private async live(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const snapshot = await this.ensureCycle(this.cycleFrom(request));
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // Hibernation API: Cloudflare can evict this Durable Object from memory while
    // the browser remains connected, so idle live sessions do not accrue duration.
    this.state.acceptWebSocket(server);
    server.send(JSON.stringify(snapshot));

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private broadcast(value: BegSnapshot) {
    const payload = JSON.stringify(value);

    for (const socket of this.state.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {
        try {
          socket.close(1011, 'broadcast failed');
        } catch {
          // The runtime will eventually remove a disconnected socket.
        }
      }
    }
  }

  webSocketMessage(_socket: WebSocket, _message: ArrayBuffer | string) {
    // The live counter is server-push only. Keeping this handler intentionally
    // empty avoids application-level keepalives that would wake a hibernated DO.
  }

  webSocketClose(socket: WebSocket, code: number, reason: string) {
    // Compatibility dates >= 2026-04-07 auto-reply to close frames, but explicitly
    // closing here is harmless and keeps behavior clear for older runtimes.
    try {
      socket.close(code, reason);
    } catch {
      // Socket may already be fully closed.
    }
  }

  private json(value: BegSnapshot) {
    return Response.json(value, { headers: { 'cache-control': 'no-store' } });
  }
}
