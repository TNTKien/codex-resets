import { useEffect, useMemo, useState } from 'react';
import BegPanel from './BegPanel';

type ResetType = 'regular' | 'banked';
type ResetSource = { type: string; author: string | null; url: string };
type ResetEvent = { id: string; resetType: ResetType; announcedAt: string; text: string; source: ResetSource | null };
type ScheduledReset = ResetEvent & { status: string; scheduledFor: string | null };
type ActiveWatch = {
  level: string;
  chancePercent: number | null;
  forecastWindow: string;
  observedAt: string;
  expiresAt: string;
  text: string;
  source: ResetSource | null;
};
type Snapshot = {
  source: string;
  fetchedAt: string;
  latestReset: ResetEvent | null;
  scheduledReset: ScheduledReset | null;
  activeWatch: ActiveWatch | null;
  stats: { total: number; avgIntervalDays: number | null; longestIntervalDays: number | null };
  resets: ResetEvent[];
};

export default function ResetDashboard() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/resets');
        if (!response.ok) throw new Error('unavailable');
        const next = await response.json() as Snapshot;
        if (!cancelled) { setData(next); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      }
    };
    load();
    const refresh = window.setInterval(load, 60_000);
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => { cancelled = true; clearInterval(refresh); clearInterval(clock); };
  }, []);

  if (!data) return <div className="loading-card">{error ? 'Reset data is temporarily unavailable.' : 'Watching for reset signals…'}</div>;

  const latest = data.latestReset;
  return <>
    {(data.scheduledReset || activeWatch(data.activeWatch, now)) && <WatchCard scheduled={data.scheduledReset} watch={activeWatch(data.activeWatch, now)} />}

    <section className="latest-grid">
      <div className="latest-card">
        <div className="section-eyebrow">Latest Codex limit reset</div>
        <div className="latest-relative">{latest ? relativeDays(latest.announcedAt, now) : 'unknown'}</div>
        <div className="latest-date">{latest ? formatUtc(latest.announcedAt) : 'No reset recorded'}</div>
        {latest?.text && <p className="latest-text">{latest.text}</p>}
        {latest?.source && <a className="source-link" href={latest.source.url} target="_blank" rel="noreferrer">View source on X ↗</a>}
      </div>
      <BegPanel />
    </section>

    <section className="stats-grid" aria-label="Reset statistics">
      <Stat label="Resets" value={String(data.stats.total)} />
      <Stat label="Avg. reset interval" value={formatDays(data.stats.avgIntervalDays)} />
      <Stat label="Longest wait" value={formatDays(data.stats.longestIntervalDays)} />
    </section>

    <History resets={data.resets} now={now} />
    <Announcements resets={data.resets} />
  </>;
}

function WatchCard({ scheduled, watch }: { scheduled: ScheduledReset | null; watch: ActiveWatch | null }) {
  if (scheduled?.scheduledFor) return <section className="watch-card scheduled">
    <div className="watch-icon">⏰</div>
    <div>
      <div className="section-eyebrow">Reset scheduled</div>
      <h2>{formatUtc(scheduled.scheduledFor)}</h2>
      {scheduled.text && <p>{scheduled.text}</p>}
      {scheduled.source && <a className="source-link" href={scheduled.source.url} target="_blank" rel="noreferrer">View source ↗</a>}
    </div>
  </section>;

  if (!watch) return null;
  return <section className="watch-card">
    <div className="watch-icon">👀</div>
    <div className="watch-copy">
      <div className="section-eyebrow">Reset watch · {watch.level}</div>
      <h2>{watch.chancePercent == null ? 'Reset signal detected' : `${Math.round(watch.chancePercent)}% reset chance`}</h2>
      <p>{watch.forecastWindow}{watch.text ? ` · ${watch.text}` : ''}</p>
      {watch.source && <a className="source-link" href={watch.source.url} target="_blank" rel="noreferrer">View signal ↗</a>}
    </div>
  </section>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>;
}

function History({ resets, now }: { resets: ResetEvent[]; now: number }) {
  const weeks = 53;
  const days = useMemo(() => heatmapDays(resets, now, weeks), [resets, now]);
  const months = useMemo(() => monthLabels(days), [days]);
  return <section className="history-section">
    <div className="section-heading">
      <div><h2>Codex reset history</h2><p>Last 53 weeks</p></div>
      <div className="legend"><span><i className="regular" />regular</span><span><i className="banked" />banked</span><span><i />no reset</span></div>
    </div>
    <div className="heatmap-scroll">
      <div className="heatmap-layout">
        <div className="day-labels"><span>Mon</span><span>Wed</span><span>Fri</span></div>
        <div>
          <div className="month-labels" style={{ gridTemplateColumns: `repeat(${weeks}, 12px)` }}>
            {months.map(item => <span key={`${item.label}-${item.week}`} style={{ gridColumn: `${item.week + 1} / span 4` }}>{item.label}</span>)}
          </div>
          <div className="heatmap-grid">
            {days.map(day => <span key={day.key} className={`heat-day ${day.kind}`} title={day.title} />)}
          </div>
        </div>
      </div>
    </div>
  </section>;
}

function Announcements({ resets }: { resets: ResetEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? resets : resets.slice(0, 3);
  return <section className="announcements">
    <div className="section-heading"><div><h2>Codex reset announcements</h2><p>Every announcement, preserved for history</p></div></div>
    <div className="announcement-list">
      {shown.map((item, index) => <article className="announcement" key={item.id}>
        <div className="announcement-index">{String(index + 1).padStart(2, '0')}</div>
        <div>
          <div className="announcement-meta"><span className={`type-badge ${item.resetType}`}>{item.resetType}</span><time>{formatUtc(item.announcedAt)}</time></div>
          <p>{item.text || 'Reset announcement'}</p>
          {item.source && <a className="source-link" href={item.source.url} target="_blank" rel="noreferrer">View on X ↗</a>}
        </div>
      </article>)}
    </div>
    {resets.length > 3 && <button className="show-all" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show fewer ↑' : `Show all ${resets.length} resets ↓`}</button>}
  </section>;
}

function activeWatch(watch: ActiveWatch | null, now: number) {
  return watch && Date.parse(watch.expiresAt) > now ? watch : null;
}

function formatDays(value: number | null) {
  return value == null ? '—' : `${value.toFixed(1)}d`;
}

function relativeDays(value: string, now: number) {
  const days = Math.max(0, (now - Date.parse(value)) / 86_400_000);
  if (days < 1 / 24) return 'just now';
  if (days < 1) return `${Math.max(1, Math.floor(days * 24))}h ago`;
  const rounded = Math.floor(days);
  return `${rounded} day${rounded === 1 ? '' : 's'} ago`;
}

function formatUtc(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  }).format(new Date(value));
}

type HeatDay = { key: string; kind: 'regular' | 'banked' | 'empty'; title: string; date: Date };

function heatmapDays(resets: ResetEvent[], now: number, weeks: number): HeatDay[] {
  const today = new Date(now);
  const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const mondayOffset = (utcToday.getUTCDay() + 6) % 7;
  const start = new Date(utcToday);
  start.setUTCDate(start.getUTCDate() - mondayOffset - (weeks - 1) * 7);

  const byDay = new Map<string, ResetType[]>();
  for (const item of resets) {
    const key = item.announcedAt.slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), item.resetType]);
  }

  return Array.from({ length: weeks * 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const types = byDay.get(key) ?? [];
    const kind: HeatDay['kind'] = types.includes('regular') ? 'regular' : types.includes('banked') ? 'banked' : 'empty';
    return { key, kind, date, title: `${key}: ${types.length ? types.join(', ') : 'no reset'}` };
  });
}

function monthLabels(days: HeatDay[]) {
  const labels: { week: number; label: string }[] = [];
  let previous = -1;
  for (let week = 0; week < Math.floor(days.length / 7); week += 1) {
    const date = days[week * 7].date;
    if (date.getUTCMonth() !== previous) {
      previous = date.getUTCMonth();
      labels.push({ week, label: date.toLocaleString('en', { month: 'short', timeZone: 'UTC' }) });
    }
  }
  return labels;
}
