# codex-resets

A Cloudflare-first clone of the public Codex reset tracker experience.

## What is implemented

- Astro static shell + React live dashboard
- Cloudflare Worker + Hono backend-for-frontend
- Verified public upstreams:
  - `GET https://codex-resets.com/api/v1/status`
  - `GET https://codex-resets.com/api/v1/resets`
- 60-second Cloudflare Cache API layer in front of upstream reset data
- Normalized latest reset, scheduled reset, active watch, statistics and reset history
- GitHub-style 53-week reset heatmap
- Durable Object global `beg` counter
- Counter is reset per upstream reset cycle (`cycle_id` = latest reset id)
- SSE live updates with the same `reset-request-count` shape observed on the reference site
- Country code from Cloudflare request metadata (IP addresses are not persisted)
- Optional D1 archival support

## Local development

```bash
npm install
npm run dev
```

`npm run dev` serves only the Astro frontend. To run the Worker, Durable Object and API routes too:

```bash
npm run preview
```

## API routes

- `GET /api/health`
- `GET /api/resets` — normalized/cacheable upstream snapshot
- `GET /api/beg`
- `POST /api/beg`
- `GET /api/beg/live` — SSE

Example SSE payload:

```json
{
  "type": "reset-request-count",
  "cycle_id": "2098685367058612394",
  "since": "2026-09-12T08:09:17.000Z",
  "count": 632272,
  "events": [
    { "request_id": "uuid", "country": "VN", "at": "2026-09-16T00:00:00.000Z" }
  ]
}
```

## Optional D1 history archive

The app does not require D1 to run because the public API remains the source of truth. If you want a local archive:

```bash
npx wrangler d1 create codex-resets
```

Add the returned database binding to `wrangler.jsonc` as `DB`, then apply:

```bash
npx wrangler d1 migrations apply codex-resets --remote
```

When `DB` exists, `/api/resets` upserts the fetched reset records in the background.

## Deploy

```bash
npx wrangler login
npm run deploy
```

The first deploy creates the `BegCounter` Durable Object through migration `v1`.

## Notes

The upstream data is community-maintained and the forecast/watch fields are not OpenAI commitments. This project is independent, cannot reset an account, and is not affiliated with OpenAI.
