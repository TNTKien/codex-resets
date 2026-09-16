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

type Env = Record<string, never>;

type Cycle = { id: string | null; since: string | null };

export class BegCounter extends DurableObject<Env> {
  private sessions = new Set<WritableStreamDefaultWriter<Uint8Array>>();
  private encoder = new TextEncoder();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname.endsWith('/live')) return this.live(request);

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
      await this.ctx.storage.put('snapshot', next);
      await this.broadcast(next);
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
    const current = await this.ctx.storage.get<BegSnapshot>('snapshot');
    if (!current) {
      const first = this.emptySnapshot(cycle);
      await this.ctx.storage.put('snapshot', first);
      return first;
    }

    if (cycle.id && cycle.since && current.cycle_id !== cycle.id) {
      const next = this.emptySnapshot(cycle);
      await this.ctx.storage.put('snapshot', next);
      await this.broadcast(next);
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
    const snapshot = await this.ensureCycle(this.cycleFrom(request));
    const stream = new TransformStream<Uint8Array, Uint8Array>();
    const writer = stream.writable.getWriter();
    this.sessions.add(writer);

    await writer.write(this.event(snapshot));
    request.signal.addEventListener('abort', () => {
      this.sessions.delete(writer);
      writer.close().catch(() => {});
    }, { once: true });

    return new Response(stream.readable, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        'connection': 'keep-alive',
        'x-accel-buffering': 'no',
      },
    });
  }

  private async broadcast(value: BegSnapshot) {
    const payload = this.event(value);
    await Promise.all([...this.sessions].map(async writer => {
      try {
        await writer.write(payload);
      } catch {
        this.sessions.delete(writer);
      }
    }));
  }

  private event(value: BegSnapshot) {
    return this.encoder.encode(`data: ${JSON.stringify(value)}\n\n`);
  }

  private json(value: BegSnapshot) {
    return Response.json(value, { headers: { 'cache-control': 'no-store' } });
  }
}
