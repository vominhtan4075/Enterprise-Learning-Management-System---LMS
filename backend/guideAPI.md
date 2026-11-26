# Tài Liệu API Backend – Corporate LMS NovaTech (DT02)

> **Tài liệu chuẩn hóa để tích hợp Frontend.** Đã dọn toàn bộ endpoint trùng lặp và khớp 100% với code Backend hiện hành (`WP0 → WP14` + CRUD Quiz/Câu hỏi).

---

## 1. Thông Tin Kết Nối & Quy Ước Chung

| Mục | Giá trị mặc định | Ghi chú tích hợp Frontend |
| :--- | :--- | :--- |
| **Base URL (Local)** | `http://localhost:5000/api/v1` | Dùng khi chạy `backend/.env` (`PORT=5000`) |
| **Base URL (Docker / CI)** | `http://localhost:3000/api/v1` | Dùng trong [docker-compose.yml](file:///c:/Code/Enterprise-Learning-Management-System---LMS/docker-compose.yml) |
| **Swagger UI** | `<HOST>/api/docs` | Hỗ trợ test trực tiếp kèm `Authorize` |
| **Xác thực** | `Authorization: Bearer <accessToken>` | Với `GET /files/:id` & `export` Excel, dùng `fetch` kèm header trả `Blob` → `ObjectURL` |
| **Upload & Giới hạn** | JSON `<= 1 MB`, PDF `<= 20 MB` | Upload dùng `multipart/form-data` với field tên `file` |

### 1.1. Tài khoản Demo (`npm run db:seed` — Mật khẩu chung: `Password123!`)
| Role (`RoleCode`) | Email | Cấp bậc | Ghi chú |
| :--- | :--- | :--- | :--- |
| **`ADMIN`** | `admin@novatech.com` | `LEAD` | Toàn quyền hệ thống + Quản lý Users (`/users`) |
| **`HR`** | `hr@novatech.com` | `SENIOR` | Lộ trình, Giao bài, Báo cáo, Ma trận năng lực, Đồng bộ HRM |
| **`TRAINER`** | `trainer@novatech.com` | `SENIOR` | Tạo/Sửa Khóa học, Học phần, Bài học, PDF, Quiz & Báo cáo lớp |
| **`EMPLOYEE`** | `fresher.java@novatech.com` | `FRESHER` | Học viên chuẩn (đã gán lộ trình `path-fresher-java`) |
| **`EMPLOYEE`** | `huan.nguyen@novatech.com` | `JUNIOR` | Học viên có dữ liệu thi trượt demo **BR-03** |
| **`EMPLOYEE`** | `khanh.nguyen3@novatech.com` | `INTERN` | Học viên dùng trong kịch bản E2E `TC06` |

### 1.2. Enum & Hằng số
- **`RoleCode`:** `'EMPLOYEE' | 'TRAINER' | 'HR' | 'ADMIN'` (DB `roleId`: `1=EMPLOYEE`, `2=TRAINER`, `3=HR`, `4=ADMIN`).
- **`PositionLevel`:** `'INTERN' | 'FRESHER' | 'JUNIOR' | 'SENIOR' | 'LEAD'` (Điểm chuẩn năng lực: `60 | 70 | 75 | 85 | 90`).
- **`ContentType`:** `'VIDEO' | 'PDF' | 'MARKDOWN'` | **`QuizType`:** `'MODULE' | 'FINAL'`
- **`EnrollmentStatus`:** `'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'` | **`UnlockState`:** `'LOCKED' | 'UNLOCKED' | 'COMPLETED'`

### 1.3. Chuẩn Phân Trang & Lỗi
- **Phân trang chuẩn:** `{ data: T[], total: number, page: number, limit: number, totalPages: number }`.
  *(Ngoại lệ: `GET /learning-paths` trả mảng `[]`; `GET /hrm/employees` trả `{ mockEmployees, data: { total, mockEmployees } }`; `GET /users` không truyền query trả mảng `[]`, truyền query trả chuẩn phân trang).*
- **JSON Lỗi chuẩn:** `{ statusCode, message, errorCode, timestamp, path, method, requestId, details? }`.
- **`errorCode` FE cần bắt:**
  - `AUTH_UNAUTHORIZED` (`401`): Chưa đăng nhập / token hết hạn / bị thu hồi → về `/login`.
  - `AUTH_MUST_CHANGE_PASSWORD` (`403`): Chưa đổi mật khẩu lần đầu → chuyển sang `/change-password`.
  - `AUTH_FORBIDDEN` (`403`) / `NOT_ENROLLED` (`403`): Không đủ quyền hoặc chưa được giao khóa học.
  - `BR02_LOCK_CONSTRAINT` (`422`): Bài học hoặc bài Quiz đang bị khóa tuần tự.
  - `QUIZ_MAX_ATTEMPTS_REACHED` (`422`): Đã dùng hết số lượt làm Quiz tối đa.
  - `PATH_IN_USE` (`422`) / `PATH_STRUCTURE_INVALID` (`422`): Lộ trình đang có học viên `IN_PROGRESS` hoặc chưa có bài Quiz đã xuất bản ở cuối lộ trình.
  - `CONFLICT` (`409`) / `UNPROCESSABLE_ENTITY` (`422`): Trùng dữ liệu hoặc vi phạm ràng buộc xóa/xuất bản.

---

## 2. Bảng Tổng Hợp Toàn Bộ API Theo Quyền (`RoleCode`)

| Module | Endpoint | Quyền truy cập | Chức năng chính |
| :--- | :--- | :--- | :--- |
| **Health** | `GET /health` | Public | Trạng thái Server, PostgreSQL, Redis |
| **Auth** | `POST /auth/login` | Public | Đăng nhập nhận JWT + `user` |
| | `GET /auth/me`, `PUT /auth/me` | Mọi Role | Xem hồ sơ (kể cả lúc đổi MK lần đầu) / Sửa `fullName` |
| | `POST /auth/change-password`, `POST /auth/logout` | Mọi Role | Đổi mật khẩu (tăng `tokenVersion`) / Đăng xuất |
| **Users** | `POST /users`, `PUT /users/:id`, `DELETE /users/:id` | `ADMIN` | Tạo (nhận `role` chữ hoặc `roleId`), sửa, xóa mềm user |
| | `PATCH /users/:id/role`, `PATCH /users/:id/status` | `ADMIN` | Phân quyền `role`, khóa/mở khóa (chặn Admin cuối cùng) |
| | `GET /users`, `GET /users/:id` | `ADMIN, HR, TRAINER` *(chính chủ)* | Danh sách lọc & phân trang (`TRAINER` chỉ thấy `EMPLOYEE` rút gọn) |
| **Courses** | `GET /courses`, `GET /courses/:id` | Mọi Role | `EMPLOYEE` chỉ thấy khóa đã giao + trạng thái `BR-02` |
| | `POST /courses`, `PUT /courses/:id`, `PATCH /courses/:id/publish`, `DELETE /courses/:id` | `TRAINER` *(owner)*, `ADMIN` | Tạo/sửa/xuất bản/xóa mềm khóa học |
| **Modules** | `POST /courses/:id/modules`, `PUT /modules/:id`, `DELETE /modules/:id`, `PUT /courses/:id/modules/order` | `TRAINER` *(owner)*, `ADMIN` | CRUD học phần & kéo-thả sắp xếp thứ tự |
| **Files** | `POST /files`, `DELETE /files/:id` | `TRAINER` *(owner)*, `ADMIN` | Upload PDF `<= 20MB` (`%PDF-`) / Xóa file không còn tham chiếu |
| | `GET /files/:id` | Mọi Role | Stream PDF inline (kiểm tra ghi danh + `BR-02` với `EMPLOYEE`) |
| **Lessons** | `POST /modules/:id/lessons`, `PUT /lessons/:id`, `DELETE /lessons/:id`, `PUT /modules/:id/lessons/order` | `TRAINER` *(owner)*, `ADMIN` | CRUD bài học (`VIDEO`, `PDF`, `MARKDOWN`) & kéo-thả |
| | `GET /lessons/:id`, `GET /lessons/:id/content` | Mọi Role | Lấy chi tiết/nội dung bài học (kiểm tra ghi danh + `BR-02`) |
| **Paths** | `GET /learning-paths`, `GET /learning-paths/:id` | Mọi Role | Danh sách & cây lộ trình (hỗ trợ UUID hoặc `code`) |
| | `GET /learning-paths/:id/validation` | `HR, ADMIN, TRAINER` | Kiểm tra cấu trúc lộ trình (số khóa học tùy ý + có Quiz ở cuối) |
| | `POST/PUT/DELETE /learning-paths`, `POST/DELETE/PUT .../courses` | `HR, ADMIN` | CRUD lộ trình & thêm/gỡ/kéo-thả khóa học (`PATH_IN_USE`) |
| **Enroll** | `POST /enrollments` | `HR, TRAINER, ADMIN` | Giao **Khóa học lẻ** (`courseId`) cho cá nhân/nhóm/phòng ban/cấp bậc |
| | `POST /assignments/path` | `HR, ADMIN` | Giao **Lộ trình** (`pathId`) (kiểm tra `PATH_STRUCTURE_INVALID`) |
| | `GET /enrollments`, `GET /enrollments/:id`, `PUT /enrollments/:id` | `HR, ADMIN, TRAINER, EMPLOYEE` | Xem theo scope; gia hạn `deadline` (`HR/ADMIN/TRAINER` chủ giao) |
| | `DELETE /enrollments/:id` | `HR, ADMIN` | Hủy ghi danh (giữ lịch sử học/thi) |
| **Progress** | `GET /progress/my-progress`, `POST /progress/update` | Mọi Role | Dashboard học tập (`nextUp`, `upcomingDeadlines`) & hoàn thành bài |
| **Notif** | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` | Mọi Role | Danh sách thông báo (`unreadCount`) & đánh dấu đã đọc |
| | `POST /notifications/reminders/run` | `ADMIN, HR` | Chạy thủ công cron nhắc hạn (`D-3, D-1, D-0`) & đánh dấu `OVERDUE` |
| **Quizzes** | `GET /quizzes/:id` | Mọi Role | `EMPLOYEE`: ẩn đáp án + lịch sử lượt thi; `TRAINER/ADMIN/HR`: kèm đáp án |
| | `POST /quizzes/:id/submit`, `GET /quizzes/:id/retake-suggestions` | Mọi Role | Nộp trắc nghiệm (`BR-01 >= 70%`, chặn `maxAttempts`) & gợi ý `BR-03` |
| | `POST /modules/:moduleId/quiz`, `PUT/DELETE /quizzes/:id` | `TRAINER` *(owner)*, `ADMIN` | Tạo (`1-1` Module), cấu hình/xuất bản, xóa đề thi |
| | `POST /quizzes/:id/questions`, `PUT/DELETE /questions/:id` | `TRAINER` *(owner)*, `ADMIN` | Thêm, sửa, xóa mềm câu hỏi trắc nghiệm chọn đáp án |
| **Reports** | `GET /reports/dashboard`, `GET /reports/competency-matrix/me` | Mọi Role | Dashboard tự biến thiên theo 4 Role & Hồ sơ năng lực cá nhân |
| | `GET /reports/competency-matrix`, `.../export`, `GET /reports/completion`, `GET /reports/quiz-scores` | `HR, ADMIN, TRAINER` | Báo cáo & Ma trận năng lực (Excel `.xlsx`), `TRAINER` theo scope |
| | `POST /competency/recalculate` | `ADMIN, HR` | Tính lại toàn bộ bảng `CompetencyMatrix` từ `QuizAttempt` |
| **HRM** | `GET /hrm/employees`, `POST /hrm/sync-users` | `@Public()` | Danh sách nhân sự Mock HRM & Đồng bộ vào LMS |
| | `GET /hrm/sync-logs`, `GET /hrm/sync-logs/:id`, `GET /hrm/training-status` | `ADMIN, HR` | Lịch sử đồng bộ phân trang & Hoàn trả trạng thái đào tạo |

---

## 3. Đặc Tả Request / Response Chính Xác Từng Module

### MODULE 0 & 1: HEALTH & AUTH (`/api/v1/health`, `/api/v1/auth`)
- **`GET /health`:** `{ status: "ok" | "error", uptime, timestamp, database: { status }, redis: { status } }`
- **`POST /auth/login`**
  - Body: `{ "email": "admin@novatech.com", "password": "Password123!" }`
  - `200 OK`: `{ accessToken, tokenType: "Bearer", expiresIn, user: { id, email, fullName, role, position, department, mustChangePassword } }`
- **`GET /auth/me`:** Trả `user` kèm `employeeCode, jobTitle, isActive, lastLoginAt, createdAt` *(gọi được cả khi `mustChangePassword = true`)*.
- **`PUT /auth/me`:** Body `{ "fullName": "..." }` → trả hồ sơ đã cập nhật.
- **`POST /auth/change-password`:** Body `{ "currentPassword": "...", "newPassword": "..." }` *(>= 8 ký tự, có hoa, thường, số, ký tự đặc biệt)* → `{ message, mustChangePassword: false }`.
  > **Lưu ý FE:** Đổi mật khẩu tăng `tokenVersion` làm token cũ hết hiệu lực ngay; FE cần tự đăng nhập lại bằng mật khẩu mới hoặc đẩy về `/login`.
- **`POST /auth/logout`:** Thu hồi JWT hiện tại (`200 OK`).

---

### MODULE 2: USERS (`/api/v1/users`)
- **`POST /users`** (`ADMIN`):
  - Body: `{ email, fullName, role?: RoleCode, roleId?: number, position: PositionLevel, password?, department?, employeeCode?, jobTitle? }`
  - `201`: User mới (bỏ trống `password` sẽ tự sinh và trả kèm `temporaryPassword` + `mustChangePassword: true`).
- **`GET /users`** (`ADMIN, HR, TRAINER`):
  - Query: `page=1, limit=20, search?, role?, position?, department?, isActive?`
  - `TRAINER` chỉ nhận danh sách `EMPLOYEE` rút gọn: `{ id, email, fullName, position, department }`.
- **`GET /users/:id`**, **`PUT /users/:id`** (`{ fullName?, position?, jobTitle?, department?, employeeCode?, password? }`), **`DELETE /users/:id`**.
- **`PATCH /users/:id/role`** (`ADMIN`): Body `{ "role": "TRAINER" }` hoặc `{ "roleId": 2 }` *(chặn tự đổi quyền mình / hạ Admin cuối cùng)*.
- **`PATCH /users/:id/status`** (`ADMIN`): Body `{ "isActive": false }` *(chặn tự khóa / khóa Admin cuối cùng)*.

---

### MODULE 3–6: COURSES, MODULES, FILES & LESSONS
> **Quy tắc vận hành:** `ADMIN` có **toàn quyền tối cao** (vượt qua mọi giới hạn khóa nghiệp vụ khi sửa/hủy xuất bản/xóa). Với `TRAINER`, hệ thống chỉ chặn thao tác phá vỡ cấu trúc khi khóa học đang có học viên **`IN_PROGRESS`** hoặc đã phát sinh lịch sử điểm thi.

- **Courses (`/courses`):**
  - `POST /courses`: `{ code, title, description?, estimatedHours? }` (`code` tự viết hoa, regex `^[A-Z0-9_-]{3,40}$`).
  - `GET /courses`: Query `page, limit, search, isPublished, mine`. Trả phân trang kèm `_count: { modules, courseEnrollments }`.
  - `GET /courses/:id`: Trả cây `modules[] -> lessons[] + quiz`. Với `EMPLOYEE`, tự gắn `state` (`LOCKED | UNLOCKED | COMPLETED`) & `lockedReason`, đồng thời ẩn `contentUrl / contentText / fileId` trong cây (phải gọi `GET /lessons/:id` để xem nội dung).
  - `PUT /courses/:id`, `PATCH /courses/:id/publish` (`{ isPublished: boolean }` — `TRAINER` cần `>= 1` module & `>= 1` lesson để publish; chỉ chặn unpublish khi đang có người học `IN_PROGRESS` hoặc thuộc lộ trình active), `DELETE /courses/:id`.
- **Modules:**
  - `POST /courses/:id/modules`: `{ title, description?, moduleOrder?, dayStart?, dayEnd? }` (`dayEnd >= dayStart`; khi có người học `IN_PROGRESS`, `TRAINER` chỉ thêm vào cuối khóa).
  - `PUT /modules/:id`, `DELETE /modules/:id` *(`TRAINER` bị chặn nếu đã có tiến độ/quiz attempt)*, `PUT /courses/:id/modules/order` (`{ orderedIds: string[] }`).
- **Files (`/files`):**
  - `POST /files` (`multipart/form-data`, field `file`): Chỉ nhận PDF thật (`%PDF-`, `<= 20MB`). Trả `{ id, originalName, sizeBytes, url: "/api/v1/files/:id", ... }`.
  - `GET /files/:id`: Trả binary PDF (`Content-Disposition: inline`). Kiểm tra `NOT_ENROLLED` (`403`) và `BR-02` (`422`) với `EMPLOYEE`.
  - `DELETE /files/:id` *(`TRAINER` bị chặn `422` nếu còn bài học đang gắn tệp; `ADMIN` tự gỡ liên kết để xóa)*.
- **Lessons:**
  - `POST /modules/:id/lessons`: Hỗ trợ JSON hoặc `multipart/form-data`. Chung `{ title, contentType, durationMinutes?, lessonOrder?, isRequired? }`:
    - `VIDEO`: truyền `contentUrl` (`http://` hoặc `https://`).
    - `PDF`: truyền `fileId` (đã upload qua `POST /files`) hoặc gửi kèm multipart `file`.
    - `MARKDOWN`: truyền `contentText` (hoặc file `.md`).
  - `GET /lessons/:id`: Trả chi tiết kèm `contentUrl, contentText, fileId` (+ `state, isCompleted` cho `EMPLOYEE`).
  - `GET /lessons/:id/content`: `{ id, title, contentType, contentUrl, contentText }`.
  - `PUT /lessons/:id`, `DELETE /lessons/:id` *(trả kèm `referencedQuestionsCount`; chặn `TRAINER` xóa bài cuối cùng của khóa đang publish)*, `PUT /modules/:id/lessons/order` (`{ orderedIds: string[] }`).

---

### MODULE 7: LEARNING PATHS (`/api/v1/learning-paths`)
- `GET /learning-paths`: Query `targetPosition?, isMandatory?, search?` → **Trả trực tiếp mảng `[]`**: `{ id, code, title, targetPosition, description, isMandatory, estimatedDays, totalCourses, totalUnits, hasFinal }`.
- `POST /learning-paths` (`HR, ADMIN`): `{ title, targetPosition, description?, isMandatory?, estimatedDays?, code? }`.
- `GET /learning-paths/:id` (nhận UUID hoặc `code` như `path-fresher-java`): Cây `pathCourses[] -> course -> modules[] -> lessons[] + quiz`.
- `GET /learning-paths/:id/validation` (`HR, ADMIN, TRAINER`): `{ valid, unitCount, expectedUnits, hasFinal, finalIsLast, issues: [...] }` *(cho phép số lượng khóa học/học phần tùy ý miễn các khóa đã publish và học phần cuối cùng có Quiz đã publish)*.
- `PUT /learning-paths/:id`, `DELETE /learning-paths/:id` (`archivedAt` — chặn `HR` nếu đang có học viên `IN_PROGRESS`, `ADMIN` toàn quyền).
- `POST /learning-paths/:id/courses` (`{ courseId, stepOrder? }`), `PUT /learning-paths/:id/courses/order` (`{ orderedCourseIds }`), `DELETE /learning-paths/:id/courses/:courseId` *(chỉ chặn `HR` với `422 PATH_IN_USE` khi đang có học viên `IN_PROGRESS`; `ADMIN` toàn quyền)*.

---

### MODULE 8: ENROLLMENTS & PATH ASSIGNMENTS (`/api/v1/enrollments`, `/api/v1/assignments/path`)
- **`POST /enrollments`** (`HR, TRAINER, ADMIN` — **Giao khóa học lẻ**):
  - Body: `{ courseId, deadline, userId? | userIds? | department? | position? }`.
- **`POST /assignments/path`** (`HR, ADMIN` — **Giao lộ trình**, kiểm tra `PathStructureValidator` với `HR`, `ADMIN` toàn quyền):
  - Body: `{ pathId, deadline, userId? | userIds? | department? | targetPosition?, allowIncomplete? }`.
  - **Response `201` chung của 2 API giao bài:** `{ createdCount, skippedCount, matched, enrollmentIds[], skipped: [{ userId, reason }], enrollmentId?, assignedAt?, deadline?, status? }`. *(Giao đơn lẻ bị trùng trả `409 CONFLICT`)*.
- **`GET /enrollments`**: Query `page, limit, type: 'COURSE'|'PATH', userId, courseId, pathId, department, status, overdue`. `HR/ADMIN` xem hết, `TRAINER` xem bài mình giao, `EMPLOYEE` xem bài của mình.
- **`GET /enrollments/:id`**, **`PUT /enrollments/:id`** (`{ deadline }` ở tương lai), **`DELETE /enrollments/:id`** (`HR, ADMIN`).

---

### MODULE 9 & 10: PROGRESS & NOTIFICATIONS
- **`GET /progress/my-progress`** *(tự gán `path-fresher-java` nếu FRESHER chưa có lộ trình)*:
  ```json
  {
    "userId": "...",
    "paths": [{ "enrollmentId": "...", "pathId": "...", "code": "path-fresher-java", "title": "...", "progressPercentage": 25, "deadline": "...", "status": "IN_PROGRESS", "completedCourses": 1, "totalCourses": 5, "currentUnit": { "moduleId": "...", "title": "...", "courseId": "..." } }],
    "courses": [{ "enrollmentId": "...", "courseId": "...", "code": "...", "title": "...", "progressPercentage": 50, "deadline": "...", "status": "IN_PROGRESS", "completedModules": 1, "totalModules": 2 }],
    "nextUp": { "type": "LESSON", "id": "...", "title": "...", "courseId": "...", "moduleId": "..." },
    "upcomingDeadlines": [{ "enrollmentId": "...", "type": "PATH", "targetId": "...", "title": "...", "deadline": "...", "status": "IN_PROGRESS", "progressPercentage": 25 }]
  }
  ```
- **`POST /progress/update`**: Body `{ "lessonId": "...", "isCompleted": true }` → `{ lessonId, isCompleted, completedAt, moduleState, quizUnlocked, nextUnlocked }`.
- **`GET /notifications`**: Query `page, limit, unreadOnly` → phân trang chuẩn `{ data[], total, page, limit, totalPages }` + **`unreadCount`**. Item: `{ id, userId, type, title, body, refType, refId, readAt, createdAt }`.
- **`PATCH /notifications/:id/read`**, **`PATCH /notifications/read-all`** (`{ updatedCount, readAt }`), **`POST /notifications/reminders/run`** (`ADMIN, HR` → `{ scannedCount, remindersSent, overdueMarked }`).

---

### MODULE 11: QUIZZES & QUESTIONS (`/api/v1/quizzes`, `/api/v1/modules/:moduleId/quiz`, `/api/v1/questions`)
> Hệ thống chỉ sử dụng câu hỏi **trắc nghiệm chọn đáp án** (`options: [{ key, text }]` + `selectedOption`).

- **`GET /quizzes/:id`**:
  - **`EMPLOYEE`:** Kiểm tra mở khóa `BR-02`. Trả `{ id, moduleId, title, passingScore, timeLimitMin, quizType, maxAttempts, isPublished, attemptsUsed, remainingAttempts, bestScore, hasPassed, module: { id, title, moduleOrder, courseId }, questions: [{ id, questionText, options, skillName, conceptTag, relatedLessonId }] }` *(ẩn `correctAnswer` & `explanation`)*.
  - **`TRAINER` (chủ khóa học), `ADMIN`, `HR`:** Trả đầy đủ cả câu hỏi `isActive = false`, `correctAnswer`, `explanation`, `relatedLesson { id, title, lessonOrder }` và `_count: { quizAttempts }`.
- **`POST /quizzes/:id/submit`**:
  - Body: `{ "answers": [{ "questionId": "...", "selectedOption": "A" }] }`
  - `201`: `{ attemptId, score, isPassed, attemptNumber, maxAttempts, remainingAttempts, suggestedLessons: [{ lessonId, lessonTitle }] }` *(chặn `422 QUIZ_MAX_ATTEMPTS_REACHED` nếu đã hết lượt)*.
- **`GET /quizzes/:id/retake-suggestions`**: `{ quizId, lastAttemptScore, message, suggestedLessons: [{ lessonId, lessonTitle }] }`.
- **Quản trị Đề thi & Câu hỏi (`TRAINER` owner / `ADMIN`):**
  - `POST /modules/:moduleId/quiz`: `{ title, quizType?: 'MODULE'|'FINAL', passingScore?: 70..100, timeLimitMin?, maxAttempts?, isPublished?: false }` *(quan hệ 1-1, trùng trả `409`)*.
  - `PUT /quizzes/:id`: Cập nhật cấu hình / bật `isPublished: true` *(yêu cầu `>= 1` câu hỏi `isActive = true`)*.
  - `DELETE /quizzes/:id`: Xóa khi chưa có lượt làm bài & không nằm trong lộ trình đang học.
  - `POST /quizzes/:id/questions`: `{ questionText, options: [{ key, text }] (2–6 lựa chọn), correctAnswer, relatedLessonId?, skillName?, explanation?, conceptTag?, isActive? }`.
  - `PUT /questions/:id`, `DELETE /questions/:id` *(xóa mềm; chặn xóa câu active cuối cùng nếu đề đang `isPublished: true`)*.

---

### MODULE 12: REPORTS & COMPETENCY MATRIX (`/api/v1/reports`, `/api/v1/competency`)
- **`GET /reports/dashboard`**: Query `from?, to?` (`YYYY-MM-DD`). Trả cấu trúc theo Role:
  - `ADMIN / HR`: `{ role, totalUsers, totalCourses, totalPaths, totalEnrollments, completedEnrollments, inProgressEnrollments, overdueEnrollments, completionRate, totalQuizAttempts, avgQuizScore, period, stats, scoreDistribution[], courseCompletion[], activities[] }`.
  - `TRAINER`: `{ role, myCoursesCount, totalAssignedEnrollments, completedEnrollments, overdueEnrollments, completionRate, period, stats, scoreDistribution[], courseCompletion[], activities[] }`.
  - `EMPLOYEE`: `{ role, userId, completedLessonsCount, totalQuizAttempts, passedQuizzesCount, avgQuizScore, competencySummary: { avgScore, requiredScore, passedCount, gapCount }, period, scoreDistribution[] }`.
- **`GET /reports/competency-matrix`** (`HR, ADMIN, TRAINER` — query `department?, learningPathId?, position?`):
  - `{ success: true, data: { skills: string[], totalEmployees, employees: [{ userId, fullName, department, position, avgScore, competencies: [{ skillName, score, requiredScore, status, level, gapDelta }] }], positionSummary: [{ position, requiredScore, totalEmployees, assessedEmployees, avgProficiencyScore, passedSkillCount, gapSkillCount, passedRate }], matrix: [{ id, name, department, role, skills, scores, average, status }] } }`.
- **`GET /reports/competency-matrix/me`**: `{ userId, fullName, email, department, position, requiredScore, avgScore, passedCount, gapCount, competencies: [...] }`.
- **`GET /reports/competency-matrix/export`** (`HR, ADMIN, TRAINER`): Tải tệp `.xlsx`.
- **`GET /reports/completion`** (`HR, ADMIN, TRAINER` — query `department?, position?, learningPathId?, courseId?`):
  - `{ summary: { totalEnrollments, totalCompleted, totalOverdue, overallCompletionRate }, byDepartment: [{ department, totalEnrollments, completed, inProgress, overdue, completionRate, avgProgressPercentage }], byEmployee: [{ userId, fullName, email, department, position, totalEnrollments, completed, inProgress, overdue, completionRate, avgProgressPercentage }] }`.
- **`GET /reports/quiz-scores`** (`HR, ADMIN, TRAINER` — query `courseId?, learningPathId?`):
  - `{ totalQuizzes, totalAttempts, overallAvgScore, quizzes: [{ quizId, quizTitle, quizType, passingScore, moduleId, moduleTitle, courseId, courseCode, courseTitle, totalAttempts, uniqueLearners, passedAttempts, avgScore, passRate }] }`.
- **`POST /competency/recalculate`** (`ADMIN, HR`): `{ processedUsers, updatedRecords }`.

---

### MODULE 13: MOCK HRM INTEGRATION (`/api/v1/hrm`)
- **`GET /hrm/employees`** (`@Public`, query `department?, status?: 'ACTIVE'|'RESIGNED'`):
  - `200 OK`: `{ statusCode: 200, message, mockEmployees: HrmEmployee[], data: { total, mockEmployees } }`.
- **`POST /hrm/sync-users`** (`@Public`): Body `{ employees: [...] }` hoặc 1 object nhân viên `{ employeeCode, fullName, email, position, department, startDate?, employmentStatus? }`.
  - `201`: `{ statusCode: 201, message, syncedCount, failedCount, data: { summary: { totalProcessed, createdCount, updatedCount, positionChangedCount, deactivatedCount, skippedCount, failedCount }, syncedUsers: [...] } }`.
- **`GET /hrm/sync-logs`** (`ADMIN, HR`): Query `page, limit, status: 'INITIATED'|'SKIPPED'|'FAILED', search`.
- **`GET /hrm/sync-logs/:id`** (`ADMIN, HR`): Chi tiết bản ghi `HrmSyncLog` kèm raw `payload`.
- **`GET /hrm/training-status`** (`ADMIN, HR`): Query `page, limit, employeeCode?, email?, department?` → `{ data: [{ userId, employeeCode, fullName, email, department, position, overallStatus, overallProgressPercentage, avgCompetencyScore, learningPaths[], courses[], competencies[] }], total, page, limit, totalPages }`.
