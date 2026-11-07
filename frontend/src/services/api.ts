import { mockCourses, mockUser, mockStats, mockActivities } from '@/data/mockData';
import type { CourseItem, QuizItem } from '@/types';
import { getAccessToken, getCurrentUser } from '@/services/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

function getJsonHeaders(extraHeaders: HeadersInit = {}) {
  const token = getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}

async function fetchJson<T>(path: string, init: RequestInit = {}, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        ...getJsonHeaders(init.headers),
      },
    });

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }

    const data = await res.json();
    const payload = data && typeof data === 'object' && 'data' in data ? data.data : data;
    return (payload ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export async function fetchHealth() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/health`, { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch {}
  return { status: 'offline', database: { status: 'mock' } };
}

export async function fetchUsers() {
  return fetchJson<any[]>(`/api/v1/users`, undefined, []);
}

export async function fetchUserProfile(userId?: string) {
  const fallback = { ...mockUser, role: mockUser.role || 'employee' };

  if (!userId) {
    try {
      const data = await fetchJson<Record<string, any>>('/api/v1/users/me', { method: 'GET' }, fallback);
      if (data && typeof data === 'object' && 'email' in data) {
        return {
          ...fallback,
          ...data,
          name: data.fullName || data.name || fallback.name,
          email: data.email || fallback.email,
          department: data.department || fallback.department,
          role: String(data.role || fallback.role).toLowerCase(),
        };
      }
    } catch {}
    return fallback;
  }

  try {
    const data = await fetchJson<Record<string, any>>(`/api/v1/users/${userId}`, { method: 'GET' }, fallback);
    if (data && typeof data === 'object' && 'email' in data) {
      return {
        ...fallback,
        ...data,
        name: data.fullName || data.name || fallback.name,
        email: data.email || fallback.email,
        department: data.department || fallback.department,
        role: String(data.role || fallback.role).toLowerCase(),
      };
    }
  } catch {}

  return fallback;
}

export async function fetchDashboardSummary() {
  const users = await fetchUsers();
  const currentUser = getCurrentUser();

  return {
    stats: mockStats,
    courses: mockCourses,
    activities: mockActivities,
    userCount: Array.isArray(users) ? users.length : 0,
    currentUser: currentUser || mockUser,
  };
}

export async function fetchCourses(): Promise<CourseItem[]> {
  const fallback = mockCourses;
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/courses`, {
      cache: 'no-store',
      headers: getJsonHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }

    const data = await res.json();
    const payload = data && typeof data === 'object' && 'data' in data ? data.data : data;
    if (Array.isArray(payload)) return payload as CourseItem[];
  } catch {}

  return fallback;
}

export async function fetchQuiz(quizId: string): Promise<QuizItem | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/quizzes/${quizId}`, {
      cache: 'no-store',
      headers: getJsonHeaders(),
    });
    if (res.ok) return await res.json();
  } catch {}

  return {
    id: quizId || 'quiz-java-core-01',
    title: 'Bài kiểm tra Học phần 1: Quy chuẩn NovaTech, Java Core & Spring Boot',
    passingScore: 70,
    timeLimitMin: 30,
    maxAttempts: 3,
    questions: [
      {
        id: 'q-101',
        content: 'Phát biểu nào sau đây mô tả đúng nhất về "Dependency Injection" trong Spring Framework?',
        options: [
          { key: 'A', text: 'Cơ chế container Spring tự động cung cấp các phụ thuộc cho bean thay vì bean tự khởi tạo.' },
          { key: 'B', text: 'Cơ chế kế thừa đa hình giữa các class con và interface.' },
          { key: 'C', text: 'Phương thức nén dữ liệu HTTP request trước khi gửi lên server.' },
          { key: 'D', text: 'Kỹ thuật tối ưu hóa câu lệnh truy vấn SQL trong cơ sở dữ liệu.' },
        ],
        correctAnswer: 'A',
        explanation: 'Dependency Injection (DI) là nguyên lý IoC trong đó Spring IoC Container quản lý và tiêm phụ thuộc vào đối tượng.',
        skillName: 'Java Core',
      },
      {
        id: 'q-102',
        content: 'Annotation nào trong Spring Boot dùng để khai báo một REST Controller trả dữ liệu JSON?',
        options: [
          { key: 'A', text: '@Component' },
          { key: 'B', text: '@Service' },
          { key: 'C', text: '@RestController' },
          { key: 'D', text: '@Repository' },
        ],
        correctAnswer: 'C',
        explanation: '@RestController là sự kết hợp của @Controller và @ResponseBody, dùng để xây dựng RESTful Web Services.',
        skillName: 'Java Core',
      },
      {
        id: 'q-103',
        content: 'Cấu trúc dữ liệu HashMap trong Java cung cấp độ phức tạp thời gian trung bình cho thao tác get() và put() là bao nhiêu?',
        options: [
          { key: 'A', text: 'O(n)' },
          { key: 'B', text: 'O(1)' },
          { key: 'C', text: 'O(log n)' },
          { key: 'D', text: 'O(n^2)' },
        ],
        correctAnswer: 'B',
        explanation: 'HashMap sử dụng hàm băm và mảng bucket, với điều kiện phân bố đều thì độ phức tạp trung bình là O(1).',
        skillName: 'Java Core',
      },
      {
        id: 'q-104',
        content: 'Khái niệm "Polymorphism" (Đa hình) trong lập trình hướng đối tượng (OOP) thể hiện điều gì?',
        options: [
          { key: 'A', text: 'Khả năng một đối tượng thể hiện nhiều hành vi khác nhau thông qua override hoặc interface.' },
          { key: 'B', text: 'Việc giấu thông tin và dữ liệu nội bộ của một class.' },
          { key: 'C', text: 'Tạo nhiều tiến trình xử lý song song trên CPU đa nhân.' },
          { key: 'D', text: 'Khả năng tự động giải phóng vùng nhớ rác trong JVM.' },
        ],
        correctAnswer: 'A',
        explanation: 'Tính đa hình cho phép các lớp con triển khai lại hành vi của lớp cha theo cách riêng.',
        skillName: 'Java Core',
      },
    ],
  };
}

export async function submitQuizApi(quizId: string, answers: { questionId: string; selectedOption: string }[]) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/quizzes/${quizId}/submit`, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ answers }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const quiz = await fetchQuiz(quizId);
  if (!quiz || !quiz.questions) return { score: 0, isPassed: false, suggestedLessons: [] };

  let correctCount = 0;
  const wrongQuestions: any[] = [];

  for (const ans of answers) {
    const q = quiz.questions.find((x) => x.id === ans.questionId);
    if (q && q.correctAnswer === ans.selectedOption) {
      correctCount++;
    } else if (q) {
      wrongQuestions.push(q);
    }
  }

  const scorePercentage = Math.round((correctCount / quiz.questions.length) * 100);
  const isPassed = scorePercentage >= quiz.passingScore;

  const suggestedLessons = !isPassed
    ? [
        { lessonId: 'les-01', lessonTitle: 'Quy chuẩn NovaTech & Cấu hình Spring Boot Bean Container' },
        { lessonId: 'les-02', lessonTitle: 'Lập trình Hướng đối tượng OOP & Tối ưu Java Collections' },
      ]
    : [];

  return {
    attemptId: 'att-' + Date.now(),
    score: scorePercentage,
    isPassed,
    attemptNumber: 1,
    suggestedLessons,
  };
}
