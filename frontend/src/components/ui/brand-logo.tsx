'use client';

import React from 'react';
import Link from 'next/link';

export function BrandLogo({
  href = '/dashboard',
  subtitle,
  accentColor,
}: {
  href?: string;
  subtitle?: string;
  accentColor?: string;
}) {
  const content = (
    <div className="inline-flex flex-col">
      <div className="inline-flex items-baseline gap-1.5 select-none leading-none">
        <span
          className="text-[22px] font-bold tracking-tight"
          style={{ color: accentColor || 'var(--accent)' }}
        >
          nova
        </span>
        <span className="text-[18px] font-light text-slate-400">/</span>
        <span className="text-[18px] font-normal tracking-tight text-slate-600">
          learn
        </span>
      </div>
      {subtitle && (
        <span className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">
          {subtitle}
        </span>
      )}
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="inline-flex items-center hover:opacity-90">
      {content}
    </Link>
  );
}
