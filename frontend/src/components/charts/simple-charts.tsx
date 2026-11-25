'use client';

import React from 'react';

export function HorizontalBarList({
  items,
  emptyText = 'Chưa có dữ liệu thống kê.',
}: {
  items: Array<{
    id: string;
    label: string;
    subLabel?: string;
    value: number;
    rightText?: string;
  }>;
  emptyText?: string;
}) {
  if (!items || items.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--text-muted)]">{emptyText}</p>;
  }

  return (
    <div className="space-y-3.5">
      {items.map((item) => {
        const pct = Math.min(100, Math.max(0, Math.round(item.value * 10) / 10));
        return (
          <div key={item.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <div className="min-w-0 truncate">
                <span className="font-medium text-[var(--text-primary)]">
                  {item.label}
                </span>
                {item.subLabel && (
                  <span className="ml-2 text-xs text-[var(--text-muted)]">
                    {item.subLabel}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
                {item.rightText ?? `${pct}%`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/75">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ScoreDistributionBars({
  buckets,
}: {
  buckets?: Array<{ label: string; range?: string; count: number }>;
}) {
  if (!buckets || buckets.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--text-muted)]">
        Chưa có lượt làm bài kiểm tra trong giai đoạn này.
      </p>
    );
  }

  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5 pt-2">
      {buckets.map((bucket) => {
        const heightPct = Math.max(6, Math.round((bucket.count / maxCount) * 100));
        return (
          <div
            key={bucket.label}
            className="flex flex-col items-center rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)]/55 p-3"
          >
            <span className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">
              {bucket.count} lượt
            </span>
            <div className="my-2.5 flex h-24 w-10 items-end justify-center rounded bg-slate-200/70 p-1">
              <div
                className="w-full rounded-sm bg-[var(--accent)]"
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-[var(--text-secondary)] text-center">
              {bucket.label || bucket.range}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CircularProgressRing({
  value,
  size = 96,
  strokeWidth = 8,
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200/80"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-semibold text-[var(--text-primary)] tabular-nums">
          {clamped}%
        </span>
        {label && (
          <span className="text-[11px] text-[var(--text-muted)]">{label}</span>
        )}
      </div>
    </div>
  );
}
