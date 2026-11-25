'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import { NOTIFICATION_TYPE_LABELS, formatDateTime } from '@/lib/formatters';
import { notificationsService } from '@/services/notifications.service';
import type {
  NotificationItem,
  NotificationListResponse,
} from '@/types/api.types';
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';

export default function NotificationsCenterPage() {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const router = useRouter();

  const [list, setList] = useState<NotificationListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [runningReminders, setRunningReminders] = useState(false);

  const canRunReminders = user?.role === 'ADMIN' || user?.role === 'HR';

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsService.getAll({
        page,
        limit: 15,
        unreadOnly: unreadOnly || undefined,
      });
      setList(res);
    } catch (err) {
      showError(
        'Không thể tải trung tâm thông báo',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly, showError]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetchNotifications();
    }, 0);
    return () => window.clearTimeout(t);
  }, [fetchNotifications]);

  const handleClickItem = async (item: NotificationItem) => {
    if (!item.readAt) {
      try {
        await notificationsService.markRead(item.id);
      } catch {
        // ignore
      }
    }
    if (item.refType === 'course' && item.refId) {
      router.push(`/courses/${item.refId}`);
    } else if (item.refType === 'path' && item.refId) {
      router.push(`/learning-paths/${item.refId}`);
    } else if (item.refType === 'quiz' && item.refId) {
      router.push(`/quizzes/${item.refId}`);
    } else {
      await fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await notificationsService.markAllRead();
      success(`Đã đánh dấu đọc ${res.updatedCount} thông báo.`);
      await fetchNotifications();
    } catch (err) {
      showError(
        'Thao tác thất bại',
        err instanceof ApiError ? err.message : undefined,
      );
    }
  };

  const handleRunReminders = async () => {
    setRunningReminders(true);
    try {
      const res = await notificationsService.runReminders();
      success(
        'Đã hoàn tất quét nhắc hạn & quá hạn',
        `Đã quét ${res.scannedCount} lượt học · Gửi ${res.remindersSent} nhắc nhở · Đánh dấu ${res.overdueMarked} quá hạn.`,
      );
      await fetchNotifications();
    } catch (err) {
      showError(
        'Không thể chạy tác vụ nhắc hạn',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setRunningReminders(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trung tâm Thông báo"
        description="Theo dõi thông báo giao bài học, nhắc hạn hoàn thành (D-3, D-1, D-0) và kết quả các kỳ đánh giá."
        badge={
          list?.unreadCount ? (
            <Badge tone="accent">{list.unreadCount} chưa đọc</Badge>
          ) : undefined
        }
        secondaryAction={
          canRunReminders ? (
            <Button
              variant="secondary"
              loading={runningReminders}
              onClick={handleRunReminders}
              leftIcon={<BellRing className="h-4 w-4" strokeWidth={1.75} />}
            >
              Quét nhắc hạn ngay
            </Button>
          ) : undefined
        }
        action={
          (list?.unreadCount ?? 0) > 0 ? (
            <Button
              onClick={handleMarkAllRead}
              leftIcon={<CheckCheck className="h-4 w-4" strokeWidth={1.75} />}
            >
              Đánh dấu đọc tất cả
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setUnreadOnly(false);
          }}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium cursor-pointer ${
            !unreadOnly
              ? 'bg-[var(--accent)] text-white'
              : 'bg-white border border-[var(--border-default)] text-[var(--text-secondary)]'
          }`}
        >
          Tất cả thông báo
        </button>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setUnreadOnly(true);
          }}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium cursor-pointer ${
            unreadOnly
              ? 'bg-[var(--accent)] text-white'
              : 'bg-white border border-[var(--border-default)] text-[var(--text-secondary)]'
          }`}
        >
          Chưa đọc
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !list?.data || list.data.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" strokeWidth={1.75} />}
          title="Không có thông báo nào"
          description="Mọi thông báo giao lộ trình, khóa học và nhắc nhở hạn chót sẽ xuất hiện tại đây."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-white divide-y divide-[var(--border-default)]">
          {list.data.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleClickItem(n)}
              className={`flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--bg-subtle)] cursor-pointer ${
                !n.readAt ? 'bg-[var(--bg-subtle)]/55' : ''
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {!n.readAt && (
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                  )}
                  <Badge tone="neutral">
                    {NOTIFICATION_TYPE_LABELS[n.type] || n.type}
                  </Badge>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {n.title}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {n.body}
                </p>
              </div>
              <span className="shrink-0 text-xs text-[var(--text-muted)] tabular-nums">
                {formatDateTime(n.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
