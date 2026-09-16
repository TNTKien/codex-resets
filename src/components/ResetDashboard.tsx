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
        if (!cancelled) {
          setData(next);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };

    load();
    const refresh = window.setInterval(load, 60_000);
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      cancelled = true;
      clearInterval(refresh);
      clearInterval(clock);
    };
  }, []);

  if (!data) {
    return <div className="loading-card">{error ? 'Tạm thời chưa tải được dữ liệu reset.' : 'Đang theo dõi tín hiệu reset…'}</div>;
  }

  const latest = data.latestReset;
  const watch = activeWatch(data.activeWatch, now);

  return <>
    {(data.scheduledReset || watch) && <WatchCard scheduled={data.scheduledReset} watch={watch} />}

    <section className="latest-grid">
      <div className="latest-card">
        <div className="latest-label">Lần reset hạn mức Codex gần nhất</div>
        <div className="latest-relative">{latest ? relativeTime(latest.announcedAt, now) : 'chưa rõ'}</div>
        <div className="latest-date">{latest ? formatUtc(latest.announcedAt) : 'Chưa ghi nhận lần reset nào'}</div>
      </div>
      <BegPanel />
    </section>

    <section className="stats-grid" aria-label="Thống kê reset">
      <Stat label="Số lần reset" value={String(data.stats.total)} />
      <Stat label="Khoảng reset trung bình" value={formatDays(data.stats.avgIntervalDays)} />
      <Stat label="Lần chờ lâu nhất" value={formatDays(data.stats.longestIntervalDays)} />
    </section>

    <History resets={data.resets} now={now} />
    <Announcements resets={data.resets} now={now} />
  </>;
}

function WatchCard({ scheduled, watch }: { scheduled: ScheduledReset | null; watch: ActiveWatch | null }) {
  if (scheduled?.scheduledFor) {
    return <section className="watch-card scheduled">
      <div className="watch-mark">⏰</div>
      <div>
        <div className="section-eyebrow">Đã lên lịch reset</div>
        <h2>{formatUtc(scheduled.scheduledFor)}</h2>
        {scheduled.text && <p>{scheduled.text}</p>}
        {scheduled.source && <a className="source-link" href={scheduled.source.url} target="_blank" rel="noreferrer">Xem nguồn trên X →</a>}
      </div>
    </section>;
  }

  if (!watch) return null;
  return <section className="watch-card">
    <div className="watch-mark">👀</div>
    <div className="watch-copy">
      <div className="section-eyebrow">Theo dõi reset · {watch.level}</div>
      <h2>{watch.chancePercent == null ? 'Đã phát hiện tín hiệu reset' : `${Math.round(watch.chancePercent)}% khả năng reset`}</h2>
      <p>{watch.forecastWindow}{watch.text ? ` · ${watch.text}` : ''}</p>
      {watch.source && <a className="source-link" href={watch.source.url} target="_blank" rel="noreferrer">Xem tín hiệu trên X →</a>}
    </div>
  </section>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>;
}

function History({ resets, now }: { resets: ResetEvent[]; now: number }) {
  const weeks = 26;
  const days = useMemo(() => heatmapDays(resets, now, weeks), [resets, now]);
  const months = useMemo(() => monthLabels(days), [days]);

  return <section className="history-section">
    <div className="section-heading history-heading">
      <div>
        <h2>Lịch sử reset Codex</h2>
        <p>26 tuần gần nhất</p>
      </div>
      <div className="legend" aria-label="Chú thích">
        <span><i className="regular" />thường</span>
        <span><i className="banked" />tích lũy</span>
        <span><i />không reset</span>
      </div>
    </div>

    <div className="heatmap-scroll">
      <div className="heatmap-layout">
        <div className="day-labels"><span>T2</span><span>T4</span><span>T6</span></div>
        <div>
          <div className="month-labels" style={{ gridTemplateColumns: `repeat(${weeks}, 18px)` }}>
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

function Announcements({ resets, now }: { resets: ResetEvent[]; now: number }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? resets : resets.slice(0, 3);

  return <section className="announcements">
    <div className="section-heading">
      <div>
        <h2>Thông báo reset Codex</h2>
        <p>Mọi thông báo đều được lưu lại để tra cứu</p>
      </div>
    </div>

    <div className="announcement-list">
      {shown.map(item => <article className="announcement" key={item.id}>
        <img className="announcement-avatar" src="https://codex-resets.com/thsottiaux-avatar.jpg" alt="" loading="lazy" />
        <div className="announcement-body">
          <div className="announcement-meta">
            <span>{relativeTime(item.announcedAt, now)}</span>
            <span>·</span>
            <time>{formatUtc(item.announcedAt)}</time>
          </div>
          <p>{item.text || 'Thông báo reset'}</p>
          {item.source && <a className="source-link" href={item.source.url} target="_blank" rel="noreferrer">Xem trên X →</a>}
        </div>
      </article>)}
    </div>

    {resets.length > 3 && <button className="show-all" onClick={() => setExpanded(value => !value)}>
      {expanded ? 'Thu gọn ↑' : `Xem toàn bộ ${resets.length} lần reset ↓`}
    </button>}
  </section>;
}

function activeWatch(watch: ActiveWatch | null, now: number) {
  return watch && Date.parse(watch.expiresAt) > now ? watch : null;
}

function formatDays(value: number | null) {
  return value == null ? '—' : `${value.toFixed(1)} ngày`;
}

function relativeTime(value: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000));
  if (seconds < 60) return 'vừa xong';
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))} phút trước`;
  if (seconds < 86_400) return `${Math.max(1, Math.floor(seconds / 3600))} giờ trước`;
  const days = Math.floor(seconds / 86_400);
  if (days < 7) return `${days} ngày trước`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} tuần trước`;
  return `${Math.floor(days / 30)} tháng trước`;
}

function formatUtc(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
    timeZoneName: 'short',
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
    const labels = types.map(type => type === 'regular' ? 'reset thường' : 'reset tích lũy');
    return { key, kind, date, title: `${key}: ${labels.length ? labels.join(', ') : 'không reset'}` };
  });
}

function monthLabels(days: HeatDay[]) {
  const labels: { week: number; label: string }[] = [];
  let previous = -1;
  for (let week = 0; week < Math.floor(days.length / 7); week += 1) {
    const date = days[week * 7].date;
    if (date.getUTCMonth() !== previous) {
      previous = date.getUTCMonth();
      labels.push({ week, label: `Thg ${date.getUTCMonth() + 1}` });
    }
  }
  return labels;
}
