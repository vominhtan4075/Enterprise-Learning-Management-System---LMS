'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

// =============================================================================
// BUTTON
// =============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-9.5 px-4 text-sm gap-2',
    lg: 'h-11 px-5 text-sm gap-2',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-[var(--accent)] text-white border border-transparent hover:bg-[var(--accent-hover)]',
    secondary:
      'bg-white text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-subtle)]',
    ghost:
      'bg-transparent text-[var(--text-secondary)] border border-transparent hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]',
    danger:
      'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" strokeWidth={1.75} />
      ) : (
        leftIcon
      )}
      {children}
    </button>
  );
}

// =============================================================================
// PAGE HEADER (28-32px title + short subtitle + max 1 primary CTA)
// =============================================================================

export function PageHeader({
  title,
  description,
  badge,
  action,
  secondaryAction,
}: {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <div className="mb-1 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl sm:text-2xl leading-snug font-semibold tracking-tight text-[var(--text-primary)]">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="mt-0.5 text-xs sm:text-sm text-[var(--text-secondary)] max-w-3xl">
            {description}
          </p>
        )}
      </div>
      {(secondaryAction || action) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {secondaryAction}
          {action}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// CARD & STAT CARD (Flat, 1px border, minimal/no shadow)
// =============================================================================

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName = '',
  tinted = false,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  tinted?: boolean;
}) {
  return (
    <section
      className={`rounded-lg border border-[var(--border-default)] ${
        tinted ? 'bg-[var(--bg-subtle)]' : 'bg-[var(--bg-surface)]'
      } ${className}`}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] px-5 py-4">
          <div>
            {title && (
              <h2 className="text-[17px] font-semibold text-[var(--text-primary)] leading-snug">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={bodyClassName || 'p-5'}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
}) {
  const iconTone: Record<string, string> = {
    default: 'bg-[var(--bg-subtle)] text-[var(--accent)] border-[var(--border-default)]',
    accent: 'bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent-border)]',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)] tabular-nums">
            {value}
          </p>
        </div>
        {icon && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${iconTone[tone]}`}
          >
            {icon}
          </div>
        )}
      </div>
      {hint && (
        <div className="mt-2.5 text-xs text-[var(--text-secondary)]">{hint}</div>
      )}
    </div>
  );
}

// =============================================================================
// FORM INPUTS
// =============================================================================

export function Input({
  label,
  error,
  hint,
  className = '',
  id,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
}) {
  const inputId = id || rest.name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`h-9.5 w-full rounded-md border bg-white px-3 text-sm text-[var(--text-primary)] placeholder:text-slate-400 focus:border-[var(--accent)] focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 ${
          error ? 'border-rose-400' : 'border-[var(--border-default)]'
        } ${className}`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
      {!error && hint && (
        <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>
      )}
    </div>
  );
}

export function Select({
  label,
  error,
  options,
  className = '',
  id,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options?: Array<{ value: string; label: string }>;
}) {
  const selectId = id || rest.name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`h-9.5 w-full rounded-md border bg-white px-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none disabled:bg-slate-100 ${
          error ? 'border-rose-400' : 'border-[var(--border-default)]'
        } ${className}`}
        {...rest}
      >
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
    </div>
  );
}

export function Textarea({
  label,
  error,
  hint,
  className = '',
  id,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  hint?: string;
}) {
  const areaId = id || rest.name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={areaId}
          className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
        >
          {label}
        </label>
      )}
      <textarea
        id={areaId}
        className={`w-full rounded-md border bg-white p-3 text-sm text-[var(--text-primary)] placeholder:text-slate-400 focus:border-[var(--accent)] focus:outline-none ${
          error ? 'border-rose-400' : 'border-[var(--border-default)]'
        } ${className}`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
      {!error && hint && (
        <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>
      )}
    </div>
  );
}

// =============================================================================
// BADGE, PROGRESS BAR, TABS, SKELETON, EMPTY STATE
// =============================================================================

export type BadgeTone =
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'accent';

export function Badge({
  children,
  tone = 'neutral',
  icon,
  className = '',
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  icon?: React.ReactNode;
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    info: 'bg-sky-50 text-sky-800 border-sky-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    accent:
      'bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent-border)]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium leading-snug ${tones[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = 'accent',
  showLabel = false,
  size = 'md',
}: {
  value: number;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
  size?: 'sm' | 'md';
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value * 10) / 10));
  const fillColors: Record<string, string> = {
    accent: 'bg-[var(--accent)]',
    success: 'bg-emerald-600',
    warning: 'bg-amber-500',
    danger: 'bg-rose-600',
  };

  return (
    <div className="flex items-center gap-2.5 w-full">
      <div
        className={`w-full overflow-hidden rounded-full bg-slate-200/75 ${
          size === 'sm' ? 'h-1.5' : 'h-2'
        }`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${fillColors[tone]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="w-11 shrink-0 text-right text-xs font-medium text-[var(--text-secondary)] tabular-nums">
          {clamped}%
        </span>
      )}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ key: T; label: string; count?: number }>;
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-[var(--border-default)]">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
              isActive
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Skeleton({ className = 'h-5 w-full' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200/70 ${className}`}
      aria-hidden="true"
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-default)] bg-white px-6 py-12 text-center">
      {icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--accent)]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-[var(--text-secondary)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
