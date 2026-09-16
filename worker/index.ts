import { Hono } from 'hono';
import { BegCounter } from './beg-counter';
import { fetchResetSnapshot, type ResetSnapshot } from './upstream';

export { BegCounter };

type Env = {
  ASSETS: Fetcher;
  BEG_COUNTER: DurableObjectNamespace<BegCounter>;
  DB?: D1Database;
};

const app = new Hono<{ Bindings: Env }>();
const EDGE_CACHE_SECONDS = 60;

function counter(env: Env) {
  return env.BEG_COUNTER.get(env.BEG_COUNTER.idFromName('global'));
}

function snapshotCacheKey(request: Request) {
  const url = new URL('/__edge-cache/reset-snapshot', request.url);
  return new Request(url.toString(), { method: 'GET' });
}

async function resetSnapshot(request: Request, ctx: ExecutionContext): Promise<ResetSnapshot> {
  const cache = caches.default;
  const key = snapshotCacheKey(request);
  const cached = await cache.match(key);
  if (cached) return await cached.json() as ResetSnapshot;

  const snapshot = await fetchResetSnapshot();
  const response = Response.json(snapshot, {
    headers: { 'cache-control': `public, max-age=${EDGE_CACHE_SECONDS}` },
  });
  ctx.waitUntil(cache.put(key, response));
  return snapshot;
}

async function currentCycle(request: Request, ctx: ExecutionContext) {
  try {
    const snapshot = await resetSnapshot(request, ctx);
    const latest = snapshot.latestReset;
    return latest ? { id: latest.id, since: latest.announcedAt } : null;
  } catch {
    return null;
  }
}

function durableRequest(path: string, method: string, cycle: { id: string; since: string } | null, country?: string) {
  const headers = new Headers();
  if (cycle) {
    headers.set('x-cycle-id', cycle.id);
    headers.set('x-cycle-since', cycle.since);
  }
  if (country) headers.set('x-country', country);
  return new Request(`https://beg-counter${path}`, { method, headers });
}

async function archiveResets(db: D1Database, snapshot: ResetSnapshot) {
  if (!snapshot.resets.length) return;
  const sql = `INSERT INTO reset_events
    (id, announced_at, reset_type, text, source_type, source_author, source_url, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      announced_at=excluded.announced_at,
      reset_type=excluded.reset_type,
      text=excluded.text,
      source_type=excluded.source_type,
      source_author=excluded.source_author,
      source_url=excluded.source_url,
      synced_at=CURRENT_TIMESTAMP`;
  await db.batch(snapshot.resets.map(item => db.prepare(sql).bind(
    item.id,
    item.announcedAt,
    item.resetType,
    item.text,
    item.source?.type ?? null,
    item.source?.author ?? null,
    item.source?.url ?? null,
  )));
}

app.get('/api/health', c => c.json({ ok: true, service: 'codex-resets' }));

app.get('/api/resets', async c => {
  try {
    const snapshot = await resetSnapshot(c.req.raw, c.executionCtx);
    if (c.env.DB) c.executionCtx.waitUntil(archiveResets(c.env.DB, snapshot));
    return Response.json(snapshot, {
      headers: {
        'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'reset data unavailable' }, 502);
  }
});

app.get('/api/beg', async c => {
  const cycle = await currentCycle(c.req.raw, c.executionCtx);
  return counter(c.env).fetch(durableRequest('/beg', 'GET', cycle));
});

app.post('/api/beg', async c => {
  const cycle = await currentCycle(c.req.raw, c.executionCtx);
  const country = (c.req.raw as Request & { cf?: { country?: string } }).cf?.country ?? '??';
  return counter(c.env).fetch(durableRequest('/beg', 'POST', cycle, country));
});

app.get('/api/beg/live', async c => {
  const cycle = await currentCycle(c.req.raw, c.executionCtx);
  return counter(c.env).fetch(durableRequest('/live', 'GET', cycle));
});

app.all('*', c => c.env.ASSETS.fetch(c.req.raw));

export default app;
