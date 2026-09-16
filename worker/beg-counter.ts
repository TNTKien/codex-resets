export type BegSnapshot = { count: number; events: { id: string; country: string; at: string }[] };

type Env = { BEG_COUNTER: DurableObjectNamespace };

export class BegCounter extends DurableObject<Env> {
  private sessions = new Set<WritableStreamDefaultWriter<Uint8Array>>();
  private encoder = new TextEncoder();

  async snapshot(): Promise<BegSnapshot> {
    return (await this.ctx.storage.get<BegSnapshot>('snapshot')) ?? { count: 0, events: [] };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname.endsWith('/live')) return this.live();
    if (request.method === 'POST') {
      const country = request.headers.get('x-country') || '??';
      const current = await this.snapshot();
      const next: BegSnapshot = {
        count: current.count + 1,
        events: [{ id: crypto.randomUUID(), country, at: new Date().toISOString() }, ...current.events].slice(0, 12),
      };
      await this.ctx.storage.put('snapshot', next);
      await this.broadcast(next);
      return Response.json(next);
    }
    return Response.json(await this.snapshot());
  }

  private live() {
    const stream = new TransformStream<Uint8Array, Uint8Array>();
    const writer = stream.writable.getWriter();
    this.sessions.add(writer);
    this.snapshot().then(value => writer.write(this.encoder.encode(`data: ${JSON.stringify(value)}\n\n`))).catch(() => {});
    const headers = new Headers({ 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'connection': 'keep-alive' });
    return new Response(stream.readable, { headers });
  }

  private async broadcast(value: BegSnapshot) {
    const payload = this.encoder.encode(`data: ${JSON.stringify(value)}\n\n`);
    for (const writer of [...this.sessions]) {
      try { await writer.write(payload); } catch { this.sessions.delete(writer); }
    }
  }
}
