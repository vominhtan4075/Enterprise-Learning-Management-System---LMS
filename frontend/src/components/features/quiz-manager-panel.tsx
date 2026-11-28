'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import { quizzesService } from '@/services/quizzes.service';
import type {
  CourseQuizBrief,
  QuestionManageItem,
  QuizManageDetail,
  QuizOptionItem,
} from '@/types/api.types';
import {
  Badge,
  Button,
  Input,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import { ConfirmDialog, Drawer, Modal } from '@/components/ui/overlays';

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function QuizManagerPanel({
  moduleId,
  initialQuiz,
  onChanged,
}: {
  moduleId: string;
  initialQuiz?: CourseQuizBrief | null;
  onChanged: () => void;
}) {
  const { success, error: showError } = useToast();

  const [quizDetail, setQuizDetail] = useState<QuizManageDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Create/Edit Quiz Config state
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [title, setTitle] = useState('');
  const [passingScore, setPassingScore] = useState('70');
  const [timeLimitMin, setTimeLimitMin] = useState('20');
  const [maxAttempts, setMaxAttempts] = useState('3');
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [confirmDeleteQuiz, setConfirmDeleteQuiz] = useState(false);
  const [deletingQuiz, setDeletingQuiz] = useState(false);

  // Question Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] =
    useState<QuestionManageItem | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<QuizOptionItem[]>([
    { key: 'A', text: '' },
    { key: 'B', text: '' },
    { key: 'C', text: '' },
    { key: 'D', text: '' },
  ]);
  const [correctAnswer, setCorrectAnswer] = useState('A');
  const [explanation, setExplanation] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(
    null,
  );

  // Excel Bulk Import state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importingExcel, setImportingExcel] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const syncFormFromQuiz = (q: QuizManageDetail) => {
    setTitle(q.title);
    setPassingScore(String(Number(q.passingScore ?? 70)));
    setTimeLimitMin(q.timeLimitMin ? String(q.timeLimitMin) : '');
    setMaxAttempts(String(q.maxAttempts ?? 3));
  };

  const loadFullQuiz = useCallback(
    async (quizId: string) => {
      setLoading(true);
      try {
        const detail = await quizzesService.getForManage(quizId);
        setQuizDetail(detail);
        syncFormFromQuiz(detail);
      } catch (err) {
        showError(
          'Không thể tải chi tiết đề kiểm tra',
          err instanceof ApiError ? err.message : undefined,
        );
      } finally {
        setLoading(false);
      }
    },
    [showError],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (initialQuiz?.id) {
        void loadFullQuiz(initialQuiz.id);
      } else {
        setQuizDetail(null);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [initialQuiz?.id, loadFullQuiz]);

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showError('Vui lòng nhập tiêu đề đề kiểm tra.');
      return;
    }
    setSavingQuiz(true);
    try {
      const created = await quizzesService.createForModule(moduleId, {
        title: title.trim(),
        passingScore: Number(passingScore) || 70,
        timeLimitMin: timeLimitMin ? Number(timeLimitMin) : null,
        maxAttempts: Number(maxAttempts) || 3,
      });
      setCreatingQuiz(false);
      setIsCollapsed(false);
      await loadFullQuiz(created.id);
      onChanged();
      success(
        'Đã tạo đề kiểm tra nháp',
        'Hãy thêm ít nhất 1 câu hỏi trắc nghiệm trước khi bật Xuất bản.',
      );
    } catch (err) {
      showError(
        'Không thể tạo đề kiểm tra',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setSavingQuiz(false);
    }
  };

  const handleUpdateQuizConfig = async (nextPublished?: boolean) => {
    if (!quizDetail) return;
    setSavingQuiz(true);
    try {
      await quizzesService.update(quizDetail.id, {
        title: title.trim(),
        passingScore: Number(passingScore) || 70,
        timeLimitMin: timeLimitMin ? Number(timeLimitMin) : null,
        maxAttempts: Number(maxAttempts) || 3,
        ...(nextPublished !== undefined ? { isPublished: nextPublished } : {}),
      });
      await loadFullQuiz(quizDetail.id);
      onChanged();
      success(
        nextPublished !== undefined
          ? nextPublished
            ? 'Đã xuất bản đề kiểm tra'
            : 'Đã chuyển đề kiểm tra về trạng thái nháp'
          : 'Đã lưu cấu hình đề kiểm tra',
      );
    } catch (err) {
      showError(
        'Cập nhật đề thi thất bại',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setSavingQuiz(false);
    }
  };

  const handleDeleteQuiz = async () => {
    if (!quizDetail) return;
    setDeletingQuiz(true);
    try {
      await quizzesService.remove(quizDetail.id);
      setQuizDetail(null);
      setConfirmDeleteQuiz(false);
      onChanged();
      success('Đã xóa đề kiểm tra.');
    } catch (err) {
      showError(
        'Không thể xóa đề kiểm tra',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setDeletingQuiz(false);
    }
  };

  const openNewQuestionDrawer = () => {
    setEditingQuestion(null);
    setQuestionText('');
    setOptions([
      { key: 'A', text: '' },
      { key: 'B', text: '' },
      { key: 'C', text: '' },
      { key: 'D', text: '' },
    ]);
    setCorrectAnswer('A');
    setExplanation('');
    setIsActive(true);
    setDrawerOpen(true);
  };

  const openEditQuestionDrawer = (q: QuestionManageItem) => {
    setEditingQuestion(q);
    setQuestionText(q.questionText);
    const opts =
      Array.isArray(q.options) && q.options.length >= 2
        ? q.options
        : [
            { key: 'A', text: '' },
            { key: 'B', text: '' },
          ];
    setOptions(opts);
    setCorrectAnswer(q.correctAnswer || opts[0].key);
    setExplanation(q.explanation || '');
    setIsActive(q.isActive !== false);
    setDrawerOpen(true);
  };

  const handleAddOption = () => {
    if (options.length >= 6) return;
    const nextKey = OPTION_KEYS[options.length];
    setOptions([...options, { key: nextKey, text: '' }]);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) return;
    const filtered = options
      .filter((_, i) => i !== idx)
      .map((item, i) => ({ ...item, key: OPTION_KEYS[i] }));
    setOptions(filtered);
    if (!filtered.some((o) => o.key === correctAnswer)) {
      setCorrectAnswer(filtered[0].key);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizDetail) return;
    if (!questionText.trim()) {
      showError('Nội dung câu hỏi không được để trống.');
      return;
    }
    if (options.some((o) => !o.text.trim())) {
      showError('Vui lòng nhập đầy đủ nội dung cho tất cả các phương án lựa chọn.');
      return;
    }

    setSavingQuestion(true);
    try {
      const payload = {
        questionText: questionText.trim(),
        options: options.map((o) => ({ key: o.key, text: o.text.trim() })),
        correctAnswer,
        explanation: explanation.trim() || null,
        isActive,
      };

      if (editingQuestion) {
        await quizzesService.updateQuestion(editingQuestion.id, payload);
        success('Đã cập nhật câu hỏi trắc nghiệm.');
      } else {
        await quizzesService.createQuestion(quizDetail.id, payload);
        success('Đã thêm câu hỏi mới vào đề kiểm tra.');
      }

      setDrawerOpen(false);
      await loadFullQuiz(quizDetail.id);
    } catch (err) {
      showError(
        'Lưu câu hỏi thất bại',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!quizDetail || !deletingQuestionId) return;
    try {
      await quizzesService.removeQuestion(deletingQuestionId);
      setDeletingQuestionId(null);
      await loadFullQuiz(quizDetail.id);
      success('Đã xóa câu hỏi.');
    } catch (err) {
      showError(
        'Không thể xóa câu hỏi',
        err instanceof ApiError ? err.message : undefined,
      );
    }
  };

  const openImportExcelModal = () => {
    setExcelFile(null);
    setImportMode('append');
    setImportErrors([]);
    setImportModalOpen(true);
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await quizzesService.downloadQuestionsTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mau-nhap-cau-hoi-quiz.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showError(
        'Không thể tải file Excel mẫu',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizDetail) return;
    if (!excelFile) {
      showError('Vui lòng chọn tệp Excel (.xlsx) chứa bộ câu hỏi.');
      return;
    }

    setImportingExcel(true);
    setImportErrors([]);
    try {
      const res = await quizzesService.importQuestionsExcel(
        quizDetail.id,
        excelFile,
        importMode,
      );
      setImportModalOpen(false);
      await loadFullQuiz(quizDetail.id);
      onChanged();
      success('Nhập bộ câu hỏi thành công!', res.message);
    } catch (err) {
      if (err instanceof ApiError) {
        if (Array.isArray(err.details) && err.details.length > 0) {
          setImportErrors(err.details.map((d) => String(d)));
        } else {
          setImportErrors([err.message]);
        }
        showError('Nhập file Excel chưa thành công', err.message);
      } else {
        showError('Không thể nhập file Excel.');
      }
    } finally {
      setImportingExcel(false);
    }
  };

  // Empty state: Module has no Quiz yet
  if (!quizDetail && !loading) {
    if (!creatingQuiz) {
      return (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)]/55 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <ClipboardList className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.75} />
            <span>Học phần này chưa gắn đề kiểm tra trắc nghiệm (1-1).</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setTitle('Bài kiểm tra đánh giá');
              setCreatingQuiz(true);
            }}
            leftIcon={<Plus className="h-3.5 w-3.5" strokeWidth={1.75} />}
          >
            Tạo đề kiểm tra Quiz
          </Button>
        </div>
      );
    }

    return (
      <form
        onSubmit={handleCreateQuiz}
        className="mt-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 space-y-3"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          Khởi tạo đề kiểm tra cho học phần
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Input
              label="Tiêu đề đề kiểm tra"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <Input
            label="Điểm đạt (70-100%)"
            type="number"
            min={70}
            max={100}
            value={passingScore}
            onChange={(e) => setPassingScore(e.target.value)}
          />
          <Input
            label="Số lượt tối đa"
            type="number"
            min={1}
            max={20}
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setCreatingQuiz(false)}
          >
            Hủy
          </Button>
          <Button type="submit" size="sm" loading={savingQuiz}>
            Tạo đề nháp
          </Button>
        </div>
      </form>
    );
  }

  if (loading || !quizDetail) {
    return (
      <div className="mt-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)]/40 px-4 py-3 text-xs text-[var(--text-muted)]">
        Đang tải thông tin đề kiểm tra...
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-[var(--accent-border)] bg-[var(--bg-subtle)]/65 p-4 space-y-4">
      {/* Quiz Header & Actions */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 ${
          !isCollapsed ? 'border-b border-[var(--border-default)] pb-3' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left cursor-pointer group"
          title={
            isCollapsed
              ? 'Mở rộng chi tiết đề kiểm tra'
              : 'Thu gọn chi tiết đề kiểm tra'
          }
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--text-secondary)] group-hover:bg-white/80 group-hover:text-[var(--text-primary)]">
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
            )}
          </span>
          <ClipboardList
            className="h-4 w-4 shrink-0 text-[var(--accent)]"
            strokeWidth={1.75}
          />
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Đề kiểm tra: {quizDetail.title}
          </span>
          <Badge tone={quizDetail.isPublished ? 'success' : 'warning'}>
            {quizDetail.isPublished ? 'Đang xuất bản' : 'Bản nháp'}
          </Badge>
          <Badge tone="neutral">
            {quizDetail.questions.length} câu ·{' '}
            {quizDetail._count?.quizAttempts ?? 0} lượt thi
          </Badge>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/courses/${quizDetail.module.courseId}?quizId=${quizDetail.id}`}
          >
            <Button size="sm" variant="secondary">
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
              Xem thử
            </Button>
          </Link>
          <Button
            size="sm"
            variant={quizDetail.isPublished ? 'secondary' : 'primary'}
            loading={savingQuiz}
            onClick={() => handleUpdateQuizConfig(!quizDetail.isPublished)}
          >
            {quizDetail.isPublished ? 'Hủy xuất bản' : 'Xuất bản đề thi'}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => setConfirmDeleteQuiz(true)}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Xóa đề
          </Button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Inline Config Controls */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div className="lg:col-span-2">
              <Input
                label="Tên đề kiểm tra"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <Input
              label="Điểm chuẩn (%)"
              type="number"
              min={70}
              max={100}
              value={passingScore}
              onChange={(e) => setPassingScore(e.target.value)}
            />
            <Input
              label="Thời gian (phút)"
              type="number"
              min={1}
              placeholder="Không giới hạn"
              value={timeLimitMin}
              onChange={(e) => setTimeLimitMin(e.target.value)}
            />
            <div className="flex items-end gap-2">
              <Input
                label="Số lượt thi"
                type="number"
                min={1}
                max={20}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
              />
              <Button
                size="md"
                variant="secondary"
                loading={savingQuiz}
                onClick={() => handleUpdateQuizConfig()}
                title="Lưu cấu hình đề thi"
              >
                <Save className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </div>
          </div>

          {/* Question Bank List */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Ngân hàng câu hỏi trắc nghiệm ({quizDetail.questions.length})
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={openImportExcelModal}
                  leftIcon={
                    <FileSpreadsheet
                      className="h-3.5 w-3.5"
                      strokeWidth={1.75}
                    />
                  }
                >
                  Nhập từ Excel
                </Button>
                <Button
                  size="sm"
                  onClick={openNewQuestionDrawer}
                  leftIcon={<Plus className="h-3.5 w-3.5" strokeWidth={1.75} />}
                >
                  Thêm câu hỏi
                </Button>
              </div>
            </div>

            {quizDetail.questions.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--border-default)] bg-white px-4 py-6 text-center text-xs text-[var(--text-muted)]">
                Chưa có câu hỏi nào. Nhấn <strong>Nhập từ Excel</strong> để tải
                lên hàng loạt bộ câu hỏi, hoặc <strong>Thêm câu hỏi</strong> để
                soạn thủ công từng câu.
              </div>
            ) : (
              <div className="space-y-2">
                {quizDetail.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className={`rounded-md border border-[var(--border-default)] bg-white p-3.5 ${
                      !q.isActive ? 'opacity-65' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold text-[var(--accent)] tabular-nums">
                            Câu {idx + 1}.
                          </span>
                          <Badge tone="success">
                            Đáp án: {q.correctAnswer}
                          </Badge>
                          {!q.isActive && <Badge tone="warning">Đang ẩn</Badge>}
                        </div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {q.questionText}
                        </p>
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 pt-1 text-xs text-[var(--text-secondary)]">
                          {(q.options ?? []).map((opt) => (
                            <div
                              key={opt.key}
                              className={`flex items-center gap-1.5 rounded px-2 py-1 ${
                                opt.key === q.correctAnswer
                                  ? 'bg-emerald-50 text-emerald-900 font-medium'
                                  : 'bg-slate-50'
                              }`}
                            >
                              {opt.key === q.correctAnswer && (
                                <CheckCircle2
                                  className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                                  strokeWidth={1.75}
                                />
                              )}
                              <span className="truncate">
                                <strong>{opt.key}.</strong> {opt.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditQuestionDrawer(q)}
                          title="Sửa câu hỏi"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeletingQuestionId(q.id)}
                          title="Xóa câu hỏi"
                        >
                          <Trash2
                            className="h-3.5 w-3.5 text-rose-700"
                            strokeWidth={1.75}
                          />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Slide-over Question Authoring Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          editingQuestion
            ? 'Chỉnh sửa câu hỏi trắc nghiệm'
            : 'Thêm câu hỏi trắc nghiệm mới'
        }
        subtitle="Chọn nút tròn ở đầu dòng để đánh dấu phương án trả lời đúng."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSaveQuestion} loading={savingQuestion}>
              {editingQuestion ? 'Lưu cập nhật' : 'Thêm vào đề thi'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveQuestion} className="space-y-4">
          <Textarea
            label="Nội dung câu hỏi *"
            rows={3}
            required
            placeholder="Nhập câu hỏi rõ ràng, ngắn gọn..."
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
          />

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                Các phương án lựa chọn (2 – 6 phương án) & Đáp án đúng *
              </label>
              {options.length < 6 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
                >
                  + Thêm lựa chọn ({OPTION_KEYS[options.length]})
                </button>
              )}
            </div>

            {options.map((opt, idx) => {
              const isCorrect = correctAnswer === opt.key;
              return (
                <div
                  key={opt.key}
                  className={`flex items-center gap-2.5 rounded-md border p-2 ${
                    isCorrect
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : 'border-[var(--border-default)] bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="correctOption"
                    checked={isCorrect}
                    onChange={() => setCorrectAnswer(opt.key)}
                    title={`Chọn ${opt.key} làm đáp án đúng`}
                    className="accent-emerald-600 cursor-pointer"
                  />
                  <span className="w-5 text-xs font-semibold text-[var(--text-primary)]">
                    {opt.key}.
                  </span>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, text: e.target.value } : item,
                        ),
                      )
                    }
                    placeholder={`Nội dung phương án ${opt.key}`}
                    className="h-8 flex-1 rounded border border-[var(--border-default)] bg-white px-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="rounded p-1 text-slate-400 hover:text-rose-700 cursor-pointer"
                      title="Xóa phương án này"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <Textarea
            label="Giải thích đáp án (tùy chọn)"
            rows={2}
            placeholder="Ghi chú lý do vì sao đáp án này chính xác..."
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />

          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <span>Hiển thị câu hỏi này trong đề thi chính thức</span>
          </label>
        </form>
      </Drawer>

      {/* Excel Bulk Question Import Modal */}
      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Nhập bộ câu hỏi từ file Excel (.xlsx)"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setImportModalOpen(false)}
            >
              Đóng
            </Button>
            <Button
              onClick={handleImportExcel}
              loading={importingExcel}
              disabled={!excelFile}
              leftIcon={<Upload className="h-4 w-4" strokeWidth={1.75} />}
            >
              Nhập bộ câu hỏi
            </Button>
          </>
        }
      >
        <form onSubmit={handleImportExcel} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3.5">
            <div className="space-y-0.5 text-xs">
              <p className="font-semibold text-[var(--text-primary)]">
                Bước 1: Tải file Excel mẫu chuẩn
              </p>
              <p className="text-[var(--text-secondary)]">
                Chỉ gồm các cột: Nội dung câu hỏi (*), Đáp án A..F và Đáp án đúng
                (*).
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={downloadingTemplate}
              onClick={handleDownloadTemplate}
              leftIcon={<Download className="h-3.5 w-3.5" strokeWidth={1.75} />}
            >
              Tải file mẫu (.xlsx)
            </Button>
          </div>

          <Select
            label="Chế độ nhập vào đề kiểm tra"
            value={importMode}
            onChange={(e) =>
              setImportMode(e.target.value as 'append' | 'replace')
            }
            options={[
              {
                value: 'append',
                label: 'Cộng thêm vào danh sách câu hỏi hiện có (Mặc định)',
              },
              {
                value: 'replace',
                label: 'Thay thế toàn bộ câu hỏi hiện có bằng file mới',
              },
            ]}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              Bước 2: Chọn tệp Excel câu hỏi (.xlsx, tối đa 5 MB) *
            </label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[var(--border-strong)] bg-white px-4 py-5 text-center transition-colors hover:border-[var(--accent)] hover:bg-[var(--bg-subtle)]/40">
              <FileSpreadsheet
                className="h-6 w-6 text-[var(--accent)]"
                strokeWidth={1.75}
              />
              {excelFile ? (
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {excelFile.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {(excelFile.size / 1024).toFixed(1)} KB · Nhấn để đổi tệp
                    khác
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Nhấn để chọn tệp .xlsx từ máy tính
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Hỗ trợ từ 2 đến 6 phương án lựa chọn mỗi câu, tối đa 500 câu
                    / lần nhập
                  </p>
                </div>
              )}
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const chosen = e.target.files?.[0] ?? null;
                  setExcelFile(chosen);
                  setImportErrors([]);
                }}
              />
            </label>
          </div>

          {importErrors.length > 0 && (
            <div className="max-h-44 overflow-y-auto rounded-md border border-rose-200 bg-rose-50/80 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-rose-900">
                Vui lòng kiểm tra lại các dòng sau trong file Excel:
              </p>
              <ul className="space-y-1 text-xs text-rose-800">
                {importErrors.map((msg, i) => (
                  <li key={i}>• {msg}</li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteQuiz}
        onClose={() => setConfirmDeleteQuiz(false)}
        onConfirm={handleDeleteQuiz}
        loading={deletingQuiz}
        title="Xóa đề kiểm tra?"
        description="Toàn bộ câu hỏi bên trong đề kiểm tra này sẽ bị xóa vĩnh viễn."
        confirmLabel="Xóa đề thi"
      />

      <ConfirmDialog
        open={Boolean(deletingQuestionId)}
        onClose={() => setDeletingQuestionId(null)}
        onConfirm={handleDeleteQuestion}
        title="Xóa câu hỏi trắc nghiệm?"
        description="Câu hỏi sẽ được xóa mềm để bảo toàn lịch sử bài làm của các học viên trước đó."
        confirmLabel="Xóa câu hỏi"
      />
    </div>
  );
}
