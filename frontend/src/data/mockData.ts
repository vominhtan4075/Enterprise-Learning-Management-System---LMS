import type { ActivityItem, CourseItem, DashboardStat, UserProfile } from '@/types';

export const mockUser: UserProfile = {
  id: 'USR-1001',
  name: 'Nguyễn Văn An',
  email: 'an.nguyen@novatech.com',
  role: 'employee',
  department: 'Phòng Nhân sự',
  avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
};

export const mockStats: DashboardStat[] = [
  { label: 'Khóa học đang học', value: '12', change: '+2 tuần này', positive: true },
  { label: 'Hoàn thành', value: '78%', change: '+7% so với tháng trước', positive: true },
  { label: 'Bài kiểm tra', value: '8', change: '2 cần làm lại', positive: false },
  { label: 'Điểm trung bình', value: '88.5', change: '+4.2 điểm', positive: true },
];

export const mockCourses: CourseItem[] = [
  {
    id: 'course-JAVA_CORE_01',
    title: 'Java Core & Spring Boot Fundamentals',
    category: 'Backend',
    progress: 72,
    duration: '30 ngày',
    instructor: 'Nguyễn Mạnh Hùng',
    status: 'active',
    description: 'Khóa học nền tảng Java và Spring Boot giúp Fresher Backend nắm vững lập trình OOP, REST API và quy chuẩn kỹ thuật nội bộ NovaTech.',
    lessonsCount: 12,
  },
  {
    id: 'course-DB_POSTGRES_02',
    title: 'PostgreSQL & Database Design',
    category: 'Database',
    progress: 48,
    duration: '12 ngày',
    instructor: 'Hà Thu Phương',
    status: 'active',
    description: 'Nắm vững mô hình dữ liệu, tối ưu truy vấn, khóa ngoại và quy trình backup/restore trên PostgreSQL.',
    lessonsCount: 10,
  },
  {
    id: 'course-API_REST_03',
    title: 'REST API Design & Security',
    category: 'API',
    progress: 100,
    duration: '8 ngày',
    instructor: 'Đặng Đức Minh',
    status: 'completed',
    description: 'Thiết kế API bền vững, đúng chuẩn RESTful, có auth, versioning và kiểm thử handoff cho frontend.',
    lessonsCount: 8,
  },
  {
    id: 'course-SEC_CICD_04',
    title: 'Security, CI/CD & Playwright',
    category: 'Infrastructure',
    progress: 15,
    duration: '16 giờ',
    instructor: 'Bùi Thị Phương Linh',
    status: 'upcoming',
    description: 'Tập trung vào bảo mật ứng dụng, pipeline CI/CD, kiểm thử E2E và triển khai tự động.',
    lessonsCount: 6,
  },
];

export const mockActivities: ActivityItem[] = [
  { id: 'A-1', title: 'Hoàn thành module “Safety Workshop”', time: '2 giờ trước', type: 'course' },
  { id: 'A-2', title: 'Bài kiểm tra “Leadership Quiz” sắp hết hạn', time: 'Hôm nay', type: 'assessment' },
  { id: 'A-3', title: 'Khóa học mới đã được thêm vào hệ thống', time: '1 ngày trước', type: 'system' },
  { id: 'A-4', title: 'Bạn được giao nhiệm vụ ôn tập nội dung mới', time: '2 ngày trước', type: 'course' },
];

export const mockCourseDetails: Record<string, { description: string; modules: Array<{ id: string; title: string; dayRange: string; quizId?: string; lessons: Array<{ id: string; title: string; duration: string; type: string; completed: boolean }> }> }> = {
  'course-JAVA_CORE_01': {
    description: 'Khóa học nền tảng Java và Spring Boot giúp Fresher Backend nắm vững lập trình OOP, REST API và quy chuẩn kỹ thuật nội bộ NovaTech.',
    modules: [
      {
        id: 'mod-01',
        title: 'Học phần 1: Quy chuẩn NovaTech & Java Core Nâng Cao',
        dayRange: 'Ngày 1 – 4',
        quizId: 'quiz-module-JAVA_CORE_01-1',
        lessons: [
          { id: 'les-101', title: 'Quy chuẩn code và naming convention', duration: '35 phút', type: 'MARKDOWN', completed: true },
          { id: 'les-102', title: 'OOP & Encapsulation trong Java', duration: '40 phút', type: 'VIDEO', completed: true },
          { id: 'les-103', title: 'Collections Framework & Stream API', duration: '45 phút', type: 'VIDEO', completed: true },
          { id: 'les-104', title: 'Exception Handling & Logging', duration: '30 phút', type: 'MARKDOWN', completed: true },
        ],
      },
      {
        id: 'mod-02',
        title: 'Học phần 2: Spring Boot REST API & Dependency Injection',
        dayRange: 'Ngày 5 – 8',
        quizId: 'quiz-module-JAVA_CORE_01-2',
        lessons: [
          { id: 'les-201', title: 'Thiết lập project Spring Boot', duration: '35 phút', type: 'VIDEO', completed: true },
          { id: 'les-202', title: 'Controller – Service – Repository pattern', duration: '50 phút', type: 'VIDEO', completed: true },
          { id: 'les-203', title: 'Validations & Exception Handling', duration: '40 phút', type: 'MARKDOWN', completed: false },
          { id: 'les-204', title: 'JWT & Security cơ bản', duration: '45 phút', type: 'VIDEO', completed: false },
        ],
      },
    ],
  },
  'course-DB_POSTGRES_02': {
    description: 'Nắm vững mô hình dữ liệu, tối ưu truy vấn, khóa ngoại và quy trình backup/restore trên PostgreSQL.',
    modules: [
      {
        id: 'mod-11',
        title: 'Học phần 1: Thiết kế schema cơ sở dữ liệu',
        dayRange: 'Ngày 1 – 3',
        lessons: [
          { id: 'les-301', title: 'Normal form & thực hành schema', duration: '30 phút', type: 'MARKDOWN', completed: true },
          { id: 'les-302', title: 'Index & Query performance', duration: '40 phút', type: 'VIDEO', completed: false },
        ],
      },
    ],
  },
  'course-API_REST_03': {
    description: 'Thiết kế API bền vững, đúng chuẩn RESTful, có auth, versioning và kiểm thử handoff cho frontend.',
    modules: [
      {
        id: 'mod-21',
        title: 'Học phần 1: REST API & Versioning',
        dayRange: 'Ngày 1 – 2',
        lessons: [
          { id: 'les-401', title: 'Resource design & endpoint chuẩn', duration: '35 phút', type: 'MARKDOWN', completed: true },
          { id: 'les-402', title: 'Error responses & pagination', duration: '30 phút', type: 'VIDEO', completed: true },
        ],
      },
    ],
  },
  'course-SEC_CICD_04': {
    description: 'Tập trung vào bảo mật ứng dụng, pipeline CI/CD, kiểm thử E2E và triển khai tự động.',
    modules: [
      {
        id: 'mod-31',
        title: 'Học phần 1: Security & Automation',
        dayRange: 'Ngày 1 – 2',
        quizId: 'quiz-module-SEC_CICD_04-2',
        lessons: [
          { id: 'les-501', title: 'JWT, RBAC và OAuth2 flow', duration: '45 phút', type: 'VIDEO', completed: false },
          { id: 'les-502', title: 'CI/CD với GitHub Actions', duration: '40 phút', type: 'MARKDOWN', completed: false },
        ],
      },
    ],
  },
};

export const mockCompetencySkills = [
  { skill: 'Java Core & Spring Boot', score: 87.5, status: 'Đạt chuẩn', level: 'Level 2 - Competent', category: 'Backend' },
  { skill: 'PostgreSQL & Database Design', score: 85.0, status: 'Đạt chuẩn', level: 'Level 2 - Competent', category: 'Database' },
  { skill: 'RESTful API Specification', score: 90.0, status: 'Đạt chuẩn', level: 'Level 3 - Proficient', category: 'API' },
  { skill: 'Docker Containerization', score: 75.0, status: 'Đạt chuẩn', level: 'Level 2 - Competent', category: 'DevOps' },
];
