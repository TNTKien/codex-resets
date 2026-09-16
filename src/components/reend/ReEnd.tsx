import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

type Status = 'online' | 'warning' | 'offline' | 'scanning';
type BadgeVariant = 'neutral' | 'online' | 'warning' | 'danger' | 'info';

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
