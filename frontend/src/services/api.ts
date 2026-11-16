
import type {
  CourseDetail,
  CourseItem,
  QuizItem,
  UserProfile,
} from '@/types';
import { getCurrentUser } from '@/services/auth';
import { apiClient } from '@/lib/api-client';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeRole(role: string | undefined): UserProfile['role'] {
  const normalized = String(role || 'employee').trim().toLowerCase();

  if (normalized === 'admin') return 'admin';
  if (normalized === 'manager') return 'manager';
  if (normalized === 'hr' || normalized === 'trainer') return 'manager';
  return 'employee';
}

function normalizeCourseStatus(value: unknown): CourseItem['status'] {
  const normalized = String(value ?? 'upcoming').trim().toLowerCase();
  if (normalized === 'completed') return 'completed';
  if (normalized === 'active' || normalized === 'true') return 'active';
  return 'upcoming';
}

function normalizeCourseItem(data: Record<string, unknown>, index = 0): CourseItem {
  const courseCount = isRecord(data._count) ? data._count : {};

  return {
    id: String(data.id ?? `course-${index}`),
    title: String(data.title ?? `Khóa học ${index + 1}`),
    category: String(data.category ?? data.type ?? 'Backend Java'),
    progress: Math.min(100, Math.max(0, toNumber(data.progress, 0))),
    duration: String(data.duration ?? `${toNumber(data.estimatedHours, 0)} giờ`),
    instructor:
      typeof data.instructor === 'string'
        ? data.instructor
        : isRecord(data.createdBy) && typeof data.createdBy.fullName === 'string'
          ? data.createdBy.fullName
          : 'Chưa cập nhật',
    status: normalizeCourseStatus(data.status ?? data.isPublished),
    description:
      typeof data.description === 'string'
        ? data.description
        : undefined,
    lessonsCount: toNumber(data.lessonsCount ?? courseCount.modules ?? 0),
  };
}

function normalizeCourseDetail(data: Record<string, unknown>): CourseDetail | null {
  const rawModules = Array.isArray(data.modules) ? data.modules : [];
  const modules = rawModules
    .map((mod) => {
      if (!isRecord(mod)) return null;
      const lessons = Array.isArray(mod.lessons) ? mod.lessons : [];
      return {
        id: String(mod.id ?? 'module-1'),
        title: String(mod.title ?? 'Module'),
        dayRange:
          typeof mod.dayRange === 'string' ? mod.dayRange : `Ngày ${toNumber(mod.dayStart, 1)} - ${toNumber(mod.dayEnd, toNumber(mod.dayStart, 1) + 3)}`,
        quizId:
          isRecord(mod.quiz) && typeof mod.quiz.id === 'string'
            ? String(mod.quiz.id)
            : undefined,
        lessons: lessons
          .filter((lesson): lesson is Record<string, unknown> => isRecord(lesson))
          .map((lesson) => ({
            id: String(lesson.id ?? 'lesson-1'),
            title: String(lesson.title ?? 'Bài học'),
            duration: String(lesson.duration ?? `${toNumber(lesson.durationMinutes, 30)} phút`),
            type: String(lesson.type ?? lesson.contentType ?? 'VIDEO'),
            completed: Boolean(lesson.completed),
          })),
      };
    })
    .filter(Boolean) as CourseDetail['modules'];

  return {
    id: String(data.id ?? 'course-1'),
    title: String(data.title ?? 'Khóa học'),
    description: String(data.description ?? 'Nội dung khóa học đang được cập nhật.'),
    category: String(data.category ?? 'Backend Java'),
    progress: Math.min(100, Math.max(0, toNumber(data.progress, 0))),
    duration: String(data.duration ?? `${toNumber(data.estimatedHours, 0)} giờ`),
    instructor:
      typeof data.instructor === 'string'
        ? data.instructor
        : isRecord(data.createdBy) && typeof data.createdBy.fullName === 'string'
          ? data.createdBy.fullName
          : 'Chưa cập nhật',
    status: normalizeCourseStatus(data.status ?? data.isPublished),
    modules,
  };
}

const fallbackCourseCatalog: CourseItem[] = [
  {
    id: 'course-JAVA_CORE_01',
    title: 'Học phần 1: Java Core & Spring Boot',
    category: 'Backend Java',
    progress: 45,
    duration: '5 ngày',
    instructor: 'Trainer Java',
    status: 'active',
    description: 'Nền tảng Java Core, OOP, Spring Boot, cấu hình ứng dụng và REST API.',
    lessonsCount: 6,
  },
  {
    id: 'course-POSTGRES_01',
    title: 'Học phần 2: PostgreSQL & REST API',
    category: 'Backend Java',
    progress: 25,
    duration: '5 ngày',
    instructor: 'Trainer Database',
    status: 'upcoming',
    description: 'Thiết kế schema, query, transaction, tối ưu hóa PostgreSQL và xây dựng API.',
    lessonsCount: 5,
  },
  {
    id: 'course-MICROSERVICES_01',
    title: 'Học phần 3: Microservices, Redis & Docker',
    category: 'Backend Java',
    progress: 0,
    duration: '5 ngày',
    instructor: 'Trainer DevOps',
    status: 'upcoming',
    description: 'Tạo dịch vụ, cấu hình Redis, Docker, triển khai và giám sát nền tảng.',
    lessonsCount: 5,
  },
  {
    id: 'course-SECURITY_01',
    title: 'Học phần 4: Security, CI/CD & Playwright',
    category: 'Backend Java',
    progress: 0,
    duration: '5 ngày',
    instructor: 'Trainer Platform',
    status: 'upcoming',
    description: 'Bảo mật API, CI/CD, kiểm thử tự động và vận hành production-ready ứng dụng.',
    lessonsCount: 5,
  },
];

const fallbackCourseDetails: Record<string, CourseDetail> = {
  'course-JAVA_CORE_01': {
    id: 'course-JAVA_CORE_01',
    title: 'Học phần 1: Java Core & Spring Boot',
    description: 'Nền tảng Java Core, OOP, Spring Boot, dependency injection, cấu hình và xây dựng REST API.',
    category: 'Backend Java',
    progress: 45,
    duration: '5 ngày',
    instructor: 'Trainer Java',
    status: 'active',
    modules: [
      {
        id: 'mod-java-core-01',
        title: 'Java Core Fundamentals',
        dayRange: 'Ngày 1 - 2',
        quizId: 'quiz-java-core-01',
        lessons: [
          { id: 'les-101', title: 'Giới thiệu Java Core', duration: '35 phút', type: 'VIDEO', completed: true },
          { id: 'les-102', title: 'OOP & Encapsulation', duration: '40 phút', type: 'VIDEO', completed: true },
          { id: 'les-103', title: 'Collection & Stream API', duration: '45 phút', type: 'MARKDOWN', completed: true },
        ],
      },
      {
        id: 'mod-java-core-02',
        title: 'Spring Boot & REST API',
        dayRange: 'Ngày 3 - 5',
        quizId: 'quiz-java-core-02',
        lessons: [
          { id: 'les-201', title: 'Spring Boot configuration', duration: '50 phút', type: 'VIDEO', completed: false },
          { id: 'les-202', title: 'REST API & validation', duration: '55 phút', type: 'VIDEO', completed: false },
          { id: 'les-203', title: 'Exception handling', duration: '35 phút', type: 'PDF', completed: false },
        ],
      },
    ],
  },
  'course-POSTGRES_01': {
    id: 'course-POSTGRES_01',
    title: 'Học phần 2: PostgreSQL & REST API',
    description: 'Thiết kế schema, query, transaction, tối ưu hóa PostgreSQL và xây dựng API.',
    category: 'Backend Java',
    progress: 25,
    duration: '5 ngày',
    instructor: 'Trainer Database',
    status: 'upcoming',
    modules: [
      {
        id: 'mod-postgres-01',
        title: 'Database Schema & Indexing',
        dayRange: 'Ngày 1 - 2',
        quizId: 'quiz-postgres-01',
        lessons: [
          { id: 'les-pg-101', title: 'Thiết kế chuẩn hóa cơ sở dữ liệu', duration: '45 phút', type: 'VIDEO', completed: false },
          { id: 'les-pg-102', title: 'Indexing và tối ưu câu lệnh Query', duration: '50 phút', type: 'MARKDOWN', completed: false },
        ],
      },
      {
        id: 'mod-postgres-02',
        title: 'Spring Data JPA & Transaction',
        dayRange: 'Ngày 3 - 5',
        quizId: 'quiz-postgres-02',
        lessons: [
          { id: 'les-pg-201', title: 'Quản lý Transaction trong Spring', duration: '40 phút', type: 'VIDEO', completed: false },
          { id: 'les-pg-202', title: 'Xây dựng REST CRUD chuẩn RESTful', duration: '60 phút', type: 'VIDEO', completed: false },
        ],
      },
    ],
  },
  'course-MICROSERVICES_01': {
    id: 'course-MICROSERVICES_01',
    title: 'Học phần 3: Microservices, Redis & Docker',
    description: 'Tạo dịch vụ, cấu hình Redis, Docker, triển khai và giám sát nền tảng.',
    category: 'Backend Java',
    progress: 0,
    duration: '5 ngày',
    instructor: 'Trainer DevOps',
    status: 'upcoming',
    modules: [
      {
        id: 'mod-micro-01',
        title: 'Kiến trúc Microservices & Caching Redis',
        dayRange: 'Ngày 1 - 3',
        quizId: 'quiz-micro-01',
        lessons: [
          { id: 'les-mc-101', title: 'Tổng quan kiến trúc phân tán', duration: '45 phút', type: 'VIDEO', completed: false },
          { id: 'les-mc-102', title: 'Redis Cache & Blacklist Token', duration: '40 phút', type: 'MARKDOWN', completed: false },
        ],
      },
    ],
  },
  'course-SECURITY_01': {
    id: 'course-SECURITY_01',
    title: 'Học phần 4: Security, CI/CD & Playwright',
    description: 'Bảo mật API, CI/CD, kiểm thử tự động và vận hành production-ready ứng dụng.',
    category: 'Backend Java',
    progress: 0,
    duration: '5 ngày',
    instructor: 'Trainer Platform',
    status: 'upcoming',
    modules: [
      {
        id: 'mod-sec-01',
        title: 'JWT Authentication & RBAC',
        dayRange: 'Ngày 1 - 2',
        quizId: 'quiz-sec-01',
        lessons: [
          { id: 'les-sec-101', title: 'Xác thực phân quyền theo RoleCode', duration: '50 phút', type: 'VIDEO', completed: false },
          { id: 'les-sec-102', title: 'CI/CD Pipeline với Docker', duration: '45 phút', type: 'PDF', completed: false },
        ],
      },
    ],
  },
};

async function fetchJson<T>(path: string, init: RequestInit = {}, fallback: T): Promise<T> {
  try {
    return await apiClient<T>(path, init);
  } catch {
    return fallback;
  }
}

export async function fetchHealth() {
  try {
    return await apiClient('/api/v1/health', { method: 'GET' });
  } catch {
    return { status: 'offline', database: { status: 'offline' } };
  }
}

export async function fetchUsers() {
  return fetchJson<unknown[]>('/api/v1/users', { method: 'GET' }, []);
}

export async function fetchUserProfile(userId?: string): Promise<UserProfile> {
  const fallback: UserProfile = {
    id: 'user-current',
    name: 'Người dùng',
    email: 'user@novatech.com',
    role: 'employee',
    department: 'Phòng Nhân sự',
    mustChangePassword: false,
    isActive: true,
  };

  try {
    const path = userId ? `/api/v1/users/${userId}` : '/api/v1/auth/me';
    const data = await apiClient<unknown>(path, { method: 'GET' });

    if (!isRecord(data)) {
      const currentUser = getCurrentUser();
      return currentUser || fallback;
    }

    const currentUser = getCurrentUser() || fallback;
    const nextUser: UserProfile = {
      ...currentUser,
      ...fallback,
      id: String(data.id ?? currentUser.id ?? fallback.id),
      name:
        typeof data.fullName === 'string'
          ? data.fullName
          : typeof data.name === 'string'
            ? data.name
            : currentUser.name || fallback.name,
      email:
        typeof data.email === 'string' ? data.email : currentUser.email || fallback.email,
      role: normalizeRole(
        typeof data.role === 'string' ? data.role : currentUser.role || fallback.role,
      ),
      department:
        typeof data.department === 'string'
          ? data.department
          : currentUser.department || fallback.department,
      mustChangePassword: Boolean(
        data.mustChangePassword ?? currentUser.mustChangePassword ?? false,
      ),
      isActive:
        data.isActive !== undefined ? Boolean(data.isActive) : currentUser.isActive ?? true,
    };

    return nextUser;
  } catch {
    const currentUser = getCurrentUser();
    return currentUser || fallback;
  }
}

export async function fetchDashboardSummary() {
  const [users, currentUser, courses] = await Promise.all([
    fetchUsers(),
    fetchUserProfile(),
    fetchCourses(),
  ]);

  const stats = [
    {
      label: 'Khóa học đang học',
      value: String(courses.filter((course) => course.status === 'active').length),
      change: '+10%',
      positive: true,
    },
    {
      label: 'Khóa học hoàn thành',
      value: String(courses.filter((course) => course.status === 'completed').length),
      change: '+4%',
      positive: true,
    },
    {
      label: 'Tổng nhân sự',
      value: String(Array.isArray(users) ? users.length : 0),
      change: '+12%',
      positive: true,
    },
    { label: 'Điểm trung bình', value: '87.5%', change: '+3.2%', positive: true },
  ];

  return {
    stats,
    courses,
    activities: [
      { id: 'act-01', title: 'Bạn đã hoàn thành module Java Core', time: '2 giờ trước', type: 'course' as const },
      { id: 'act-02', title: 'Bài quiz Spring Boot được mở lại', time: 'Hôm qua', type: 'assessment' as const },
      { id: 'act-03', title: 'Thông báo: lịch học tuần mới đã được cập nhật', time: '2 ngày trước', type: 'system' as const },
    ],
    userCount: Array.isArray(users) ? users.length : 0,
    currentUser,
  };
}

export async function fetchCourses(): Promise<CourseItem[]> {
  try {
    const data = await apiClient<unknown>('/api/v1/courses', { method: 'GET' });

    const items = isRecord(data) && Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];

    const normalized = items
      .filter((item): item is Record<string, unknown> => isRecord(item))
      .map((item, index) => normalizeCourseItem(item, index));

    return normalized.length > 0 ? normalized : fallbackCourseCatalog;
  } catch {
    return fallbackCourseCatalog;
  }
}

export async function fetchCourseById(courseId: string): Promise<CourseDetail | null> {
  try {
    const data = await apiClient<unknown>(`/api/v1/courses/${courseId}`, { method: 'GET' });
    if (isRecord(data)) {
      const normalized = normalizeCourseDetail(data);
      if (normalized && Array.isArray(normalized.modules)) {
        return normalized;
      }
    }
  } catch {
    // API not ready, fall back to predefined curriculum
  }

  if (fallbackCourseDetails[courseId]) {
    return fallbackCourseDetails[courseId];
  }

  const catalogItem =
    fallbackCourseCatalog.find((c) => c.id === courseId) ?? fallbackCourseCatalog[0];

  return {
    id: catalogItem.id,
    title: catalogItem.title,
    description: catalogItem.description ?? 'Nội dung khóa học đang được cập nhật.',
    category: catalogItem.category,
    progress: catalogItem.progress,
    duration: catalogItem.duration,
    instructor: catalogItem.instructor,
    status: catalogItem.status,
    modules: [
      {
        id: `mod-${catalogItem.id}-1`,
        title: `${catalogItem.title} - Phần cơ bản`,
        dayRange: 'Ngày 1 - 3',
        quizId: `quiz-${catalogItem.id}-1`,
        lessons: [
          {
            id: `les-${catalogItem.id}-101`,
            title: 'Tổng quan bài học và mục tiêu đào tạo',
            duration: '35 phút',
            type: 'VIDEO',
            completed: false,
          },
          {
            id: `les-${catalogItem.id}-102`,
            title: 'Tài liệu hướng dẫn và thực hành quy chuẩn',
            duration: '45 phút',
            type: 'MARKDOWN',
            completed: false,
          },
        ],
      },
    ],
  };
}

const fallbackQuiz: QuizItem = {
  id: 'quiz-java-core-01',
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

export async function fetchQuiz(quizId: string): Promise<QuizItem | null> {
  try {
    const data = await apiClient<QuizItem>(`/api/v1/quizzes/${quizId}`, { method: 'GET' });
    if (data) return data;
  } catch {}

  return fallbackQuiz;
}

export async function submitQuizApi(
  quizId: string,
  answers: { questionId: string; selectedOption: string }[]
) {
  try {
    return await apiClient(`/api/v1/quizzes/${quizId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  } catch {}

  const quiz = await fetchQuiz(quizId);

  if (!quiz || !quiz.questions) {
    return { score: 0, isPassed: false, attemptNumber: 1, suggestedLessons: [] };
  }

  let correctCount = 0;

  for (const ans of answers) {
    const question = quiz.questions.find((item) => item.id === ans.questionId);
    if (question && question.correctAnswer === ans.selectedOption) {
      correctCount += 1;
    }
  }

  const scorePercentage = Math.round((correctCount / quiz.questions.length) * 100);
  const isPassed = scorePercentage >= quiz.passingScore;

  return {
    score: scorePercentage,
    isPassed,
    attemptNumber: 1,
    suggestedLessons: !isPassed
      ? [
          {
            lessonId: 'les-01',
            lessonTitle: 'Quy chuẩn NovaTech & Cấu hình Spring Boot Bean Container',
          },
          {
            lessonId: 'les-02',
            lessonTitle: 'Lập trình Hướng đối tượng OOP & Tối ưu Java Collections',
          },
        ]
      : [],
  };
}
