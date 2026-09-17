# Codex Resets

A Cloudflare-hosted Codex quota reset dashboard with a tactical terminal UI inspired by **Arknights: Endfield**.

The app reads the public `codex-resets.com` API, normalizes reset telemetry, renders the latest recovery state and reset history, and includes a global live **Request Reset** counter backed by a Cloudflare Durable Object.

> This is an independent community project. It is not affiliated with OpenAI, codex-resets.com, Hypergryph, or Arknights: Endfield, and it cannot reset or modify a Codex account.

## Features

- Astro frontend with React interactive islands
- Endfield-inspired responsive dark/light tactical UI
- Local source-copy/adaptations of ReEnd-style HUD components and effects
- Latest confirmed reset with relative and UTC timestamps
- Scheduled reset / active watch display when provided by the upstream API
- Total reset count, average interval, and longest observed interval
- 53-week GitHub-style reset heatmap with hover/focus details
- Announcement feed with links back to original sources
- Connected particle-network background for the latest recovery panel
- Global **Request Reset** counter with animated count-up display
- Live request updates over a hibernatable Durable Object WebSocket
- Request country code from Cloudflare metadata; visitor IP addresses are not persisted
- Cloudflare D1 archive of normalized reset history

## Stack

- [Astro](https://astro.build/)
- React
- TypeScript 6.x
- [Hono](https://hono.dev/)
- Cloudflare Workers
- Cloudflare Durable Objects
- Cloudflare D1
- Bun

## Architecture

```text
Browser
  │
  ├── Astro / React UI
  │     ├── GET /api/resets
  │     ├── GET /api/beg
  │     ├── POST /api/beg
  │     └── WS  /api/beg/live   (hibernatable)
  │
Cloudflare Worker + Hono
  │
  ├── codex-resets.com API
  │     ├── /api/v1/status
  │     └── /api/v1/resets
  │
  ├── Durable Object: BEG_COUNTER
  │     └── per-reset-cycle global request counter
  │
  └── D1: CODEX_RESETS
        └── archived normalized reset events
```

Reset telemetry is cached at the Cloudflare edge for 60 seconds. The worker reads up to three pages of reset history (100 items per page), sanitizes/normalizes the upstream response, and derives interval statistics when necessary.

The request counter uses the latest reset ID as its `cycle_id`. When a new reset cycle is detected, the Durable Object starts a new count automatically. It keeps the latest 16 request events and broadcasts updates to connected clients through Cloudflare's WebSocket Hibernation API. Idle browser connections can remain open while the Durable Object is evicted from memory, avoiding the continuous billable duration of the previous SSE implementation.

## Local development

This repository uses Bun.

```bash
bun install
bun run dev
```

`bun run dev` starts the Astro development server. It is useful for frontend work, but Cloudflare Worker routes, Durable Objects, and D1 are not provided by the plain Astro dev server.

To build the site and run it through Wrangler with the Worker APIs:

```bash
bun run preview
```

Other useful commands:

```bash
bun run check
bun run build
bun run deploy
```

## API routes

### `GET /api/health`

Basic Worker health response and D1 binding state.

### `GET /api/resets`

Returns the normalized reset snapshot used by the dashboard.

The snapshot contains:

- latest reset
- scheduled reset, when available
- active watch, when available
- total / average / longest interval statistics
- normalized reset history

### `GET /api/beg`

Returns the current global request-counter snapshot.

### `POST /api/beg`

Adds one request to the current reset cycle.

### `WS /api/beg/live`

WebSocket endpoint for live counter updates. The Durable Object accepts the server side with `acceptWebSocket()`, so the connection can hibernate while idle.

Example payload:

```json
{
  "type": "reset-request-count",
  "cycle_id": "2098685367058612394",
  "since": "2026-09-12T08:09:17.000Z",
  "count": 1098,
  "events": [
    {
      "request_id": "6ca3e126-7dc5-4cbb-83b9-197737912b21",
      "country": "VN",
      "at": "2026-09-17T00:00:00.000Z"
    }
  ]
}
```

## Upstream data

The Worker currently consumes:

```text
GET https://codex-resets.com/api/v1/status
GET https://codex-resets.com/api/v1/resets
```

`codex-resets.com` remains the source of truth for reset telemetry. The app validates dates, reset types, source URLs, watch values, and other fields before exposing them to the frontend.

Forecast/watch information comes from the upstream community-maintained data and should not be interpreted as an OpenAI commitment.

## D1 history archive

The current Cloudflare configuration uses the D1 binding:

```text
CODEX_RESETS
```

`GET /api/resets` asynchronously upserts normalized reset events into `reset_events`. D1 is used as an archive; the live dashboard still reads current telemetry from the upstream API.

The schema is defined in:

```text
migrations/0001_reset_history.sql
```

If you fork the project, create your own database:

```bash
bunx wrangler d1 create codex-resets
```

Then replace the D1 `database_id` in `wrangler.jsonc` while keeping the `CODEX_RESETS` binding, and apply the migration:

```bash
bunx wrangler d1 migrations apply codex-resets --remote
```

## Cloudflare deployment

Authenticate once:

```bash
bunx wrangler login
```

Then deploy:

```bash
bun run deploy
```

The Worker serves the generated Astro files through the `ASSETS` binding and exposes the API routes from `worker/index.ts`.

The `BEG_COUNTER` binding points to the `BegCounter` Durable Object. Migration `v1` in `wrangler.jsonc` creates its SQLite-backed Durable Object class.

## Project structure

```text
src/
  components/        React dashboard and UI components
  components/reend/  local ReEnd-style primitives/effects
  pages/             Astro pages
  styles/            Endfield/ReEnd/terminal styling

worker/
  index.ts            Hono routes and asset fallback
  upstream.ts         upstream fetching + normalization
  beg-counter.ts      Durable Object + hibernating WebSocket counter

migrations/
  0001_reset_history.sql

wrangler.jsonc        Cloudflare bindings and deployment config
```

## Credits

- Reset telemetry: [codex-resets.com](https://codex-resets.com/)
- UI direction: inspired by the industrial/tactical visual language of **Arknights: Endfield**
- Some local primitives/effects are adapted from ideas demonstrated by [ReEnd Components](https://reend-components.pages.dev/)

No official Arknights: Endfield assets or logos are required by the application.
