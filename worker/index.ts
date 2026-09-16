import { Hono } from 'hono';
import { BegCounter } from './beg-counter';

export { BegCounter };

type Env = {
  ASSETS: Fetcher;
  BEG_COUNTER: DurableObjectNamespace<BegCounter>;
};

const app = new Hono<{ Bindings: Env }>();

function counter(env: Env) {
  const id = env.BEG_COUNTER.idFromName('global');
  return env.BEG_COUNTER.get(id);
}

app.get('/api/health', c => c.json({ ok: true }));
app.get('/api/beg', c => counter(c.env).fetch(new Request('https://do/beg')));
app.post('/api/beg', c => {
  const country = (c.req.raw as Request & { cf?: { country?: string } }).cf?.country ?? '??';
  return counter(c.env).fetch(new Request('https://do/beg', { method: 'POST', headers: { 'x-country': country } }));
});
app.get('/api/beg/live', c => counter(c.env).fetch(new Request('https://do/live')));
app.all('*', c => c.env.ASSETS.fetch(c.req.raw));

export default app;
