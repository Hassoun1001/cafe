import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

export function Card({
  title,
  action,
  children,
  className,
  padded = true,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={clsx(
        'mb-4 rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]',
        padded && 'p-5 sm:p-6',
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-white shadow-sm hover:bg-accent-dark focus-visible:ring-accent/30',
  secondary: 'bg-surface border border-border text-ink hover:bg-bg focus-visible:ring-accent/20',
  ghost: 'bg-transparent text-muted hover:bg-bg hover:text-ink focus-visible:ring-accent/20',
  danger: 'bg-danger-light text-danger hover:bg-red-100 focus-visible:ring-danger/20',
  dark: 'bg-ink text-white shadow-sm hover:bg-slate-800 focus-visible:ring-ink/20',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...rest }: ButtonProps) {
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs gap-1',
    md: 'px-4 py-2.5 text-sm gap-1.5',
    lg: 'px-5 py-3 text-[15px] gap-2',
  }[size];

  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50',
        sizeClasses,
        VARIANT_CLASSES[variant],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-all placeholder:text-muted-2',
        'focus:border-accent focus:ring-4 focus:ring-accent/15',
        'disabled:bg-bg disabled:text-muted-2',
        props.className,
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-all',
        'focus:border-accent focus:ring-4 focus:ring-accent/15',
        props.className,
      )}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-xs font-medium text-muted">{children}</label>;
}

export function Pill({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors',
        active ? 'border-accent bg-accent text-white' : 'border-border bg-transparent text-muted hover:border-border-strong hover:bg-bg',
      )}
    >
      {children}
    </button>
  );
}

type BadgeTone = 'green' | 'red' | 'amber' | 'gray' | 'blue';
const BADGE_CLASSES: Record<BadgeTone, string> = {
  green: 'bg-success-light text-success',
  red: 'bg-danger-light text-danger',
  amber: 'bg-warning-light text-warning',
  gray: 'bg-slate-100 text-muted',
  blue: 'bg-info-light text-info',
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', BADGE_CLASSES[tone])}>
      {children}
    </span>
  );
}

export function StatCard({ label, value, tone, icon }: { label: string; value: ReactNode; tone?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13px] font-medium text-muted">{label}</div>
        {icon && <div className="text-muted-2">{icon}</div>}
      </div>
      <div className="text-2xl font-bold tracking-tight" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</div>;
}

export function EmptyState({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted">
      {icon && <div className="mb-1 text-muted-2">{icon}</div>}
      {children}
    </div>
  );
}

export function Alert({ tone, children }: { tone: 'warn' | 'success' | 'info'; children: ReactNode }) {
  const classes = {
    warn: 'bg-warning-light text-warning',
    success: 'bg-success-light text-success',
    info: 'bg-info-light text-info',
  }[tone];
  return <div className={clsx('mb-3 flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] font-medium', classes)}>{children}</div>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  maxWidth,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  /** Explicit CSS width (e.g. "800px"), overrides `wide` when set — for content like a full menu grid that needs more room than the standard modal sizes. */
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className={clsx(
          'max-h-[90vh] overflow-y-auto rounded-2xl bg-surface p-6 shadow-[var(--shadow-elevated)]',
          !maxWidth && (wide ? 'w-[540px]' : 'w-[420px]'),
        )}
        style={maxWidth ? { width: maxWidth, maxWidth: '92vw' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 text-base font-semibold text-ink">{title}</div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  requireText,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  requireText?: string;
}) {
  const [typed, setTyped] = useState('');
  const locked = !!requireText && typed !== requireText;

  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="mb-5 text-sm leading-relaxed text-muted">{message}</div>
      {requireText && (
        <div className="mb-4">
          <Label>Type "{requireText}" to confirm</Label>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
      )}
      <div className="flex gap-2">
        <Button variant={danger ? 'danger' : 'primary'} className="flex-1" onClick={onConfirm} disabled={locked}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <Loader2 className="size-6 animate-spin text-accent" />
    </div>
  );
}
