# codex-resets

A Cloudflare-first community reset tracker inspired by the visual structure of codex-resets.com.

## Stack

- Astro static frontend
- React islands for countdown + live prayer panel
- Cloudflare Worker + Hono as BFF
- Durable Object for the global `beg` counter and SSE fan-out
- D1 migration prepared for reset history (binding intentionally deferred until the database is created)

## Local development

```bash
npm install
npm run dev
```

`npm run dev` runs the static Astro UI. For the complete Worker/API runtime:

```bash
npm run preview
```

Then open the URL printed by Wrangler.

## Deploy

```bash
npx wrangler login
npm run deploy
```

Wrangler creates the Durable Object class during the first deployment via migration `v1`.

## API

- `GET /api/health`
- `GET /api/beg`
- `POST /api/beg`
- `GET /api/beg/live` — SSE

## Next data-layer step

The UI currently contains a safe static reset-history seed so the deployment does not depend on an undocumented upstream endpoint. The next step is to connect a verified public reset-history source through the Worker, cache it, normalize it, and write archival records to D1.

## Notes

This is an independent community project. It does not reset Codex accounts and is not an official OpenAI service.
