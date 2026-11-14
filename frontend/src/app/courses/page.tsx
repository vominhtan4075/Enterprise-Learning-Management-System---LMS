"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { fetchCourses } from '@/services/api';
import { useCurrentUser } from '@/services/auth';
import { getAccountLockState } from '@/lib/api-client';
import type { CourseItem } from '@/types';

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const currentUser = useCurrentUser();
  const isAccountLocked = getAccountLockState(currentUser) === 'locked';

  useEffect(() => {
    fetchCourses().then(setCourses);
  }, []);

  return (
    <DashboardShell>
      <div className="space-y-8">
        <div className="rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-8 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-3xl">
            <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-md mb-3">
              Lộ trình bắt buộc • Fresher Backend Java
            </span>
            <h1 className="text-3xl font-black leading-tight">Chương Trình Đào Tạo Onboarding 30 Ngày</h1>
            <p className="mt-3 text-sm text-blue-100 leading-relaxed">
              Học viên được trải qua 4 học phần chuyên môn: Java Core & Spring Boot, PostgreSQL & REST API, Microservices & Docker, Security & CI/CD, kết thúc bằng bài thi đánh giá tổng hợp để xác nhận đủ năng lực làm việc trong môi trường backend Java.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-6 text-sm font-semibold">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span>4 học phần chuyên môn</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-cyan-300" />
                <span>1 bài thi tổng hợp</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-slate-300" />
                <span>Điểm chuẩn ≥ 70%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Danh Sách Học Phần Trong Lộ Trình</h2>
            <span className="text-sm text-slate-500 font-medium">Tổng số: {courses.length} học phần</span>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {courses.map((course, index) => (
              <div
                key={course.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="inline-block rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 uppercase tracking-wider">
                      Học phần {index + 1}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        course.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : course.status === 'active'
                            ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-400/30'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {course.status === 'completed'
                        ? '✓ Đã hoàn thành'
                        : course.status === 'active'
                          ? '● Đang học'
                          : '🔒 Chưa mở khóa'}
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-slate-900">{course.title}</h3>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">{course.description}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 border-y border-slate-100 py-3">
                    <span>⏱ Thời lượng: <strong>{course.duration}</strong></span>
                    <span>👨‍🏫 Giảng viên: <strong>{course.instructor}</strong></span>
                    <span>📑 Bài học: <strong>{course.lessonsCount || 0} bài</strong></span>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-600 mb-1.5">
                      <span>Tiến độ học</span>
                      <span className="font-bold">{course.progress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          course.progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Link
                      href={isAccountLocked ? '#' : `/courses/${course.id}`}
                      onClick={(event) => {
                        if (isAccountLocked) {
                          event.preventDefault();
                        }
                      }}
                      className={`flex-1 text-center rounded-xl py-2.5 text-xs font-bold transition shadow-sm ${
                        isAccountLocked
                          ? 'pointer-events-none cursor-not-allowed bg-slate-200 text-slate-500'
                          : course.status === 'upcoming'
                            ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
                      }`}
                    >
                      {isAccountLocked
                        ? '🔒 Bị khóa'
                        : course.status === 'completed'
                          ? 'Xem lại bài giảng'
                          : course.status === 'active'
                            ? 'Tiếp tục học ngay'
                            : 'Xem đề cương học phần'}
                    </Link>
                    <Link
                      href={isAccountLocked ? '#' : `/quizzes/quiz-module-JAVA_CORE_01-1`}
                      onClick={(event) => {
                        if (isAccountLocked) {
                          event.preventDefault();
                        }
                      }}
                      className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${
                        isAccountLocked
                          ? 'pointer-events-none cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                      title={isAccountLocked ? 'Tài khoản bị khóa' : 'Làm bài kiểm tra đánh giá'}
                    >
                      {isAccountLocked ? '🔒' : '📝'} Quiz
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
