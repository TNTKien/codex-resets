import { useEffect, useRef } from 'react';
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
