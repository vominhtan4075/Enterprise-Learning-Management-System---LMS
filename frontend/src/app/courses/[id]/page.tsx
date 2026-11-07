"use client";

import { use, useState } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/DashboardShell';
import { mockCourses, mockCourseDetails } from '@/data/mockData';

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.id;

  const course = mockCourses.find((c) => c.id === courseId) || mockCourses[0];
  const details = mockCourseDetails[courseId] || mockCourseDetails['course-JAVA_CORE_01'];

  const [activeLesson, setActiveLesson] = useState(details.modules[0]?.lessons[0] || null);
  const [completedLessons, setCompletedLessons] = useState<Record<string, boolean>>({
    'les-101': true,
    'les-102': true,
    'les-103': true,
    'les-104': true,
    'les-105': true,
    'les-106': true,
    'les-201': true,
    'les-202': true,
  });

  const toggleLessonComplete = (lessonId: string) => {
    setCompletedLessons((prev) => ({
      ...prev,
      [lessonId]: !prev[lessonId],
    }));
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Link href="/courses" className="hover:text-blue-600">Lộ trình 30 Ngày</Link>
          <span>/</span>
          <span className="text-slate-900 font-bold truncate">{course.title}</span>
        </div>

        {/* Course Header Banner */}
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
              <p className="text-sm text-slate-600 leading-relaxed">{details.description}</p>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
              <div className="text-left lg:text-right">
                <p className="text-xs text-slate-500">Tiến độ hoàn thành</p>
                <p className="text-2xl font-black text-blue-600">{course.progress}%</p>
              </div>
              <Link
                href="/quizzes/quiz-module-JAVA_CORE_01-1"
                className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-500/20 hover:bg-amber-600 transition"
              >
                📝 Làm bài Quiz đánh giá
              </Link>
            </div>
          </div>
        </div>

        {/* Nội dung bài học (2 cột: Trình xem bài học & Danh mục bài học) */}
        <div className="grid gap-6 lg:grid-cols-[1.8fr_1.2fr]">
          {/* Cột trái: Trình xem nội dung bài giảng */}
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

                {/* Media Preview Box */}
                <div className="aspect-video w-full rounded-2xl bg-slate-900 flex flex-col items-center justify-center text-white p-6 shadow-inner relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/40 to-slate-950/80" />
                  <div className="relative z-10 text-center space-y-3">
                    <div className="h-16 w-16 mx-auto rounded-full bg-blue-600/90 flex items-center justify-center text-2xl shadow-lg cursor-pointer hover:scale-105 transition">
                      ▶
                    </div>
                    <p className="text-sm font-semibold">Video bài giảng: {activeLesson.title}</p>
                    <p className="text-xs text-slate-400">Hệ thống đào tạo nội bộ NovaTech Solutions (E-Learning)</p>
                  </div>
                </div>

                {/* Tóm tắt nội dung bài học */}
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 text-xs text-slate-700 space-y-2">
                  <p className="font-bold text-slate-900 text-sm">Ghi chú & Tóm tắt kiến thức cốt lõi:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li>Nắm vững các nguyên lý clean code và tuân thủ định dạng chuẩn quy định tại công ty.</li>
                    <li>Áp dụng mô hình hướng đối tượng OOP và cơ chế quản lý Dependency Injection trong Spring.</li>
                    <li>Chuẩn bị kiến thức để hoàn thành bài kiểm tra trắc nghiệm kết thúc học phần đạt điểm sàn tối thiểu 70%.</li>
                  </ul>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => toggleLessonComplete(activeLesson.id)}
                    className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                      completedLessons[activeLesson.id]
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {completedLessons[activeLesson.id] ? '✓ Đã đánh dấu hoàn thành' : 'Đánh dấu đã học xong'}
                  </button>

                  <Link
                    href="/quizzes/quiz-module-JAVA_CORE_01-1"
                    className="text-xs font-bold text-amber-600 hover:underline"
                  >
                    Chuyển sang làm Quiz →
                  </Link>
                </div>
              </>
            ) : null}
          </div>

          {/* Cột phải: Danh mục học phần & Danh sách bài học */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">Đề Cương Học Phần ({details.modules.length} Module)</h3>

            {details.modules.map((mod, modIdx) => (
              <div key={mod.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-600">{mod.dayRange}</span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">{mod.title}</h4>
                  </div>
                </div>

                <div className="space-y-2">
                  {mod.lessons.map((les, lesIdx) => {
                    const isSelected = activeLesson?.id === les.id;
                    const isDone = completedLessons[les.id];

                    return (
                      <div
                        key={les.id}
                        onClick={() => setActiveLesson(les)}
                        className={`flex items-center justify-between rounded-xl p-3 text-xs cursor-pointer transition ${
                          isSelected
                            ? 'bg-blue-50 border border-blue-300 text-blue-900 font-bold'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              isDone ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-700'
                            }`}
                          >
                            {isDone ? '✓' : lesIdx + 1}
                          </span>
                          <span className="truncate">{les.title}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0 ml-2">{les.duration}</span>
                      </div>
                    );
                  })}
                </div>

                {mod.quizId ? (
                  <Link
                    href={`/quizzes/${mod.quizId}`}
                    className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition mt-2"
                  >
                    <span>📝 Bài kiểm tra Module {modIdx + 1}</span>
                    <span className="text-[11px] text-amber-700">Điểm sàn 70% →</span>
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
