import 'dotenv/config';
import {
  PrismaClient,
  RoleCode,
  PositionLevel,
  ContentType,
  QuizType,
  EnrollmentStatus,
  EnrollmentSource,
  NotificationType,
  HrmSyncStatus,
} from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu nội bộ                                                 */
/* ------------------------------------------------------------------ */

type Concept = [term: string, definition: string];

interface CourseDef {
  code: string;
  title: string;
  description: string;
  estimatedHours: number;
  skill: string;
  concepts: Concept[];
}

interface PathDef {
  id: string;
  title: string;
  description: string;
  level: PositionLevel;
  courses: CourseDef[];
}

interface QuestionConcept {
  term: string;
  definition: string;
  skill: string;
}

interface UserSeed {
  id: string;
  email: string;
  fullName: string;
  employeeCode: string;
  department: string;
  position: PositionLevel;
  role: RoleCode;
}

interface CourseMeta {
  courseId: string;
  skill: string;
  lessonIds: string[];
  quizIds: string[];
  firstQuizId: string;
}

/* ------------------------------------------------------------------ */
/* Dữ liệu nội dung đào tạo (5 lộ trình x 4 khóa học)                  */
/* ------------------------------------------------------------------ */

const PATHS: PathDef[] = [
  {
    id: 'path-intern',
    title: 'Lộ trình Đào tạo Thực tập sinh Kỹ thuật',
    description:
      'Trang bị nền tảng Git, Linux, lập trình căn bản và SQL cho thực tập sinh kỹ thuật mới gia nhập NovaTech.',
    level: PositionLevel.INTERN,
    courses: [
      {
        code: 'INTERN_GIT_01',
        title: 'Git & Quy trình làm việc nhóm',
        description: 'Làm quen Git, nhánh, merge và quy trình Pull Request tại NovaTech.',
        estimatedHours: 14,
        skill: 'Git',
        concepts: [
          ['Commit', 'Ảnh chụp trạng thái mã nguồn được lưu vào lịch sử kho Git'],
          ['Branch', 'Nhánh phát triển độc lập cho phép làm tính năng mà không ảnh hưởng nhánh chính'],
          ['Merge', 'Thao tác hợp nhất thay đổi từ nhánh này vào nhánh khác'],
          ['Pull Request', 'Yêu cầu đề xuất hợp nhất mã nguồn để đồng nghiệp xem xét'],
        ],
      },
      {
        code: 'INTERN_GIT_02',
        title: 'Linux, Terminal & Mạng cơ bản',
        description: 'Sử dụng dòng lệnh Linux, kết nối máy chủ từ xa và hiểu mạng căn bản.',
        estimatedHours: 16,
        skill: 'Linux',
        concepts: [
          ['chmod', 'Lệnh thay đổi quyền truy cập của tệp và thư mục'],
          ['grep', 'Lệnh tìm kiếm chuỗi ký tự khớp mẫu trong nội dung tệp'],
          ['SSH', 'Giao thức kết nối an toàn tới máy chủ từ xa có mã hóa'],
          ['DNS', 'Hệ thống phân giải tên miền thành địa chỉ IP'],
        ],
      },
      {
        code: 'INTERN_GIT_03',
        title: 'Lập trình căn bản & Tư duy thuật toán',
        description: 'Biến, vòng lặp, hàm và phân tích độ phức tạp thuật toán cơ bản.',
        estimatedHours: 14,
        skill: 'Programming Basics',
        concepts: [
          ['Biến', 'Vùng nhớ có tên dùng để lưu trữ giá trị trong chương trình'],
          ['Vòng lặp', 'Cấu trúc lặp lại khối lệnh cho đến khi điều kiện không còn đúng'],
          ['Hàm', 'Khối mã đặt tên có thể tái sử dụng với tham số đầu vào'],
          ['Big O', 'Ký hiệu mô tả độ phức tạp thuật toán theo kích thước đầu vào'],
        ],
      },
      {
        code: 'INTERN_GIT_04',
        title: 'SQL căn bản & Kiểm tra Tổng hợp Thực tập sinh',
        description: 'Truy vấn SQL căn bản và đánh giá tổng hợp cuối lộ trình thực tập sinh.',
        estimatedHours: 16,
        skill: 'SQL',
        concepts: [
          ['SELECT', 'Câu lệnh truy vấn dữ liệu từ bảng'],
          ['JOIN', 'Phép kết hợp các hàng của nhiều bảng dựa trên cột liên quan'],
          ['PRIMARY KEY', 'Ràng buộc định danh duy nhất mỗi hàng trong bảng'],
          ['INDEX', 'Cấu trúc giúp tăng tốc truy vấn trên cột được lập chỉ mục'],
        ],
      },
    ],
  },
  {
    id: 'path-fresher-java',
    title: 'Lộ trình Onboarding Fresher Backend Java (30 Ngày)',
    description:
      'Chương trình onboarding 30 ngày cho Fresher Backend Java: quy chuẩn NovaTech, Spring Boot, PostgreSQL, Microservices, bảo mật và CI/CD.',
    level: PositionLevel.FRESHER,
    courses: [
      {
        code: 'JAVA_CORE_01',
        title: 'Quy chuẩn NovaTech, Java Core & Spring Boot',
        description: 'Ngày 1–7: quy chuẩn lập trình NovaTech, Java Core, OOP và Spring Boot cơ bản.',
        estimatedHours: 14,
        skill: 'Java Core',
        concepts: [
          ['Polymorphism', 'Khả năng một đối tượng thể hiện nhiều hành vi khác nhau thông qua kế thừa hoặc interface'],
          ['Dependency Injection', 'Cơ chế container Spring cung cấp các phụ thuộc cho bean thay vì bean tự tạo'],
          ['HashMap', 'Cấu trúc dữ liệu lưu cặp khóa–giá trị với truy xuất trung bình O(1)'],
          ['@RestController', 'Annotation đánh dấu lớp xử lý request HTTP và trả dữ liệu trực tiếp dạng JSON'],
        ],
      },
      {
        code: 'PG_API_02',
        title: 'CSDL PostgreSQL & Thiết kế RESTful API',
        description: 'Ngày 8–15: thiết kế lược đồ PostgreSQL, giao dịch và chuẩn RESTful API.',
        estimatedHours: 16,
        skill: 'PostgreSQL & REST',
        concepts: [
          ['Transaction', 'Nhóm thao tác CSDL được thực thi theo nguyên tắc ACID, thành công toàn bộ hoặc hoàn tác'],
          ['Foreign Key', 'Ràng buộc liên kết cột với khóa chính của bảng khác để đảm bảo toàn vẹn tham chiếu'],
          ['HTTP 404', 'Mã trạng thái cho biết tài nguyên được yêu cầu không tồn tại'],
          ['Idempotent', 'Tính chất gọi một request nhiều lần cho kết quả giống một lần, như PUT và DELETE'],
        ],
      },
      {
        code: 'MICRO_DOCKER_03',
        title: 'Microservices, Redis Caching & Docker',
        description: 'Ngày 16–22: kiến trúc microservices, bộ đệm Redis và đóng gói bằng Docker.',
        estimatedHours: 14,
        skill: 'Microservices & Docker',
        concepts: [
          ['Microservice', 'Kiến trúc chia ứng dụng thành các dịch vụ nhỏ độc lập triển khai và mở rộng riêng'],
          ['Redis', 'Kho dữ liệu key–value trong bộ nhớ thường dùng làm bộ đệm cache'],
          ['Dockerfile', 'Tệp văn bản mô tả các bước xây dựng một image container'],
          ['TTL', 'Thời gian sống của khóa cache trước khi tự động hết hạn'],
        ],
      },
      {
        code: 'SEC_CICD_04',
        title: 'Bảo mật, CI/CD, Playwright & Kiểm tra Tổng hợp',
        description: 'Ngày 23–30: bảo mật ứng dụng, pipeline CI/CD, kiểm thử E2E với Playwright và đánh giá tổng hợp.',
        estimatedHours: 16,
        skill: 'Security & CI/CD',
        concepts: [
          ['JWT', 'Token tự chứa thông tin đã ký dùng để xác thực không trạng thái'],
          ['CI/CD', 'Quy trình tự động build, kiểm thử và triển khai mã nguồn liên tục'],
          ['SQL Injection', 'Tấn công chèn mã SQL độc hại qua dữ liệu đầu vào chưa được kiểm soát'],
          ['Playwright', 'Công cụ kiểm thử end-to-end tự động hóa trình duyệt'],
        ],
      },
    ],
  },
  {
    id: 'path-junior',
    title: 'Lộ trình Phát triển Năng lực Junior Engineer',
    description:
      'Nâng cao chất lượng mã nguồn, kiểm thử, design pattern và khả năng quan sát hệ thống cho Junior Engineer.',
    level: PositionLevel.JUNIOR,
    courses: [
      {
        code: 'JUNIOR_CLEAN_01',
        title: 'Clean Code & Nguyên lý SOLID',
        description: 'Viết mã sạch, dễ bảo trì và áp dụng nguyên lý SOLID.',
        estimatedHours: 14,
        skill: 'Clean Code',
        concepts: [
          ['SRP', 'Nguyên tắc mỗi lớp chỉ nên có một lý do duy nhất để thay đổi'],
          ['Refactoring', 'Cải thiện cấu trúc mã nguồn mà không thay đổi hành vi bên ngoài'],
          ['DRY', 'Nguyên tắc tránh lặp lại logic bằng cách tái sử dụng'],
          ['Code smell', 'Dấu hiệu trong mã nguồn gợi ý vấn đề thiết kế tiềm ẩn'],
        ],
      },
      {
        code: 'JUNIOR_CLEAN_02',
        title: 'Unit Test & TDD',
        description: 'Viết unit test hiệu quả và thực hành phát triển hướng kiểm thử.',
        estimatedHours: 16,
        skill: 'Testing',
        concepts: [
          ['TDD', 'Phương pháp viết test thất bại trước rồi mới viết mã để test đạt'],
          ['Mock', 'Đối tượng giả lập thay thế phụ thuộc thật trong unit test'],
          ['Code coverage', 'Tỷ lệ mã nguồn được thực thi bởi các test'],
          ['Assertion', 'Lệnh kiểm tra kết quả thực tế khớp kết quả kỳ vọng'],
        ],
      },
      {
        code: 'JUNIOR_CLEAN_03',
        title: 'Design Pattern & Tối ưu truy vấn',
        description: 'Các mẫu thiết kế phổ biến và kỹ thuật tối ưu truy vấn cơ sở dữ liệu.',
        estimatedHours: 14,
        skill: 'Design Pattern',
        concepts: [
          ['Singleton', 'Mẫu thiết kế đảm bảo lớp chỉ có một thể hiện duy nhất'],
          ['Factory', 'Mẫu thiết kế đóng gói việc tạo đối tượng vào một lớp hoặc phương thức riêng'],
          ['N+1 query', 'Vấn đề truy vấn lặp lại cho từng bản ghi con thay vì tải gộp'],
          ['EXPLAIN', 'Lệnh hiển thị kế hoạch thực thi của câu truy vấn'],
        ],
      },
      {
        code: 'JUNIOR_CLEAN_04',
        title: 'Quan sát hệ thống & Kiểm tra Tổng hợp Junior',
        description: 'Logging, metrics, tracing và đánh giá tổng hợp cuối lộ trình Junior.',
        estimatedHours: 16,
        skill: 'Observability',
        concepts: [
          ['Log level', 'Mức độ nghiêm trọng của thông điệp nhật ký như INFO, WARN, ERROR'],
          ['Metric', 'Số liệu đo lường định lượng hiệu năng hệ thống theo thời gian'],
          ['Trace', 'Dấu vết theo dõi một yêu cầu đi qua nhiều dịch vụ'],
          ['Health check', 'Điểm cuối kiểm tra dịch vụ còn hoạt động bình thường'],
        ],
      },
    ],
  },
  {
    id: 'path-senior',
    title: 'Lộ trình Kiến trúc Hệ thống & Senior Software Engineer',
    description:
      'Kiến trúc phần mềm, hệ thống phân tán, hạ tầng đám mây, hiệu năng và bảo mật nâng cao cho Senior Engineer.',
    level: PositionLevel.SENIOR,
    courses: [
      {
        code: 'SENIOR_ARCH_01',
        title: 'Kiến trúc phần mềm & Domain-Driven Design',
        description: 'Thiết kế kiến trúc theo miền nghiệp vụ với DDD, Hexagonal và CQRS.',
        estimatedHours: 14,
        skill: 'Architecture',
        concepts: [
          ['Bounded Context', 'Ranh giới trong đó một mô hình miền có ý nghĩa nhất quán'],
          ['Hexagonal Architecture', 'Kiến trúc tách lõi nghiệp vụ khỏi hạ tầng thông qua port và adapter'],
          ['Aggregate', 'Cụm đối tượng miền được xử lý như một đơn vị nhất quán'],
          ['CQRS', 'Mẫu tách mô hình ghi và mô hình đọc dữ liệu'],
        ],
      },
      {
        code: 'SENIOR_ARCH_02',
        title: 'Hệ thống phân tán & Message Queue',
        description: 'Nguyên lý hệ phân tán, Saga, Kafka và nhất quán dữ liệu.',
        estimatedHours: 16,
        skill: 'Distributed Systems',
        concepts: [
          ['CAP theorem', 'Định lý nêu hệ phân tán không thể đồng thời đảm bảo cả nhất quán, sẵn sàng và chịu phân vùng'],
          ['Saga', 'Mẫu quản lý giao dịch phân tán bằng chuỗi giao dịch cục bộ kèm bù trừ'],
          ['Kafka', 'Nền tảng truyền sự kiện phân tán theo mô hình log phân vùng'],
          ['Eventual consistency', 'Mô hình dữ liệu các bản sao sẽ hội tụ nhất quán sau một khoảng thời gian'],
        ],
      },
      {
        code: 'SENIOR_ARCH_03',
        title: 'Kubernetes & Hạ tầng đám mây',
        description: 'Triển khai, mở rộng và quản lý hạ tầng bằng Kubernetes và Terraform.',
        estimatedHours: 14,
        skill: 'Cloud & Kubernetes',
        concepts: [
          ['Pod', 'Đơn vị triển khai nhỏ nhất trong Kubernetes chứa một hay nhiều container'],
          ['Terraform', 'Công cụ định nghĩa hạ tầng bằng mã theo cách khai báo'],
          ['Auto scaling', 'Cơ chế tự động tăng giảm tài nguyên theo tải'],
          ['Load balancer', 'Thành phần phân phối lưu lượng đến nhiều phiên bản dịch vụ'],
        ],
      },
      {
        code: 'SENIOR_ARCH_04',
        title: 'Hiệu năng, Bảo mật nâng cao & Kiểm tra Tổng hợp Senior',
        description: 'Tối ưu hiệu năng, bảo mật nâng cao và đánh giá tổng hợp cuối lộ trình Senior.',
        estimatedHours: 16,
        skill: 'Performance & Security',
        concepts: [
          ['Circuit breaker', 'Mẫu ngắt tạm thời lời gọi tới dịch vụ lỗi để tránh lỗi lan truyền'],
          ['OWASP Top 10', 'Danh sách các rủi ro bảo mật ứng dụng web phổ biến nhất'],
          ['Rate limiting', 'Giới hạn số request mà client được gửi trong một khoảng thời gian'],
          ['Profiling', 'Phân tích mức sử dụng CPU và bộ nhớ để tìm điểm nghẽn'],
        ],
      },
    ],
  },
  {
    id: 'path-lead',
    title: 'Lộ trình Kỹ năng Lãnh đạo Kỹ thuật (Tech Lead)',
    description:
      'Phát triển kỹ năng lãnh đạo, quản lý Agile, quản trị nợ kỹ thuật và chiến lược kỹ thuật cho Tech Lead.',
    level: PositionLevel.LEAD,
    courses: [
      {
        code: 'LEAD_MGMT_01',
        title: 'Lãnh đạo kỹ thuật & Quản lý đội nhóm',
        description: 'Phong cách lãnh đạo, giao việc và xây dựng môi trường an toàn tâm lý.',
        estimatedHours: 14,
        skill: 'Leadership',
        concepts: [
          ['One-on-one', 'Cuộc trao đổi định kỳ giữa quản lý và thành viên về phát triển và vướng mắc'],
          ['Delegation', 'Giao quyền thực hiện công việc kèm trách nhiệm rõ ràng cho thành viên'],
          ['Servant leadership', 'Phong cách lãnh đạo đặt việc hỗ trợ đội nhóm lên hàng đầu'],
          ['Psychological safety', 'Môi trường nơi mọi người dám nêu ý kiến và nhận lỗi mà không sợ bị trừng phạt'],
        ],
      },
      {
        code: 'LEAD_MGMT_02',
        title: 'Quản lý dự án Agile & Ước lượng',
        description: 'Điều phối sprint, ước lượng công việc và cải tiến quy trình liên tục.',
        estimatedHours: 16,
        skill: 'Agile',
        concepts: [
          ['Sprint', 'Chu kỳ phát triển có thời lượng cố định tạo ra phần tăng trưởng sản phẩm'],
          ['Velocity', 'Lượng công việc đội hoàn thành trung bình trong mỗi sprint'],
          ['Backlog refinement', 'Hoạt động làm rõ và ước lượng các hạng mục chờ thực hiện'],
          ['Retrospective', 'Buổi họp cuối sprint để rút kinh nghiệm và cải tiến quy trình'],
        ],
      },
      {
        code: 'LEAD_MGMT_03',
        title: 'Quản lý nợ kỹ thuật & Chất lượng',
        description: 'Quản trị nợ kỹ thuật, ghi nhận quyết định kiến trúc và vận hành theo SLO.',
        estimatedHours: 14,
        skill: 'Technical Debt',
        concepts: [
          ['Technical debt', 'Chi phí bảo trì tương lai phát sinh do chọn giải pháp nhanh thay vì tối ưu'],
          ['ADR', 'Tài liệu ghi lại quyết định kiến trúc cùng bối cảnh và lý do'],
          ['SLO', 'Mục tiêu chất lượng dịch vụ có thể đo lường như độ sẵn sàng 99,9%'],
          ['Postmortem', 'Báo cáo phân tích sự cố theo hướng học hỏi không đổ lỗi cá nhân'],
        ],
      },
      {
        code: 'LEAD_MGMT_04',
        title: 'Chiến lược kỹ thuật & Kiểm tra Tổng hợp Tech Lead',
        description: 'Hoạch định chiến lược kỹ thuật, OKR, roadmap và đánh giá tổng hợp cuối lộ trình Tech Lead.',
        estimatedHours: 16,
        skill: 'Technical Strategy',
        concepts: [
          ['OKR', 'Khung đặt mục tiêu gắn với các kết quả then chốt đo lường được'],
          ['Roadmap', 'Kế hoạch định hướng các hạng mục kỹ thuật theo thời gian'],
          ['Build vs Buy', 'Quyết định tự xây dựng hay mua giải pháp có sẵn'],
          ['Mentoring', 'Hoạt động kèm cặp phát triển năng lực cho thành viên'],
        ],
      },
    ],
  },
];

const COURSE_DAY_RANGES: Array<[number, number]> = [
  [1, 7],
  [8, 15],
  [16, 22],
  [23, 30],
];

const LESSON_TYPES: ContentType[] = [ContentType.VIDEO, ContentType.PDF, ContentType.MARKDOWN];

const LEVEL_TO_PATH: Record<PositionLevel, string> = {
  [PositionLevel.INTERN]: 'path-intern',
  [PositionLevel.FRESHER]: 'path-fresher-java',
  [PositionLevel.JUNIOR]: 'path-junior',
  [PositionLevel.SENIOR]: 'path-senior',
  [PositionLevel.LEAD]: 'path-lead',
};

/* ------------------------------------------------------------------ */
/* Dữ liệu người dùng                                                  */
/* ------------------------------------------------------------------ */

const DEPARTMENTS = [
  'Backend Development',
  'Frontend & Mobile',
  'DevOps & Cloud',
  'QA & Testing',
  'Data & AI',
];

const LEVELS: PositionLevel[] = [
  PositionLevel.INTERN,
  PositionLevel.FRESHER,
  PositionLevel.JUNIOR,
  PositionLevel.SENIOR,
  PositionLevel.LEAD,
];

const FAMILY_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ'];
const MALE_MIDDLE = ['Văn', 'Minh', 'Quốc', 'Đức', 'Hoàng', 'Gia'];
const MALE_GIVEN = ['Hùng', 'Dũng', 'Nam', 'Khánh', 'Long', 'Phúc', 'Thành', 'Tuấn', 'Việt', 'Bảo', 'Huy', 'Khoa', 'Đạt', 'Hiếu'];
const FEMALE_MIDDLE = ['Thị', 'Ngọc', 'Thu', 'Phương', 'Thanh', 'Khánh'];
const FEMALE_GIVEN = ['Lan', 'Hương', 'Linh', 'Mai', 'Trang', 'Thảo', 'Hà', 'Ngân', 'Vy', 'Anh', 'Chi', 'Yến', 'Nhung', 'Quỳnh'];

function removeAccents(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function generateVietnameseName(index: number): { fullName: string; given: string; family: string } {
  const family = FAMILY_NAMES[index % FAMILY_NAMES.length];
  const isMale = index % 2 === 0;
  const middlePool = isMale ? MALE_MIDDLE : FEMALE_MIDDLE;
  const givenPool = isMale ? MALE_GIVEN : FEMALE_GIVEN;
  const middle = middlePool[Math.floor(index / 2) % middlePool.length];
  const given = givenPool[(index * 5 + 3) % givenPool.length];
  return { fullName: `${family} ${middle} ${given}`, given, family };
}

function pad(value: number, size: number): string {
  return String(value).padStart(size, '0');
}

function buildUsers(): UserSeed[] {
  const users: UserSeed[] = [];

  users.push({
    id: 'user-admin001',
    email: 'admin@novatech.com',
    fullName: 'Trần Quốc Quản Trị',
    employeeCode: 'ADMIN001',
    department: 'IT Administration',
    position: PositionLevel.LEAD,
    role: RoleCode.ADMIN,
  });

  const hrNames = ['Lê Thị Thu Hà', 'Phạm Thị Ngọc Anh', 'Nguyễn Thị Thanh Mai'];
  hrNames.forEach((fullName, i) => {
    const code = `HR${pad(i + 1, 3)}`;
    users.push({
      id: `user-${code.toLowerCase()}`,
      email: i === 0 ? 'hr@novatech.com' : `hr${i + 1}@novatech.com`,
      fullName,
      employeeCode: code,
      department: 'Human Resources',
      position: i === 0 ? PositionLevel.SENIOR : PositionLevel.JUNIOR,
      role: RoleCode.HR,
    });
  });

  const trainerNames = [
    'Vũ Đức Minh',
    'Đặng Văn Hải',
    'Bùi Thị Phương Linh',
    'Hoàng Gia Bảo',
    'Võ Thị Khánh Vy',
    'Đỗ Quốc Việt',
  ];
  trainerNames.forEach((fullName, i) => {
    const code = `TR${pad(i + 1, 3)}`;
    users.push({
      id: `user-${code.toLowerCase()}`,
      email: i === 0 ? 'trainer@novatech.com' : `trainer${i + 1}@novatech.com`,
      fullName,
      employeeCode: code,
      department: 'Training & Development',
      position: i === 0 ? PositionLevel.SENIOR : i % 2 === 0 ? PositionLevel.LEAD : PositionLevel.SENIOR,
      role: RoleCode.TRAINER,
    });
  });

  users.push({
    id: 'user-nv001',
    email: 'fresher.java@novatech.com',
    fullName: 'Lê Minh Khoa',
    employeeCode: 'NV001',
    department: 'Backend Development',
    position: PositionLevel.FRESHER,
    role: RoleCode.EMPLOYEE,
  });

  users.push({
    id: 'user-nv002',
    email: 'huan.nguyen@novatech.com',
    fullName: 'Nguyễn Văn Huân',
    employeeCode: 'NV002',
    department: 'Backend Development',
    position: PositionLevel.JUNIOR,
    role: RoleCode.EMPLOYEE,
  });

  for (let n = 3; n <= 90; n += 1) {
    const autoIndex = n - 3;
    const code = `NV${pad(n, 3)}`;
    const name = generateVietnameseName(autoIndex);
    const level = LEVELS[autoIndex % LEVELS.length];
    const department = DEPARTMENTS[Math.floor(autoIndex / LEVELS.length) % DEPARTMENTS.length];
    users.push({
      id: `user-${code.toLowerCase()}`,
      email: `${removeAccents(name.given)}.${removeAccents(name.family)}${n}@novatech.com`,
      fullName: name.fullName,
      employeeCode: code,
      department,
      position: level,
      role: RoleCode.EMPLOYEE,
    });
  }

  return users;
}

/* ------------------------------------------------------------------ */
/* Sinh câu hỏi trắc nghiệm                                            */
/* ------------------------------------------------------------------ */

interface QuestionSeed {
  id: string;
  quizId: string;
  content: string;
  options: Array<{ key: string; text: string }>;
  correctAnswer: string;
  explanation: string;
  skillName: string;
  relatedLessonId: string;
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

function arrangeOptions(correct: string, distractors: string[], position: number): {
  options: Array<{ key: string; text: string }>;
  correctAnswer: string;
} {
  const texts = [...distractors];
  texts.splice(position, 0, correct);
  return {
    options: texts.map((text, i) => ({ key: OPTION_KEYS[i], text })),
    correctAnswer: OPTION_KEYS[position],
  };
}

function buildQuestions(quizId: string, concepts: QuestionConcept[], lessonIds: string[]): QuestionSeed[] {
  const questions: QuestionSeed[] = [];
  const positions = [0, 3, 2, 1, 1, 0, 3, 2];

  concepts.forEach((concept, j) => {
    const others = concepts.filter((_, k) => k !== j);
    const relatedLessonId = lessonIds[j % lessonIds.length];
    const explanation = `${concept.term}: ${concept.definition}.`;

    const indexA = j * 2;
    const arrangedA = arrangeOptions(
      concept.definition,
      others.map((o) => o.definition),
      positions[indexA],
    );
    questions.push({
      id: `${quizId}-q${indexA + 1}`,
      quizId,
      content: `Phát biểu nào sau đây mô tả đúng nhất về "${concept.term}"?`,
      options: arrangedA.options,
      correctAnswer: arrangedA.correctAnswer,
      explanation,
      skillName: concept.skill,
      relatedLessonId,
    });

    const indexB = j * 2 + 1;
    const arrangedB = arrangeOptions(
      concept.term,
      others.map((o) => o.term),
      positions[indexB],
    );
    questions.push({
      id: `${quizId}-q${indexB + 1}`,
      quizId,
      content: `Khái niệm hoặc công cụ nào phù hợp với mô tả sau: "${concept.definition}"?`,
      options: arrangedB.options,
      correctAnswer: arrangedB.correctAnswer,
      explanation,
      skillName: concept.skill,
      relatedLessonId,
    });
  });

  return questions;
}

/* ------------------------------------------------------------------ */
/* Hàm chính                                                           */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  console.log('🌱 Bắt đầu seed dữ liệu NovaTech Corporate LMS...');
  const startedAt = Date.now();

  /* ---------- 1. Xóa sạch dữ liệu theo thứ tự khóa ngoại (idempotent) ---------- */
  console.log('🧹 Xóa dữ liệu cũ...');
  await prisma.$transaction([
    prisma.hrmSyncLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.competencyMatrix.deleteMany(),
    prisma.quizAttempt.deleteMany(),
    prisma.userProgress.deleteMany(),
    prisma.courseEnrollment.deleteMany(),
    prisma.pathEnrollment.deleteMany(),
    prisma.question.deleteMany(),
    prisma.quiz.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.file.deleteMany(),
    prisma.module.deleteMany(),
    prisma.pathCourse.deleteMany(),
    prisma.course.deleteMany(),
    prisma.learningPath.deleteMany(),
    prisma.user.deleteMany(),
    prisma.role.deleteMany(),
  ]);

  /* ---------- 2. Roles ---------- */
  console.log('🔐 Tạo roles...');
  const roleDefs: Array<{ id: number; code: RoleCode }> = [
    { id: 1, code: RoleCode.EMPLOYEE },
    { id: 2, code: RoleCode.TRAINER },
    { id: 3, code: RoleCode.HR },
    { id: 4, code: RoleCode.ADMIN },
  ];
  const roleIdByCode = new Map<RoleCode, number>();
  roleDefs.forEach((role) => roleIdByCode.set(role.code, role.id));
  await prisma.role.createMany({
    data: roleDefs,
  });

  /* ---------- 3. Users ---------- */
  console.log('👥 Tạo 100 users (hash mật khẩu 1 lần)...');
  const hashedPassword = await bcrypt.hash(process.env.SEED_DEMO_PASSWORD || 'Password123!', 10);
  const users = buildUsers();
  await prisma.user.createMany({
    data: users.map((user) => ({
      id: user.id,
      email: user.email,
      password: hashedPassword,
      fullName: user.fullName,
      employeeCode: user.employeeCode,
      department: user.department,
      position: user.position,
      roleId: roleIdByCode.get(user.role)!,
      isActive: true,
      mustChangePassword: false,
    })),
  });
  const userByCode = new Map(users.map((u) => [u.employeeCode, u]));
  const employees = users.filter((u) => u.role === RoleCode.EMPLOYEE);
  const hrUser = userByCode.get('HR001')!;
  const trainerUser = userByCode.get('TR001')!;

  /* ---------- 4. Learning paths, courses, modules, lessons, quizzes, questions ---------- */
  console.log('📚 Tạo lộ trình, khóa học, học phần, bài học, bài kiểm tra, câu hỏi...');

  const pathRows: Array<Record<string, unknown>> = [];
  const courseRows: Array<Record<string, unknown>> = [];
  const pathCourseRows: Array<Record<string, unknown>> = [];
  const moduleRows: Array<Record<string, unknown>> = [];
  const lessonRows: Array<Record<string, unknown>> = [];
  const quizRows: Array<Record<string, unknown>> = [];
  const questionRows: QuestionSeed[] = [];

  const courseMetaByCode = new Map<string, CourseMeta>();
  const courseCodesByPath = new Map<string, string[]>();

  for (const path of PATHS) {
    pathRows.push({
      id: path.id,
      code: path.id,
      title: path.title,
      description: path.description,
      targetPosition: path.level,
      isMandatory: true,
      estimatedDays: 30,
    });
    courseCodesByPath.set(path.id, path.courses.map((c) => c.code));

    const quizSourceConcepts: QuestionConcept[] = [];

    path.courses.forEach((course, courseIndex) => {
      const courseId = `course-${course.code}`;
      const isLastCourse = courseIndex === path.courses.length - 1;
      const [courseDayStart, courseDayEnd] = COURSE_DAY_RANGES[courseIndex];

      courseRows.push({
        id: courseId,
        code: course.code,
        title: course.title,
        description: course.description,
        createdById: trainerUser.id,
        estimatedHours: course.estimatedHours,
        isPublished: true,
      });

      pathCourseRows.push({
        pathId: path.id,
        courseId,
        stepOrder: courseIndex + 1,
      });

      const meta: CourseMeta = {
        courseId,
        skill: course.skill,
        lessonIds: [],
        quizIds: [],
        firstQuizId: '',
      };

      const moduleDefs: Array<{
        order: number;
        title: string;
        dayStart: number;
        dayEnd: number;
        quizType: QuizType;
        quizTitle: string;
        timeLimitMin: number;
        concepts: QuestionConcept[];
      }> = [];

      const courseConcepts: QuestionConcept[] = course.concepts.map(([term, definition]) => ({
        term,
        definition,
        skill: course.skill,
      }));
      quizSourceConcepts.push(courseConcepts[0]);

      moduleDefs.push({
        order: 1,
        title: isLastCourse ? `Học phần 4: ${course.title}` : course.title,
        dayStart: courseDayStart,
        dayEnd: isLastCourse ? 27 : courseDayEnd,
        quizType: QuizType.MODULE,
        quizTitle: `Bài kiểm tra Học phần ${courseIndex + 1}: ${course.title}`,
        timeLimitMin: 30,
        concepts: courseConcepts,
      });

      if (isLastCourse) {
        const finalConcepts: QuestionConcept[] = path.courses.map((c, idx) => {
          const [term, definition] = c.concepts[idx];
          return { term, definition, skill: c.skill };
        });
        moduleDefs.push({
          order: 2,
          title: 'Đánh giá Tổng hợp Cuối Lộ Trình',
          dayStart: 28,
          dayEnd: 30,
          quizType: QuizType.FINAL,
          quizTitle: `Bài kiểm tra Tổng hợp: ${path.title}`,
          timeLimitMin: 60,
          concepts: finalConcepts,
        });
      }

      for (const mod of moduleDefs) {
        const moduleId = `module-${course.code}-${mod.order}`;
        moduleRows.push({
          id: moduleId,
          courseId,
          title: mod.title,
          description:
            mod.quizType === QuizType.FINAL
              ? `Ôn tập và đánh giá toàn bộ kiến thức của ${path.title}.`
              : `Nội dung học phần: ${mod.title}.`,
          moduleOrder: mod.order,
          dayStart: mod.dayStart,
          dayEnd: mod.dayEnd,
        });

        const lessonTitles =
          mod.quizType === QuizType.FINAL
            ? [
              'Ôn tập tổng hợp kiến thức toàn lộ trình',
              'Case study tổng hợp từ thực tế dự án',
              'Hướng dẫn làm bài đánh giá cuối lộ trình',
            ]
            : [
              `${mod.title} – Phần 1: Khái niệm cốt lõi`,
              `${mod.title} – Phần 2: Thực hành có hướng dẫn`,
              `${mod.title} – Phần 3: Tình huống và best practice`,
            ];

        const moduleLessonIds: string[] = [];
        lessonTitles.forEach((lessonTitle, lessonIndex) => {
          const lessonOrder = lessonIndex + 1;
          const lessonId = `lesson-${moduleId}-${lessonOrder}`;
          const contentType = LESSON_TYPES[lessonIndex % LESSON_TYPES.length];
          const slug = `${course.code.toLowerCase()}-m${mod.order}-l${lessonOrder}`;
          const contentUrl =
            contentType === ContentType.VIDEO
              ? `https://learn.novatech.com/videos/${slug}.mp4`
              : contentType === ContentType.PDF
                ? `https://learn.novatech.com/docs/${slug}.pdf`
                : `https://learn.novatech.com/docs/${slug}.md`;
          const durationMinutes = 30 + ((lessonRows.length * 7) % 4) * 10;

          lessonRows.push({
            id: lessonId,
            moduleId,
            title: lessonTitle,
            contentType,
            contentUrl,
            durationMinutes,
            lessonOrder,
            isRequired: true,
          });
          moduleLessonIds.push(lessonId);
          meta.lessonIds.push(lessonId);
        });

        const quizId = `quiz-${moduleId}`;
        quizRows.push({
          id: quizId,
          moduleId,
          title: mod.quizTitle,
          quizType: mod.quizType,
          passingScore: 70,
          timeLimitMin: mod.timeLimitMin,
          maxAttempts: 3,
          isPublished: true,
        });
        meta.quizIds.push(quizId);
        if (mod.order === 1) {
          meta.firstQuizId = quizId;
        }

        questionRows.push(...buildQuestions(quizId, mod.concepts, moduleLessonIds));
      }

      courseMetaByCode.set(course.code, meta);
    });
  }

  await prisma.learningPath.createMany({ data: pathRows as never });
  await prisma.course.createMany({ data: courseRows as never });
  await prisma.pathCourse.createMany({ data: pathCourseRows as never });
  await prisma.module.createMany({ data: moduleRows as never });
  await prisma.lesson.createMany({ data: lessonRows as never });
  await prisma.quiz.createMany({ data: quizRows as never });
  await prisma.question.createMany({
    data: questionRows.map((q) => ({
      id: q.id,
      quizId: q.quizId,
      questionText: q.content,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      skillName: q.skillName,
      relatedLessonId: q.relatedLessonId,
    })) as never,
  });

  /* ---------- 5. Enrollment, tiến độ, kết quả quiz, năng lực, thông báo ---------- */
  console.log('📝 Tạo dữ liệu giao bài, tiến độ, điểm số, năng lực, thông báo...');

  const now = new Date();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const STATUS_CYCLE: EnrollmentStatus[] = [
    EnrollmentStatus.IN_PROGRESS,
    EnrollmentStatus.COMPLETED,
    EnrollmentStatus.OVERDUE,
    EnrollmentStatus.IN_PROGRESS,
  ];
  const ENROLLED_COUNT = 40;
  const enrolledEmployees = employees.slice(0, ENROLLED_COUNT);

  const pathEnrollmentRows: Array<Record<string, unknown>> = [];
  const courseEnrollmentRows: Array<Record<string, unknown>> = [];
  const progressRows: Array<Record<string, unknown>> = [];
  const attemptRows: Array<Record<string, unknown>> = [];
  const competencyRows: Array<Record<string, unknown>> = [];
  const notificationRows: Array<Record<string, unknown>> = [];

  enrolledEmployees.forEach((employee, i) => {
    const pathId = LEVEL_TO_PATH[employee.position];
    const courseCodes = courseCodesByPath.get(pathId)!;
    const pathDef = PATHS.find((p) => p.id === pathId)!;

    let status: EnrollmentStatus;
    let completedCourses: number;
    if (employee.employeeCode === 'NV001') {
      status = EnrollmentStatus.IN_PROGRESS;
      completedCourses = 1;
    } else if (employee.employeeCode === 'NV002') {
      status = EnrollmentStatus.IN_PROGRESS;
      completedCourses = 2;
    } else {
      status = STATUS_CYCLE[i % STATUS_CYCLE.length];
      if (status === EnrollmentStatus.COMPLETED) {
        completedCourses = 4;
      } else if (status === EnrollmentStatus.OVERDUE) {
        completedCourses = 1;
      } else {
        completedCourses = 1 + (i % 2);
      }
    }

    const assignedAt = new Date(now.getTime() - (20 + (i % 10)) * DAY_MS);
    const dueDate =
      status === EnrollmentStatus.OVERDUE
        ? new Date(now.getTime() - 5 * DAY_MS)
        : new Date(assignedAt.getTime() + 45 * DAY_MS);
    const pathProgress =
      status === EnrollmentStatus.COMPLETED ? 100 : Math.min(99, completedCourses * 25 + 10);

    pathEnrollmentRows.push({
      id: `pe-${employee.employeeCode.toLowerCase()}-${pathId}`,
      userId: employee.id,
      pathId,
      status,
      source: employee.employeeCode === 'NV001' ? EnrollmentSource.AUTO_ONBOARDING : EnrollmentSource.MANUAL,
      progressPercentage: pathProgress,
      assignedById: hrUser.id,
      deadline: dueDate,
      completedAt: status === EnrollmentStatus.COMPLETED ? new Date(now.getTime() - 2 * DAY_MS) : null,
    });

    const competencyScoreByCourse = new Map<string, number>();
    const coursesToEnroll = Math.min(completedCourses + 1, courseCodes.length);

    for (let ci = 0; ci < coursesToEnroll; ci += 1) {
      const code = courseCodes[ci];
      const meta = courseMetaByCode.get(code)!;
      const isCompletedCourse = ci < completedCourses;

      courseEnrollmentRows.push({
        id: `ce-${employee.employeeCode.toLowerCase()}-${code}`,
        userId: employee.id,
        courseId: meta.courseId,
        status: isCompletedCourse
          ? EnrollmentStatus.COMPLETED
          : status === EnrollmentStatus.OVERDUE
            ? EnrollmentStatus.OVERDUE
            : EnrollmentStatus.IN_PROGRESS,
        deadline: dueDate,
        assignedById: hrUser.id,
        source: EnrollmentSource.MANUAL,
        progressPercentage: isCompletedCourse ? 100 : 40,
        completedAt: isCompletedCourse ? new Date(now.getTime() - (10 - ci) * DAY_MS) : null,
      });

      if (!isCompletedCourse) {
        continue;
      }

      meta.lessonIds.forEach((lessonId, li) => {
        progressRows.push({
          id: `up-${employee.employeeCode.toLowerCase()}-${lessonId}`,
          userId: employee.id,
          lessonId,
          isCompleted: true,
          completedAt: new Date(now.getTime() - (12 - ci) * DAY_MS + li * 3600 * 1000),
        });
      });

      meta.quizIds.forEach((quizId, qi) => {
        const score =
          employee.employeeCode === 'NV001' && ci === 0
            ? 87.5
            : 70 + ((i * 7 + ci * 5 + qi * 3) % 30);
        attemptRows.push({
          id: `qa-${employee.employeeCode.toLowerCase()}-${quizId}`,
          userId: employee.id,
          quizId,
          attemptNumber: 1,
          score,
          isPassed: true,
          submittedAt: new Date(now.getTime() - (9 - ci) * DAY_MS),
        });
        if (qi === 0) {
          competencyScoreByCourse.set(code, score);
        }
      });
    }

    pathDef.courses.forEach((course, ci) => {
      competencyRows.push({
        id: `cm-${employee.employeeCode.toLowerCase()}-${ci + 1}`,
        userId: employee.id,
        skillName: course.skill,
        proficiencyScore: competencyScoreByCourse.get(course.code) ?? 35 + (i % 3) * 5,
      });
    });
    competencyRows.push({
      id: `cm-${employee.employeeCode.toLowerCase()}-5`,
      userId: employee.id,
      skillName: 'Giao tiếp & Làm việc nhóm',
      proficiencyScore: 60 + (i % 5) * 5,
    });

    notificationRows.push({
      id: `nt-${employee.employeeCode.toLowerCase()}-1`,
      userId: employee.id,
      type: NotificationType.ENROLLMENT_ASSIGNED,
      title: 'Bạn được giao lộ trình đào tạo mới',
      body: `HR đã giao cho bạn lộ trình "${pathDef.title}". Hạn hoàn thành: ${dueDate.toLocaleDateString('vi-VN')}.`,
      readAt: i % 2 === 0 ? now : null,
    });
    if (status === EnrollmentStatus.OVERDUE) {
      notificationRows.push({
        id: `nt-${employee.employeeCode.toLowerCase()}-2`,
        userId: employee.id,
        type: NotificationType.ENROLLMENT_OVERDUE,
        title: 'Lộ trình đào tạo đã quá hạn',
        body: `Lộ trình "${pathDef.title}" đã quá hạn. Vui lòng hoàn thành sớm nhất có thể.`,
        readAt: null,
      });
    }
    if (status === EnrollmentStatus.COMPLETED) {
      notificationRows.push({
        id: `nt-${employee.employeeCode.toLowerCase()}-2`,
        userId: employee.id,
        type: NotificationType.QUIZ_PASSED,
        title: 'Chúc mừng bạn hoàn thành lộ trình',
        body: `Bạn đã hoàn thành lộ trình "${pathDef.title}" với kết quả đạt yêu cầu.`,
        readAt: now,
      });
    }
  });

  for (const code of ['ADMIN001', 'HR001', 'TR001']) {
    const account = userByCode.get(code)!;
    notificationRows.push({
      id: `nt-${code.toLowerCase()}-1`,
      userId: account.id,
      type: NotificationType.WELCOME,
      title: 'Chào mừng đến với NovaTech LMS',
      body: 'Hệ thống đã sẵn sàng. Hãy kiểm tra bảng điều khiển để theo dõi tiến độ đào tạo.',
      readAt: null,
    });
  }

  await prisma.pathEnrollment.createMany({ data: pathEnrollmentRows as never });
  await prisma.courseEnrollment.createMany({ data: courseEnrollmentRows as never });
  await prisma.userProgress.createMany({ data: progressRows as never });
  await prisma.quizAttempt.createMany({ data: attemptRows as never });
  await prisma.competencyMatrix.createMany({ data: competencyRows as never });
  await prisma.notification.createMany({ data: notificationRows as never });

  /* ---------- 6. Bảng tổng kết ---------- */
  const [
    roles,
    usersCount,
    paths,
    courses,
    pathCourses,
    modules,
    lessons,
    quizzes,
    questions,
    pathEnrollments,
    courseEnrollments,
    userProgress,
    quizAttempts,
    competencyMatrix,
    notifications,
  ] = await Promise.all([
    prisma.role.count(),
    prisma.user.count(),
    prisma.learningPath.count(),
    prisma.course.count(),
    prisma.pathCourse.count(),
    prisma.module.count(),
    prisma.lesson.count(),
    prisma.quiz.count(),
    prisma.question.count(),
    prisma.pathEnrollment.count(),
    prisma.courseEnrollment.count(),
    prisma.userProgress.count(),
    prisma.quizAttempt.count(),
    prisma.competencyMatrix.count(),
    prisma.notification.count(),
  ]);

  const summary: Array<{ Bảng: string; 'Thực tế': number; 'Kỳ vọng': number | string; 'Kết quả': string }> = [
    { Bảng: 'roles', 'Thực tế': roles, 'Kỳ vọng': 4, 'Kết quả': '' },
    { Bảng: 'users', 'Thực tế': usersCount, 'Kỳ vọng': 100, 'Kết quả': '' },
    { Bảng: 'learning_paths', 'Thực tế': paths, 'Kỳ vọng': 5, 'Kết quả': '' },
    { Bảng: 'courses', 'Thực tế': courses, 'Kỳ vọng': 20, 'Kết quả': '' },
    { Bảng: 'path_courses', 'Thực tế': pathCourses, 'Kỳ vọng': 20, 'Kết quả': '' },
    { Bảng: 'modules', 'Thực tế': modules, 'Kỳ vọng': 25, 'Kết quả': '' },
    { Bảng: 'lessons', 'Thực tế': lessons, 'Kỳ vọng': 75, 'Kết quả': '' },
    { Bảng: 'quizzes', 'Thực tế': quizzes, 'Kỳ vọng': 25, 'Kết quả': '' },
    { Bảng: 'questions', 'Thực tế': questions, 'Kỳ vọng': 200, 'Kết quả': '' },
    { Bảng: 'path_enrollments', 'Thực tế': pathEnrollments, 'Kỳ vọng': '>= 30', 'Kết quả': '' },
    { Bảng: 'course_enrollments', 'Thực tế': courseEnrollments, 'Kỳ vọng': '> 0', 'Kết quả': '' },
    { Bảng: 'user_progress', 'Thực tế': userProgress, 'Kỳ vọng': '> 0', 'Kết quả': '' },
    { Bảng: 'quiz_attempts', 'Thực tế': quizAttempts, 'Kỳ vọng': '> 0', 'Kết quả': '' },
    { Bảng: 'competency_matrix', 'Thực tế': competencyMatrix, 'Kỳ vọng': '> 0', 'Kết quả': '' },
    { Bảng: 'notifications', 'Thực tế': notifications, 'Kỳ vọng': '> 0', 'Kết quả': '' },
  ];

  let allPassed = true;
  for (const row of summary) {
    const expected = row['Kỳ vọng'];
    let ok: boolean;
    if (typeof expected === 'number') {
      ok = row['Thực tế'] === expected;
    } else if (expected === '>= 30') {
      ok = row['Thực tế'] >= 30;
    } else {
      ok = row['Thực tế'] > 0;
    }
    row['Kết quả'] = ok ? '✅ ĐẠT' : '❌ SAI';
    if (!ok) {
      allPassed = false;
    }
  }

  console.log('\n📊 BẢNG TỔNG KẾT SEED DỮ LIỆU');
  console.table(summary);

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (allPassed) {
    console.log(`✅ Seed hoàn tất, đạt toàn bộ chỉ tiêu nghiệm thu (${seconds}s).`);
    console.log(`🔑 Mật khẩu demo: ${process.env.SEED_DEMO_PASSWORD || 'Password123!'}`);
  } else {
    console.warn(`⚠️ Seed hoàn tất nhưng có chỉ tiêu chưa đạt (${seconds}s). Hãy kiểm tra bảng ở trên.`);
  }
}

main()
  .catch((error) => {
    console.error('❌ Seed thất bại:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });