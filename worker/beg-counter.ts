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

const SSE_WRITE_TIMEOUT_MS = 1_500;

export class BegCounter {
  private sessions = new Set<WritableStreamDefaultWriter<Uint8Array>>();
  private encoder = new TextEncoder();

  constructor(private state: DurableObjectState) {}

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

      await this.state.storage.put('snapshot', next);

      // Never make the POST wait for SSE clients. A slow/disconnected stream can
      // apply backpressure to writer.write(), which previously left the UI button
      // disabled even though the counter had already been persisted.
      this.state.waitUntil(this.broadcast(next));

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
      this.state.waitUntil(this.broadcast(next));
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

    // Initial snapshot should not hold the SSE response open indefinitely if the
    // connection is already gone before the browser starts consuming it.
    this.state.waitUntil(this.writeToSession(writer, this.event(snapshot)));

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
    if (this.sessions.size === 0) return;
    const payload = this.event(value);
    await Promise.allSettled(
      [...this.sessions].map(writer => this.writeToSession(writer, payload)),
    );
  }

  private async writeToSession(
    writer: WritableStreamDefaultWriter<Uint8Array>,
    payload: Uint8Array,
  ) {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        writer.write(payload),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('SSE write timed out')),
            SSE_WRITE_TIMEOUT_MS,
          );
        }),
      ]);
    } catch {
      this.sessions.delete(writer);
      writer.abort().catch(() => {});
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private event(value: BegSnapshot) {
    return this.encoder.encode(`data: ${JSON.stringify(value)}\n\n`);
  }

  private json(value: BegSnapshot) {
    return Response.json(value, { headers: { 'cache-control': 'no-store' } });
  }
}
