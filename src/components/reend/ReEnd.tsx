import { useEffect, useRef, useState } from 'react';
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
 * Dependency-light source-copy adaptation of ReEnd's Particles effect.
 * ReEnd uses 20 four-pixel diamonds that drift 30px vertically with staggered
 * 3-5 second loops. CSS handles the motion here so this app does not need
 * Framer Motion just for an ambient background.
 */
export function ParticleField({ className = '', count = 20 }: { className?: string; count?: number }) {
  return <div className={`re-particle-field ${className}`.trim()} aria-hidden="true">
    {Array.from({ length: count }, (_, i) => <span
      key={i}
      className="re-particle-field__particle"
      style={{
        left: `${5 + ((i * 17) % 90)}%`,
        top: `${5 + ((i * 23) % 90)}%`,
        animationDuration: `${3 + (i % 3)}s`,
        animationDelay: `${i * 0.3}s`,
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
