"use client";

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/DashboardShell';
import { fetchQuiz, submitQuizApi } from '@/services/api';
import type { QuizItem } from '@/types';

export default function QuizRunnerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const quizId = resolvedParams.id;

  const [quiz, setQuiz] = useState<QuizItem | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 phút
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    isPassed: boolean;
    attemptNumber: number;
    suggestedLessons: { lessonId: string; lessonTitle: string }[];
  } | null>(null);

  useEffect(() => {
    fetchQuiz(quizId).then((data) => setQuiz(data));
  }, [quizId]);

  // Bộ đếm thời gian thi
  useEffect(() => {
    if (result || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [result, timeLeft]);

  const handleSelect = (questionId: string, optionKey: string) => {
    if (result) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey,
    }));
  };

  const handleSubmit = async () => {
    if (!quiz || !quiz.questions || isSubmitting) return;

    const payload = quiz.questions.map((q) => ({
      questionId: q.id,
      selectedOption: selectedAnswers[q.id] || '',
    }));

    setIsSubmitting(true);
    const res = await submitQuizApi(quiz.id, payload);
    setIsSubmitting(false);

    setResult({
      score: res.score,
      isPassed: res.isPassed,
      attemptNumber: res.attemptNumber || 1,
      suggestedLessons: res.suggestedLessons || [],
    });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!quiz) {
    return (
      <DashboardShell>
        <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-500">
          Đang tải đề thi từ hệ thống...
        </div>
      </DashboardShell>
    );
  }

  const questions = quiz.questions || [];
  const answeredCount = Object.keys(selectedAnswers).length;

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header thông tin bài thi & Đồng hồ đếm ngược */}
        <div className="sticky top-20 z-10 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 uppercase">
                Quy tắc BR-01 • Điểm chuẩn $\ge 70\%$
              </span>
              <span className="text-xs text-slate-400">• Tối đa 3 lượt thi</span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 mt-1">{quiz.title}</h1>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-400">Thời gian làm bài</p>
              <p className="text-lg font-black text-blue-600 font-mono">{formatTime(timeLeft)}</p>
            </div>
            {!result ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || answeredCount === 0}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
              >
                {isSubmitting ? 'Đang chấm điểm...' : `Nộp bài (${answeredCount}/${questions.length})`}
              </button>
            ) : null}
          </div>
        </div>

        {/* Khối hiển thị kết quả sau khi nộp bài */}
        {result ? (
          <div
            className={`rounded-3xl border p-6 sm:p-8 shadow-lg transition-all ${
              result.isPassed
                ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-950'
                : 'border-red-200 bg-gradient-to-br from-red-50 to-white text-red-950'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-2">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider ${
                    result.isPassed ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                  }`}
                >
                  {result.isPassed ? '✓ ĐẠT YÊU CẦU (PASSED)' : '✕ CHƯA ĐẠT (FAILED)'}
                </span>
                <h2 className="text-2xl font-black">
                  {result.isPassed
                    ? 'Chúc mừng! Bạn đã hoàn thành xuất sắc bài kiểm tra'
                    : 'Bạn chưa đạt điểm chuẩn tối thiểu 70%'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  {result.isPassed
                    ? 'Hệ thống đã tự động cập nhật kết quả vào Ma trận năng lực cá nhân và mở khóa học phần tiếp theo.'
                    : 'Theo quy tắc nghiệp vụ BR-03, hệ thống đã kích hoạt chế độ thi lại và tổng hợp danh sách bài học cần ôn tập bên dưới.'}
                </p>
              </div>

              <div className="text-center sm:text-right shrink-0 bg-white/80 p-5 rounded-2xl border border-slate-200/60 shadow-sm">
                <p className="text-xs font-bold uppercase text-slate-500">Điểm số đạt được</p>
                <p className="text-4xl font-black text-slate-900 mt-1">{result.score}%</p>
                <p className="text-xs text-slate-500 mt-1">Lượt thi thứ #{result.attemptNumber}</p>
              </div>
            </div>

            {/* Danh sách bài học gợi ý ôn tập (Quy tắc BR-03) */}
            {!result.isPassed && result.suggestedLessons.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-red-200 bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <h3 className="text-sm font-bold text-red-900">
                    Gợi ý bài học cần ôn tập trước khi thi lại (Quy tắc BR-03):
                  </h3>
                </div>
                <div className="space-y-2">
                  {result.suggestedLessons.map((les) => (
                    <div
                      key={les.lessonId}
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-800 border border-slate-100"
                    >
                      <span className="flex items-center gap-2">
                        <span>📖</span>
                        <span>{les.lessonTitle}</span>
                      </span>
                      <Link href="/courses" className="text-blue-600 hover:underline">
                        Ôn lại ngay →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-4 pt-4 border-t border-slate-200/60">
              <button
                onClick={() => {
                  setResult(null);
                  setSelectedAnswers({});
                  setTimeLeft(30 * 60);
                }}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
              >
                🔄 Thi lại bài kiểm tra (Lượt #{result.attemptNumber + 1})
              </button>
              <Link
                href="/courses"
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-white transition"
              >
                ← Quay lại danh sách khóa học
              </Link>
            </div>
          </div>
        ) : null}

        {/* Danh sách câu hỏi trắc nghiệm */}
        <div className="space-y-6">
          {questions.map((q, idx) => {
            const isAnswered = Boolean(selectedAnswers[q.id]);
            const selectedOpt = selectedAnswers[q.id];

            return (
              <div
                key={q.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="h-6 w-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold uppercase text-slate-400">
                      Chủ đề: {q.skillName || 'Java Core'}
                    </span>
                  </div>
                  {isAnswered ? (
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      ✓ Đã chọn đáp án {selectedOpt}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400">Chưa chọn</span>
                  )}
                </div>

                <p className="text-sm font-bold text-slate-900 leading-relaxed">{q.content}</p>

                {/* Các phương án lựa chọn A, B, C, D */}
                <div className="space-y-2.5 pt-1">
                  {q.options.map((opt) => {
                    const isSelected = selectedOpt === opt.key;
                    const isCorrect = result && q.correctAnswer === opt.key;
                    const isWrongSelected = result && isSelected && !isCorrect;

                    let optionClass = 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-800';
                    if (isSelected && !result) {
                      optionClass = 'border-blue-500 bg-blue-50/70 text-blue-900 font-semibold ring-2 ring-blue-200';
                    } else if (isCorrect) {
                      optionClass = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-200';
                    } else if (isWrongSelected) {
                      optionClass = 'border-red-400 bg-red-50 text-red-900 font-semibold ring-2 ring-red-200';
                    }

                    return (
                      <div
                        key={opt.key}
                        onClick={() => handleSelect(q.id, opt.key)}
                        className={`flex items-start gap-3 rounded-xl border p-3.5 text-xs cursor-pointer transition ${optionClass}`}
                      >
                        <span
                          className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {opt.key}
                        </span>
                        <span className="flex-1 leading-relaxed">{opt.text}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Giải thích chi tiết đáp án khi đã nộp bài */}
                {result && q.explanation ? (
                  <div className="mt-3 rounded-xl bg-blue-50 p-3 text-xs text-blue-900 border border-blue-100">
                    <strong>💡 Giải thích chi tiết:</strong> {q.explanation}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
