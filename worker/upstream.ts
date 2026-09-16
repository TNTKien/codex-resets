const BASE_URL = 'https://codex-resets.com/api/v1';
const FETCH_TIMEOUT_MS = 6_000;
const MAX_HISTORY_PAGES = 3;

export type ResetType = 'regular' | 'banked';

export type ResetSource = {
  type: string;
  author: string | null;
  url: string;
};

export type ResetEvent = {
  id: string;
  resetType: ResetType;
  announcedAt: string;
  text: string;
  source: ResetSource | null;
};

export type ScheduledReset = ResetEvent & {
  status: string;
  scheduledFor: string | null;
};

export type ActiveWatch = {
  level: string;
  chancePercent: number | null;
  forecastWindow: string;
  observedAt: string;
  expiresAt: string;
  text: string;
  source: ResetSource | null;
};

export type ResetSnapshot = {
  source: 'codex-resets.com';
  fetchedAt: string;
  generatedAt: string | null;
  latestReset: ResetEvent | null;
  scheduledReset: ScheduledReset | null;
  activeWatch: ActiveWatch | null;
  stats: {
    total: number;
    avgIntervalDays: number | null;
    longestIntervalDays: number | null;
  };
  resets: ResetEvent[];
};

type UpstreamStatus = {
  data?: {
    latest_reset?: unknown;
    scheduled_reset?: unknown;
    active_watch?: unknown;
    stats?: unknown;
  };
  meta?: { generated_at?: unknown };
};

type UpstreamResetList = {
  data?: unknown;
  pagination?: {
    has_more?: unknown;
    next_cursor?: unknown;
  };
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function iso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function externalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeSource(value: unknown): ResetSource | null {
  const source = record(value);
  if (!source) return null;
  const url = externalUrl(source.url);
  if (!url) return null;
  return {
    type: text(source.type) ?? 'unknown',
    author: text(source.author),
    url,
  };
}

function normalizeReset(value: unknown): ResetEvent | null {
  const item = record(value);
  if (!item) return null;
  const id = text(item.id);
  const resetType = item.reset_type;
  const announcedAt = iso(item.announced_at);
  if (!id || (resetType !== 'regular' && resetType !== 'banked') || !announcedAt) return null;
  return {
    id,
    resetType,
    announcedAt,
    text: text(item.text) ?? '',
    source: normalizeSource(item.source),
  };
}

function normalizeScheduled(value: unknown): ScheduledReset | null {
  const item = record(value);
  const base = normalizeReset(value);
  if (!item || !base) return null;
  return {
    ...base,
    status: text(item.status) ?? 'scheduled',
    scheduledFor: item.scheduled_for == null ? null : iso(item.scheduled_for),
  };
}

function normalizeWatch(value: unknown): ActiveWatch | null {
  const item = record(value);
  if (!item) return null;
  const observedAt = iso(item.observed_at);
  const expiresAt = iso(item.expires_at);
  if (!observedAt || !expiresAt) return null;
  const chance = number(item.reset_chance_percent);
  return {
    level: text(item.level) ?? 'unknown',
    chancePercent: chance == null ? null : Math.max(0, Math.min(100, chance)),
    forecastWindow: text(item.forecast_window) ?? '',
    observedAt,
    expiresAt,
    text: text(item.text) ?? '',
    source: normalizeSource(item.source),
  };
}

async function getJson<T>(url: URL): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      const retry = response.headers.get('retry-after');
      throw new Error(`codex-resets.com returned HTTP ${response.status}${retry ? ` (retry after ${retry}s)` : ''}`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

function gapStats(resets: ResetEvent[]) {
  if (resets.length < 2) return { average: null, longest: null };
  const ordered = [...resets]
    .map(item => Date.parse(item.announcedAt))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (ordered.length < 2) return { average: null, longest: null };
  const gaps = ordered.slice(1).map((time, index) => (time - ordered[index]) / 86_400_000);
  return {
    average: gaps.reduce((sum, value) => sum + value, 0) / gaps.length,
    longest: Math.max(...gaps),
  };
}

export async function fetchResetSnapshot(): Promise<ResetSnapshot> {
  const statusUrl = new URL(`${BASE_URL}/status`);
  const status = await getJson<UpstreamStatus>(statusUrl);
  const statusData = record(status.data) ?? {};

  const resets: ResetEvent[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_HISTORY_PAGES; page += 1) {
    const url = new URL(`${BASE_URL}/resets`);
    url.searchParams.set('limit', '100');
    url.searchParams.set('order', 'desc');
    if (cursor) url.searchParams.set('cursor', cursor);

    const payload = await getJson<UpstreamResetList>(url);
    if (!Array.isArray(payload.data)) throw new Error('codex-resets.com returned an invalid reset list');
    for (const raw of payload.data) {
      const item = normalizeReset(raw);
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        resets.push(item);
      }
    }

    if (payload.pagination?.has_more !== true) break;
    const nextCursor = text(payload.pagination.next_cursor);
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }

  resets.sort((a, b) => Date.parse(b.announcedAt) - Date.parse(a.announcedAt));
  const calculated = gapStats(resets);
  const rawStats = record(statusData.stats) ?? {};
  const upstreamAverage = number(rawStats.avg_interval_days);
  const upstreamTotal = number(rawStats.total);
  const generatedAt = iso(record(status.meta)?.generated_at);

  return {
    source: 'codex-resets.com',
    fetchedAt: new Date().toISOString(),
    generatedAt,
    latestReset: normalizeReset(statusData.latest_reset) ?? resets[0] ?? null,
    scheduledReset: normalizeScheduled(statusData.scheduled_reset),
    activeWatch: normalizeWatch(statusData.active_watch),
    stats: {
      total: upstreamTotal == null ? resets.length : Math.max(0, Math.round(upstreamTotal)),
      avgIntervalDays: upstreamAverage ?? calculated.average,
      longestIntervalDays: calculated.longest,
    },
    resets,
  };
}
