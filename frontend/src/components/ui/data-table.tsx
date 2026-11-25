'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, EmptyState, Skeleton } from './primitives';

export interface TableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render: (row: T, index: number) => React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  emptyTitle = 'Chưa có dữ liệu',
  emptyDescription,
  emptyAction,
  page,
  totalPages,
  total,
  onPageChange,
  onRowClick,
}: {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (nextPage: number) => void;
  onRowClick?: (row: T) => void;
}) {
  const alignClass = (align?: 'left' | 'center' | 'right') => {
    if (align === 'right') return 'text-right tabular-nums';
    if (align === 'center') return 'text-center';
    return 'text-left';
  };

  if (!loading && data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] ${alignClass(
                    col.align,
                  )} ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {loading
              ? Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`sk-${idx}`}>
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3.5">
                        <Skeleton className="h-4 w-4/5" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.map((row, idx) => (
                  <tr
                    key={rowKey(row, idx)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`transition-colors hover:bg-[var(--bg-subtle)]/70 ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3.5 text-[var(--text-primary)] ${alignClass(
                          col.align,
                        )} ${col.className || ''}`}
                      >
                        {col.render(row, idx)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {onPageChange &&
        page !== undefined &&
        totalPages !== undefined &&
        totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-default)] bg-[var(--bg-subtle)]/50 px-4 py-3 text-xs text-[var(--text-secondary)]">
            <span>
              Trang <strong className="tabular-nums">{page}</strong> /{' '}
              <strong className="tabular-nums">{totalPages}</strong>
              {total !== undefined && (
                <>
                  {' '}
                  · Tổng <strong className="tabular-nums">{total}</strong> bản
                  ghi
                </>
              )}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                Trước
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Sau
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        )}
    </div>
  );
}
