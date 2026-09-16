import { useEffect, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

type Status = 'online' | 'warning' | 'offline' | 'scanning';
type BadgeVariant = 'neutral' | 'online' | 'warning' | 'danger' | 'info';
export type DataStreamMessageType = 'system' | 'data' | 'warning' | 'classified';
export type DataStreamMessage = {
  id: string;
  text: string;
  type?: DataStreamMessageType;
};

type TacticalPanelProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  status?: Status;
  headerAction?: ReactNode;
};

const STATUS_LABELS: Record<Status, string> = {
  online: 'ONLINE',
  warning: 'CAUTION',
  offline: 'OFFLINE',
  scanning: 'SCANNING',
};

export function TacticalPanel({
  title,
  status = 'online',
  headerAction,
  children,
  className = '',
  ...props
}: TacticalPanelProps) {
  return <section className={`re-tactical-panel ${className}`.trim()} {...props}>
    <header className="re-tactical-panel__header">
      <div className="re-tactical-panel__title">
        <span className="re-crosshair" aria-hidden="true">⌖</span>
        <span>{title}</span>
      </div>
      <div className="re-tactical-panel__status">
        <span className={`re-status-dot re-status-dot--${status}`} aria-hidden="true" />
        <span>{STATUS_LABELS[status]}</span>
        {headerAction}
      </div>
    </header>
    <span className="re-corner re-corner--tl" aria-hidden="true" />
    <span className="re-corner re-corner--tr" aria-hidden="true" />
    <span className="re-corner re-corner--bl" aria-hidden="true" />
    <span className="re-corner re-corner--br" aria-hidden="true" />
    <div className="re-tactical-panel__body">{children}</div>
  </section>;
}

export function TacticalBadge({
  children,
  variant = 'neutral',
  className = '',
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return <span className={`re-tactical-badge re-tactical-badge--${variant} ${className}`.trim()}>{children}</span>;
}

export function HoloCard({
  title,
  subtitle,
  value,
  glyph = '◆',
  className = '',
}: {
  title: string;
  subtitle: string;
  value?: string;
  glyph?: string;
  className?: string;
}) {
  return <article className={`re-holo-card ${className}`.trim()}>
    <div className="re-holo-card__scan" aria-hidden="true" />
    <span className="re-holo-card__glyph" aria-hidden="true">{glyph}</span>
    {value && <strong className="re-holo-card__value">{value}</strong>}
    <h3>{title}</h3>
    <p>{subtitle}</p>
    <span className="re-holo-card__diamond" aria-hidden="true">◆</span>
  </article>;
}

export function EndfieldButton({
  children,
  loading = false,
  className = '',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return <button
    type="button"
    className={`re-button ${className}`.trim()}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...props}
  >
    {loading && <span className="re-button__loader" aria-hidden="true" />}
    {children}
  </button>;
}

export function DiamondLoader({ label = 'SCANNING' }: { label?: string }) {
  return <div className="re-loader" role="status" aria-live="polite">
    <span className="re-loader__diamond" aria-hidden="true" />
    <span>{label}</span>
  </div>;
}

export function ScanDivider({ label }: { label?: string }) {
  return <div className="re-scan-divider" aria-hidden="true">
    <span />
    {label && <em>{label}</em>}
    <span />
  </div>;
}

/**
 * Source-copy adaptation of ReEnd's particle-network effect.
 * This version uses a deliberately asymmetric free-form topology instead of
 * distance-based auto-connections so the network silhouette reads as a shape.
 */
export function ParticleField({ className = '' }: { className?: string }) {
  const particles = useMemo(
    () => [
      { x: 6, y: 20, opacity: 0.56, delay: 0, duration: 3.2 },
      { x: 18, y: 31, opacity: 0.42, delay: 180, duration: 3.7 },
      { x: 31, y: 17, opacity: 0.52, delay: 360, duration: 3.1 },
      { x: 45, y: 37, opacity: 0.48, delay: 540, duration: 4.0 },
      { x: 59, y: 24, opacity: 0.58, delay: 720, duration: 3.4 },
      { x: 75, y: 33, opacity: 0.46, delay: 900, duration: 3.8 },
      { x: 92, y: 19, opacity: 0.62, delay: 1080, duration: 3.3 },
      { x: 87, y: 57, opacity: 0.44, delay: 1260, duration: 4.1 },
      { x: 71, y: 69, opacity: 0.54, delay: 1440, duration: 3.6 },
      { x: 55, y: 52, opacity: 0.40, delay: 1620, duration: 3.2 },
      { x: 42, y: 76, opacity: 0.56, delay: 1800, duration: 3.9 },
      { x: 25, y: 63, opacity: 0.46, delay: 1980, duration: 3.5 },
      { x: 9, y: 80, opacity: 0.60, delay: 2160, duration: 3.7 },
      { x: 34, y: 90, opacity: 0.42, delay: 2340, duration: 4.0 },
      { x: 64, y: 87, opacity: 0.50, delay: 2520, duration: 3.3 },
    ],
    [],
  );

  const width = 320;
  const height = 128;
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
    [6, 7], [7, 8], [8, 14], [14, 13], [13, 12], [12, 11], [11, 0],
    [1, 3], [2, 4], [3, 5], [3, 9], [4, 9], [5, 9], [5, 7],
    [7, 9], [8, 9], [8, 14], [9, 10], [10, 11], [10, 13], [10, 14],
    [11, 13], [1, 11], [3, 11], [4, 8], [9, 14],
  ] as const;

  const lines = edges.map(([a, b]) => ({
    key: `${a}-${b}`,
    x1: (particles[a].x / 100) * width,
    y1: (particles[a].y / 100) * height,
    x2: (particles[b].x / 100) * width,
    y2: (particles[b].y / 100) * height,
  }));

  return <div className={`re-particle-field ${className}`.trim()} aria-hidden="true">
    <svg
      className="re-particle-field__lines"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {lines.map(line => <line
        key={line.key}
        className="re-particle-field__line"
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
      />)}
    </svg>

    {particles.map((particle, i) => <span
      key={i}
      className="re-particle-field__particle"
      style={{
        left: `${particle.x}%`,
        top: `${particle.y}%`,
        opacity: particle.opacity,
        animationDuration: `${particle.duration}s`,
        animationDelay: `${particle.delay}ms`,
      }}
    />)}
  </div>;
}

/**
 * Dependency-light adaptation of ReEnd's interactive Counter.
 * It counts from the currently displayed value to the next value so live
 * request updates do not restart from zero every time.
 */
export function CountUp({
  value,
  duration = 900,
  locale = 'en-US',
  className = '',
}: {
  value: number;
  duration?: number;
  locale?: string;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const displayedRef = useRef(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = hasAnimated.current ? displayedRef.current : 0;
    hasAnimated.current = true;

    if (reduceMotion || from === value) {
      displayedRef.current = value;
      setDisplayValue(value);
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const delta = value - from;

    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + delta * eased);
      displayedRef.current = next;
      setDisplayValue(next);

      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [duration, value]);

  const formatter = new Intl.NumberFormat(locale);

  return <span className={`re-count-up ${className}`.trim()} aria-label={formatter.format(value)}>
    <span aria-hidden="true">{formatter.format(displayValue)}</span>
  </span>;
}

/**
 * Source-copy adaptation of ReEnd's DataStream signature component.
 * Unlike the showcase component, this version renders real application events
 * instead of replaying demo messages on a timer.
 */
export function DataStream({
  messages,
  className = '',
  active = true,
  label = 'LIVE FEED',
}: {
  messages: DataStreamMessage[];
  className?: string;
  active?: boolean;
  label?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages]);

  return <div className={`re-data-stream ${className}`.trim()}>
    <div className="re-data-stream__header">
      <span className="re-data-stream__terminal" aria-hidden="true">▣</span>
      <span>{label}</span>
      <div className="re-data-stream__state">
        <span className={`re-data-stream__state-dot${active ? ' is-active' : ''}`} aria-hidden="true" />
        <span>{active ? 'ACTIVE' : 'STANDBY'}</span>
      </div>
    </div>

    <div
      ref={containerRef}
      className="re-data-stream__body"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.slice(-12).map(message => <div
        key={message.id}
        className={`re-data-stream__line re-data-stream__line--${message.type ?? 'system'}`}
      >
        {message.text}
      </div>)}
      <span className="re-data-stream__cursor" aria-hidden="true" />
    </div>
  </div>;
}
