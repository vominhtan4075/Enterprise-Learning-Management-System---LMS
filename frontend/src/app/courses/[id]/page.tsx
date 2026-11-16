"use client";

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/DashboardShell';
import { fetchCourseById } from '@/services/api';
import { useCurrentUser } from '@/services/auth';
import { getAccountLockState } from '@/lib/api-client';
import type { CourseDetail } from '@/types';

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.id;
  const currentUser = useCurrentUser();
  const isAccountLocked = getAccountLockState(currentUser) === 'locked';

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [activeLesson, setActiveLesson] = useState<CourseDetail['modules'][number]['lessons'][number] | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;

    fetchCourseById(courseId).then((data) => {
      if (!isMounted || !data) return;

      const safeModules = Array.isArray(data.modules) ? data.modules : [];
      setCourse({ ...data, modules: safeModules });
      setActiveLesson(safeModules[0]?.lessons?.[0] ?? null);
      setCompletedLessons(
        Object.fromEntries(
          safeModules.flatMap((module) =>
            (Array.isArray(module.lessons) ? module.lessons : []).map((lesson) => [
              lesson.id,
              Boolean(lesson.completed),
            ])
          )
        )
      );
    });

    return () => {
      isMounted = false;
    };
  }, [courseId]);

  const toggleLessonComplete = (lessonId: string) => {
    if (isAccountLocked) return;

    setCompletedLessons((prev) => ({
      ...prev,
      [lessonId]: !prev[lessonId],
    }));
  };

  if (!course) {
    return (
      <DashboardShell>
        <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-500">
          Đang tải chi tiết khóa học...
        </div>
      </DashboardShell>
    );
  }

  const modules = Array.isArray(course.modules) ? course.modules : [];
  const primaryQuizId = modules[0]?.quizId || modules[0]?.lessons?.[0]?.id || '';

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Link href="/courses" className="hover:text-blue-600">Lộ trình 30 Ngày</Link>
          <span>/</span>
          <span className="text-slate-900 font-bold truncate">{course.title}</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 uppercase">
                  {course.category}
                </span>
                <span className="text-xs font-semibold text-slate-500">• Giảng viên: {course.instructor}</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900">{course.title}</h1>
              <p className="text-sm text-slate-600 leading-relaxed">{course.description}</p>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
              <div className="text-left lg:text-right">
                <p className="text-xs text-slate-500">Tiến độ hoàn thành</p>
                <p className="text-2xl font-black text-blue-600">{course.progress}%</p>
              </div>

              <Link
                href={isAccountLocked ? '#' : primaryQuizId ? `/quizzes/${primaryQuizId}` : '/courses'}
                onClick={(event) => {
                  if (isAccountLocked) event.preventDefault();
                }}
                className={`rounded-xl px-4 py-2.5 text-xs font-bold shadow-md transition ${
                  isAccountLocked
                    ? 'pointer-events-none cursor-not-allowed bg-slate-200 text-slate-500 shadow-slate-200/0'
                    : 'bg-amber-500 text-white shadow-amber-500/20 hover:bg-amber-600'
                }`}
              >
                {isAccountLocked ? '🔒 Bị khóa' : '📝 Làm bài Quiz đánh giá'}
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.8fr_1.2fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            {activeLesson ? (
              <>
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 uppercase">
                      Định dạng: {activeLesson.type}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">Thời lượng: {activeLesson.duration}</span>
                  </div>
                  <h2 className="mt-3 text-xl font-bold text-slate-900">{activeLesson.title}</h2>
                </div>

                <div className="aspect-video w-full rounded-2xl bg-slate-900 flex flex-col items-center justify-center text-white p-6 shadow-inner relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/40 to-slate-950/80" />
                  <div className="relative z-10 text-center space-y-3">
                    <div className="h-16 w-16 mx-auto rounded-full bg-blue-600/90 flex items-center justify-center text-2xl shadow-lg">
                      ▶
                    </div>
                    <p className="text-sm font-semibold">Video bài giảng: {activeLesson.title}</p>
                    <p className="text-xs text-slate-400">Hệ thống đào tạo nội bộ NovaTech Solutions (E-Learning)</p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 text-xs text-slate-700 space-y-2">
                  <p className="font-bold text-slate-900 text-sm">Ghi chú & Tóm tắt kiến thức cốt lõi:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li>Nắm vững các nguyên lý clean code và tuân thủ định dạng chuẩn quy định tại công ty.</li>
                    <li>Áp dụng mô hình hướng đối tượng OOP và cơ chế quản lý Dependency Injection trong Spring.</li>
                    <li>Chuẩn bị kiến thức để hoàn thành bài kiểm tra trắc nghiệm kết thúc học phần đạt điểm sàn tối thiểu 70%.</li>
                  </ul>
                </div>

                <div className="flex items-center justify-between pt-2 gap-3">
                  <button
                    onClick={() => toggleLessonComplete(activeLesson.id)}
                    disabled={isAccountLocked}
                    className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                      isAccountLocked
                        ? 'pointer-events-none cursor-not-allowed bg-slate-200 text-slate-500'
                        : completedLessons[activeLesson.id]
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isAccountLocked
                      ? '🔒 Bị khóa'
                      : completedLessons[activeLesson.id]
                        ? '✓ Đã đánh dấu hoàn thành'
                        : 'Đánh dấu đã học xong'}
                  </button>

                  <Link
                    href={isAccountLocked ? '#' : primaryQuizId ? `/quizzes/${primaryQuizId}` : '/courses'}
                    onClick={(event) => {
                      if (isAccountLocked) event.preventDefault();
                    }}
                    className={`text-xs font-bold ${
                      isAccountLocked ? 'pointer-events-none text-slate-400' : 'text-amber-600 hover:underline'
                    }`}
                  >
                    {isAccountLocked ? 'Khóa quiz' : 'Chuyển sang làm Quiz →'}
                  </Link>
                </div>
              </>
            ) : null}
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">Đề Cương Học Phần ({modules.length} Module)</h3>

            {modules.map((mod, modIdx) => (
              <div key={mod.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-600">{mod.dayRange}</span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">{mod.title}</h4>
                  </div>
                </div>

                <div className="space-y-2">
                  {(Array.isArray(mod.lessons) ? mod.lessons : []).map((lesson, lessonIdx) => {
                    const isSelected = activeLesson?.id === lesson.id;
                    const isDone = Boolean(completedLessons[lesson.id]);

                    return (
                      <div
                        key={lesson.id}
                        onClick={() => {
                          if (!isAccountLocked) setActiveLesson(lesson);
                        }}
                        className={`flex items-center justify-between rounded-xl p-3 text-xs transition ${
                          isAccountLocked
                            ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                            : isSelected
                              ? 'bg-blue-50 border border-blue-300 text-blue-900 font-bold cursor-pointer'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-transparent cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              isDone ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-700'
                            }`}
                          >
                            {isDone ? '✓' : lessonIdx + 1}
                          </span>
                          <span className="truncate">{lesson.title}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0 ml-2">{lesson.duration}</span>
                      </div>
                    );
                  })}
                </div>

                {mod.quizId ? (
                  <Link
                    href={isAccountLocked ? '#' : `/quizzes/${mod.quizId}`}
                    onClick={(event) => {
                      if (isAccountLocked) event.preventDefault();
                    }}
                    className={`flex items-center justify-between rounded-xl p-2.5 text-xs font-bold mt-2 transition ${
                      isAccountLocked
                        ? 'pointer-events-none cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                        : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    <span>📝 Bài kiểm tra Module {modIdx + 1}</span>
                    <span className="text-[11px]">{isAccountLocked ? '🔒' : 'Điểm sàn 70% →'}</span>
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
