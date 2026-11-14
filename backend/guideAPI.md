# Tài Liệu Hướng Dẫn Tích Hợp API Backend (Frontend Integration Guide)

> **Dự án:** Hệ thống Quản lý Đào tạo Doanh nghiệp – Corporate LMS NovaTech Solutions (DT02)  
> **Phụ trách Backend:** SV02 (Đoàn Quang Hưng) 
> **Đối tượng sử dụng:** Thành viên Frontend
> **Cập nhật lần cuối:** Đã hoàn thành đến hết **WP5 (Health, Auth, Users, Courses, Modules, Lessons, Files)**

---

## 1. Thông Tin Kết Nối Chung

| Thông số | Giá trị mặc định (Local / Docker) | Ghi chú cho Frontend |
| :--- | :--- | :--- |
| **Base URL** | `http://localhost:5000/api/v1` | Mọi endpoint bên dưới đều gắn sau tiền tố `/api/v1` |
| **Swagger UI** | `http://localhost:5000/api/docs` | Giao diện thử nghiệm trực tiếp có nút **Authorize** |
| **Authentication** | `Authorization: Bearer <accessToken>` | Gắn vào Header của Axios/Fetch sau khi gọi `/auth/login` |
| **CORS Origins** | `http://localhost:3000, http://127.0.0.1:3000` | Đã bật `credentials: true` |
| **Content-Type** | `application/json` (hoặc `multipart/form-data` khi upload PDF) | Giới hạn JSON body: `1 MB`; File PDF tối đa: `20 MB` |

### 1.1. Tài khoản Demo có sẵn (Sau khi chạy `npm run db:seed`)
Mật khẩu chung cho toàn bộ tài khoản demo: **`Password123!`**

| Vai trò (`RoleCode`) | Email đăng nhập | Vị trí (`PositionLevel`) | Ghi chú quyền hạn chính |
| :--- | :--- | :--- | :--- |
| **`ADMIN`** | `admin@novatech.com` | `LEAD` | Toàn quyền hệ thống (CRUD Users, Courses, Paths, Enrollments, Reports) |
| **`HR`** | `hr@novatech.com` | `SENIOR` | Quản lý Lộ trình (Learning Paths), Gán khóa học/lộ trình, Xem báo cáo toàn công ty |
| **`TRAINER`** | `trainer@novatech.com` | `SENIOR` | Tạo & quản lý Khóa học / Học phần / Bài học / File / Quiz do chính mình tạo |
| **`EMPLOYEE`** | `fresher.java@novatech.com` | `FRESHER` | Học viên chuẩn (đã được gán lộ trình `path-fresher-java`) |
| **`EMPLOYEE`** | `huan.nguyen@novatech.com` | `FRESHER` | Học viên có dữ liệu thi trượt để demo **BR-03 (Gợi ý học lại)** |

---

## 2. Quy Ước Dữ Liệu Chuẩn (Chuẩn Hóa Toàn Hệ Thống)

### 2.1. Định dạng Phân trang (Pagination Response)
Tất cả các API danh sách có phân trang (`GET /users`, `GET /courses`, ...) đều trả về cấu trúc đồng nhất:
```json
{
  "data": [ /* Mảng phần tử của trang hiện tại */ ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

### 2.2. Định dạng Lỗi Chuẩn (Error Response)
Khi xảy ra lỗi (`4xx`, `5xx`), Backend luôn trả về JSON theo cấu trúc:
```json
{
  "statusCode": 422,
  "message": "Thông báo lỗi tiếng Việt rõ ràng để FE có thể hiển thị toast/alert",
  "errorCode": "UNPROCESSABLE_ENTITY",
  "timestamp": "2026-11-14T07:30:00.000Z",
  "path": "/api/v1/courses/c-1/publish",
  "method": "PATCH",
  "requestId": "8f9d2a1b-3c4d-5e6f-7a8b-9c0d1e2f3a4b",
  "details": []
}
```

**Danh mục `errorCode` phổ biến để Frontend bắt điều kiện:**
- `BAD_REQUEST` (`400`): Dữ liệu đầu vào hoặc tham số không hợp lệ.
- `VALIDATION_ERROR` (`400`): Lỗi validate DTO (kèm mảng `details` mô tả từng field lỗi).
- `AUTH_UNAUTHORIZED` (`401`): Chưa đăng nhập, token hết hạn, hoặc token đã bị thu hồi (sau khi đổi mật khẩu / logout / khóa tài khoản).
- `AUTH_FORBIDDEN` (`403`): Không đủ quyền (`RoleCode`), không phải chủ sở hữu khóa học, hoặc **chưa đổi mật khẩu lần đầu (`mustChangePassword = true`)**.
- `NOT_ENROLLED` (`403`): Học viên (`EMPLOYEE`) truy cập bài học hoặc tài liệu PDF của khóa học chưa được giao.
- `NOT_FOUND` (`404`): Không tìm thấy bản ghi (hoặc bản ghi đã bị xóa mềm / khóa học chưa xuất bản).
- `CONFLICT` (`409`): Trùng dữ liệu duy nhất (`email`, `employeeCode`, mã khóa học `code`, ...).
- `UNPROCESSABLE_ENTITY` (`422`): Vi phạm quy tắc nghiệp vụ (VD: xóa khóa học đang có người học, xuất bản khóa học rỗng, xóa học phần đã có người làm quiz).

### 2.3. Các Enum Hệ Thống
- **`RoleCode`**: `'EMPLOYEE' | 'TRAINER' | 'HR' | 'ADMIN'` (tương ứng `roleId`: `1=ADMIN`, `2=HR`, `3=TRAINER`, `4=EMPLOYEE` hoặc tra theo `role.code`).
- **`PositionLevel`**: `'INTERN' | 'FRESHER' | 'JUNIOR' | 'SENIOR' | 'LEAD'`
- **`ContentType`**: `'VIDEO' | 'PDF' | 'MARKDOWN'`
- **`QuizType`**: `'MODULE' | 'FINAL'`
- **`EnrollmentStatus`**: `'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'`

---

## 3. Chi Tiết Các Endpoint Đã Hoàn Thành

---

### MODULE 0: HEALTH CHECK (`/api/v1/health`)

#### `GET /api/v1/health`
- **Quyền truy cập:** Public (Không cần token)
- **Mục đích:** Kiểm tra trạng thái hoạt động của Backend, PostgreSQL, Redis và cấu hình CORS.
- **Response `200 OK`:**
```json
{
  "status": "ok",
  "timestamp": "2026-11-14T07:30:00.000Z",
  "services": {
    "api": { "status": "up", "port": 5000 },
    "database": { "status": "up", "userCount": 100 },
    "redis": { "status": "connected" },
    "cors": { "allowedOrigins": ["http://localhost:3000"] }
  }
}
```

---

### MODULE 1: AUTH & HỒ SƠ CÁ NHÂN (`/api/v1/auth`)

> **Lưu ý quan trọng cho Frontend về `mustChangePassword`:**
> Khi tài khoản mới được tạo tự động (qua HRM hoặc Admin không nhập mật khẩu), cờ `user.mustChangePassword` sẽ bằng `true`.
> Nếu `mustChangePassword === true`, toàn bộ các API khác sẽ trả về `403 AUTH_FORBIDDEN` cho tới khi người dùng gọi `POST /api/v1/auth/change-password`. Frontend cần kiểm tra `user.mustChangePassword` ngay sau khi login để chuyển hướng sang màn hình **Đổi mật khẩu lần đầu**.

#### 1. `POST /api/v1/auth/login`
- **Quyền truy cập:** Public (Giới hạn Rate Limit: 10 lần/phút/IP và khóa tạm 15 phút nếu sai mật khẩu 5 lần liên tiếp).
- **Request Body:**
```json
{
  "email": "admin@novatech.com",
  "password": "Password123!"
}
```
- **Response `200 OK`:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-user",
    "email": "admin@novatech.com",
    "fullName": "Quản Trị Viên Hệ Thống",
    "role": "ADMIN",
    "position": "LEAD",
    "department": "Board of Directors",
    "mustChangePassword": false
  }
}
```

#### 2. `GET /api/v1/auth/me`
- **Quyền truy cập:** Mọi user đã đăng nhập (kể cả khi `mustChangePassword = true`).
- **Response `200 OK`:** Trả về thông tin chi tiết user hiện tại (`id`, `email`, `fullName`, `role`, `position`, `department`, `employeeCode`, `jobTitle`, `mustChangePassword`, `lastLoginAt`, `createdAt`).

#### 3. `PUT /api/v1/auth/me`
- **Quyền truy cập:** Mọi user đã đăng nhập.
- **Request Body:**
```json
{
  "fullName": "Nguyễn Văn A (Updated)"
}
```
- **Response `200 OK`:** Hồ sơ người dùng sau khi cập nhật.

#### 4. `POST /api/v1/auth/change-password`
- **Quyền truy cập:** Mọi user đã đăng nhập (kể cả khi `mustChangePassword = true`).
- **Ràng buộc mật khẩu mới:** Tối thiểu 8 ký tự, phải có chữ hoa, chữ thường, chữ số và ký tự đặc biệt; phải khác `currentPassword`.
- **Request Body:**
```json
{
  "currentPassword": "Password123!",
  "newPassword": "NewPassword456@"
}
```
- **Response `200 OK`:**
```json
{
  "message": "Đổi mật khẩu thành công. Vui lòng sử dụng mật khẩu mới cho các phiên tiếp theo.",
  "mustChangePassword": false
}
```
> **Lưu ý FE:** Sau khi đổi mật khẩu thành công, `tokenVersion` tăng lên nên token cũ sẽ hết hiệu lực. FE nên yêu cầu người dùng đăng nhập lại hoặc cập nhật trạng thái phiên.

#### 5. `POST /api/v1/auth/logout`
- **Quyền truy cập:** Mọi user đã đăng nhập.
- **Mục đích:** Thu hồi hiệu lực JWT hiện tại (đưa `jti` vào Redis blacklist và tăng `tokenVersion`).
- **Response `200 OK`:** `{ "message": "Đăng xuất thành công." }`

---

### MODULE 2: QUẢN LÝ NGƯỜI DÙNG (`/api/v1/users`)

#### 1. `POST /api/v1/users`
- **Quyền truy cập:** `ADMIN`
- **Mục đích:** Tạo người dùng mới.
  - Có thể truyền `position` thuộc enum (`INTERN | FRESHER | JUNIOR | SENIOR | LEAD`) **hoặc** truyền chức danh tự nhiên qua `jobTitle` (VD: `"Fresher Java Developer"`, hệ thống tự động ánh xạ sang `FRESHER`).
  - Nếu bỏ trống `password`, hệ thống tự sinh mật khẩu mặc định và bật `mustChangePassword = true`.
- **Request Body:**
```json
{
  "email": "dev.new@novatech.com",
  "fullName": "Trần Văn Dev",
  "password": "Password123!",
  "roleId": 4,
  "position": "FRESHER",
  "jobTitle": "Fresher Java Developer",
  "department": "Backend Division",
  "employeeCode": "NV-2026-099"
}
```
- **Response `201 Created`:** Đối tượng user vừa tạo (đã ẩn trường `password`).

#### 2. `GET /api/v1/users`
- **Quyền truy cập:** `ADMIN`, `HR`, `TRAINER` (`EMPLOYEE` gọi sẽ nhận `403`).
  - `ADMIN` & `HR`: Xem đầy đủ thông tin.
  - `TRAINER`: Hệ thống tự động lọc chỉ trả về danh sách `EMPLOYEE` với các trường rút gọn (`id`, `fullName`, `email`, `department`, `position`, `role`).
- **Query Params (Tất cả đều tùy chọn):**
  - `page` (mặc định `1`), `limit` (mặc định `20`, tối đa `100`)
  - `search` (tìm theo `fullName`, `email`, `employeeCode`)
  - `role` (`EMPLOYEE | TRAINER | HR | ADMIN`)
  - `position` (`INTERN | FRESHER | JUNIOR | SENIOR | LEAD`)
  - `department` (tên phòng ban)
  - `isActive` (`true | false`)
- **Response `200 OK`:** Cấu trúc phân trang chuẩn `{ data, total, page, limit, totalPages }`.

#### 3. `GET /api/v1/users/:id`
- **Quyền truy cập:** Chính chủ (`actor.id === id`), `ADMIN`, `HR`, hoặc `TRAINER` (chỉ xem được `EMPLOYEE` ở dạng rút gọn).
- **Response `200 OK`:** Chi tiết người dùng kèm danh sách khóa học đã tạo (`coursesCreated`) và danh sách khóa học được giao (`courseEnrollments`).

#### 4. `PUT /api/v1/users/:id`
- **Quyền truy cập:** `ADMIN`
- **Mục đích:** Cập nhật thông tin hồ sơ người dùng (`fullName`, `position`, `jobTitle`, `department`, `employeeCode`, `password`).
- **Request Body:** (Các trường đều tùy chọn)
```json
{
  "fullName": "Trần Văn Dev (Senior)",
  "position": "SENIOR",
  "department": "Core Platform"
}
```

#### 5. `PATCH /api/v1/users/:id/role`
- **Quyền truy cập:** `ADMIN`
- **Mục đích:** Đổi vai trò (`roleId`) của người dùng và thu hồi toàn bộ phiên đăng nhập cũ của user đó.
- **Quy tắc bảo vệ:** Chặn hạ quyền nếu đây là tài khoản `ADMIN` đang hoạt động cuối cùng trong hệ thống (`422 UNPROCESSABLE_ENTITY`).
- **Request Body:**
```json
{
  "roleId": 3
}
```

#### 6. `PATCH /api/v1/users/:id/status`
- **Quyền truy cập:** `ADMIN`
- **Mục đích:** Khóa (`isActive: false`) hoặc mở khóa (`isActive: true`) tài khoản. Chặn tự khóa chính mình hoặc khóa Admin cuối cùng.
- **Request Body:**
```json
{
  "isActive": false
}
```

#### 7. `DELETE /api/v1/users/:id`
- **Quyền truy cập:** `ADMIN`
- **Mục đích:** Xóa mềm tài khoản (`deletedAt = now()`, `isActive = false`, tăng `tokenVersion`). Chặn tự xóa chính mình hoặc xóa Admin cuối cùng.

---

### MODULE 3: KHÓA HỌC – COURSES (`/api/v1/courses`)

> **Sự khác biệt giữa `Course` (Khóa học), `Module` (Học phần) và `Lesson` (Bài học):**
> - **Course (Khóa học):** Đơn vị lớn (VD: `JAVA_CORE_01` – *"Lập trình Java Core & OOP"*).
> - **Module (Học phần):** Các chương nằm trong Course, sắp theo `moduleOrder: 1..n`. Mỗi Module có tối đa **1 bài Quiz** (`1-1`).
> - **Lesson (Bài học):** Các bài giảng nằm trong Module (`VIDEO`, `PDF`, `MARKDOWN`), sắp theo `lessonOrder: 1..n`.

#### 1. `POST /api/v1/courses`
- **Quyền truy cập:** `TRAINER`, `ADMIN`
- **Mục đích:** Tạo khóa học mới vào cơ sở dữ liệu ở trạng thái nháp (`isPublished = false`, `createdById = currentUser.id`).
- **Request Body:**
```json
{
  "code": "SPRING_BOOT_01",
  "title": "Xây dựng RESTful API với Spring Boot 3",
  "description": "Khóa học thực chiến Spring Boot 3, JPA và Security cho Fresher",
  "estimatedHours": 24
}
```
  *(Lưu ý: `code` tự động viết hoa, chỉ chấp nhận `A-Z`, `0-9`, `_`, `-`, độ dài 3–40 ký tự, không được trùng).*
- **Response `201 Created`:** Bản ghi khóa học vừa tạo trong DB.

#### 2. `GET /api/v1/courses`
- **Quyền truy cập:** Mọi user đã đăng nhập.
  - **Nếu là `EMPLOYEE`:** Hệ thống tự động lọc chỉ trả về các khóa học đã xuất bản (`isPublished = true`) mà nhân viên đó **được giao** (trực tiếp hoặc thông qua Lộ trình học tập).
  - **Nếu là `TRAINER`, `HR`, `ADMIN`:** Xem được toàn bộ khóa học; `TRAINER` có thể truyền `mine=true` để chỉ lọc khóa học do mình tạo.
- **Query Params:**
  - `page` (mặc định `1`), `limit` (mặc định `20`)
  - `search` (tìm theo `title` hoặc `code`)
  - `isPublished` (`true | false`)
  - `mine` (`true | false`)
- **Response `200 OK`:** Danh sách khóa học phân trang kèm `_count: { modules, courseEnrollments }`.

#### 3. `GET /api/v1/courses/:id`
- **Quyền truy cập:** Mọi user đã đăng nhập (`EMPLOYEE` chỉ xem được khóa học đã publish và đã được giao).
- **Mục đích:** Trả về **cây cấu trúc đầy đủ của khóa học** (`Course -> Modules[] -> Lessons[] + Quiz`) đã sắp xếp theo đúng `moduleOrder` và `lessonOrder` để Frontend dựng **Tree View**.
- **Lưu ý bảo mật cho `EMPLOYEE`:** Trong kết quả trả về của API này cho `EMPLOYEE`, hai trường `contentUrl` và `contentText` của từng bài học sẽ được ẩn đi; khi học viên bấm vào từng bài học cụ thể sẽ gọi `GET /api/v1/lessons/:lessonId` để lấy nội dung.
- **Response `200 OK`:**
```json
{
  "id": "course-uuid",
  "code": "SPRING_BOOT_01",
  "title": "Xây dựng RESTful API với Spring Boot 3",
  "description": "...",
  "estimatedHours": 24,
  "isPublished": true,
  "createdById": "trainer-uuid",
  "createdBy": {
    "id": "trainer-uuid",
    "fullName": "Giảng Viên A",
    "email": "trainer@novatech.com"
  },
  "modules": [
    {
      "id": "module-uuid-1",
      "title": "Học phần 1: Kiến trúc Spring Container & IoC",
      "moduleOrder": 1,
      "description": "...",
      "dayStart": 1,
      "dayEnd": 5,
      "lessons": [
        {
          "id": "lesson-uuid-1",
          "title": "Bài 1: Dependency Injection là gì?",
          "contentType": "VIDEO",
          "lessonOrder": 1,
          "durationMinutes": 20,
          "isRequired": true
        }
      ],
      "quiz": {
        "id": "quiz-uuid-1",
        "title": "Kiểm tra Học phần 1",
        "passingScore": "70",
        "timeLimitMin": 15,
        "quizType": "MODULE",
        "maxAttempts": 3,
        "isPublished": true
      }
    }
  ]
}
```

#### 4. `PUT /api/v1/courses/:id`
- **Quyền truy cập:** `TRAINER` (chủ khóa học) hoặc `ADMIN`
- **Quy tắc:** Nếu khóa học đã được giao cho học viên, không được phép đổi mã `code` (`422 UNPROCESSABLE_ENTITY`).
- **Request Body:** `{ "title": "...", "description": "...", "estimatedHours": 30, "code": "..." }`

#### 5. `PATCH /api/v1/courses/:id/publish`
- **Quyền truy cập:** `TRAINER` (chủ khóa học) hoặc `ADMIN`
- **Quy tắc nghiệp vụ:**
  - Khi bật `isPublished: true`: Khóa học bắt buộc phải có **ít nhất 1 Module và 1 Lesson** (nếu chưa có sẽ trả `422 UNPROCESSABLE_ENTITY`).
  - Khi tắt `isPublished: false`: Chặn hủy xuất bản nếu khóa học đang được giao cho học viên (`422 UNPROCESSABLE_ENTITY`).
- **Request Body:**
```json
{
  "isPublished": true
}
```

#### 6. `DELETE /api/v1/courses/:id`
- **Quyền truy cập:** `TRAINER` (chủ khóa học) hoặc `ADMIN`
- **Quy tắc:** Xóa mềm khóa học. Chặn xóa (`422 UNPROCESSABLE_ENTITY` kèm `details` danh sách tham chiếu) nếu khóa học đang nằm trong một `LearningPath` hoặc có học viên đang theo học (`IN_PROGRESS`).

---

### MODULE 4: HỌC PHẦN – MODULES (`/api/v1/courses/:id/modules` & `/api/v1/modules/:id`)

#### 1. `POST /api/v1/courses/:id/modules`
- **Quyền truy cập:** `TRAINER` (chủ khóa học) hoặc `ADMIN`
- **Tham số URL:** `:id` là `courseId`.
- **Mục đích:** Tạo học phần mới trong khóa học.
  - Nếu **không truyền** `moduleOrder`: tự động xếp vào cuối khóa học (`maxOrder + 1`).
  - Nếu **truyền** `moduleOrder` nằm giữa các học phần đã có: tự động dồn các học phần phía sau lên `+1`.
  - Nếu có truyền `dayStart` và `dayEnd`: bắt buộc `dayEnd >= dayStart`.
- **Request Body:**
```json
{
  "title": "Học phần 1: Làm quen Java Core & OOP",
  "description": "Nắm vững cú pháp Java, cấu trúc dữ liệu và lập trình hướng đối tượng.",
  "moduleOrder": 1,
  "dayStart": 1,
  "dayEnd": 7
}
```

#### 2. `PUT /api/v1/modules/:id`
- **Quyền truy cập:** `TRAINER` (chủ khóa học) hoặc `ADMIN`
- **Tham số URL:** `:id` là `moduleId`.
- **Request Body:** Các trường tùy chọn `{ "title"?, "description"?, "dayStart"?, "dayEnd"?, "moduleOrder"? }`.

#### 3. `DELETE /api/v1/modules/:id`
- **Quyền truy cập:** `TRAINER` (chủ khóa học) hoặc `ADMIN`
- **Quy tắc:** Chặn xóa (`422 UNPROCESSABLE_ENTITY`) nếu học phần đã có học viên làm bài Quiz (`quizAttemptCount > 0`) hoặc đã có tiến độ hoàn thành bài học (`completedProgressCount > 0`). Khi xóa mềm thành công, hệ thống tự động dồn lại `moduleOrder` liên tục `1..n` cho các học phần còn lại.

#### 4. `PUT /api/v1/courses/:id/modules/order`
- **Quyền truy cập:** `TRAINER` (chủ khóa học) hoặc `ADMIN`
- **Tham số URL:** `:id` là `courseId`.
- **Mục đích:** Phục vụ thao tác **kéo-thả (Drag & Drop)** sắp xếp lại thứ tự các học phần trong một khóa học.
- **Ràng buộc:** Mảng `orderedIds` phải chứa **đầy đủ và khớp 1-1** tất cả ID học phần đang hoạt động của khóa học đó.
- **Request Body:**
```json
{
  "orderedIds": [
    "module-uuid-2",
    "module-uuid-1",
    "module-uuid-3"
  ]
}
```

---

### MODULE 5: TỆP TÀI LIỆU – FILES (`/api/v1/files`)

#### 1. `POST /api/v1/files`
- **Quyền truy cập:** `TRAINER`, `ADMIN`
- **Định dạng:** `multipart/form-data` với field tên là `file`.
- **Kiểm tra an toàn:**
  - Kiểm tra chữ ký **magic bytes `%PDF-`** ở đầu file (tệp `.exe` hoặc ảnh đổi đuôi thành `.pdf` sẽ bị chặn với lỗi `400 BAD_REQUEST`).
  - Dung lượng tối đa: `20 MB`.
- **Response `201 Created`:**
```json
{
  "id": "file-uuid-1",
  "storageKey": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.pdf",
  "originalName": "Slide-Bai-1-Java-Core.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 542180,
  "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "uploadedById": "trainer-uuid",
  "createdAt": "2026-11-14T07:35:00.000Z",
  "url": "/api/v1/files/file-uuid-1"
}
```

#### 2. `GET /api/v1/files/:id`
- **Quyền truy cập:** Mọi user đã đăng nhập (`EMPLOYEE` bắt buộc phải được ghi danh vào khóa học chứa tài liệu này, nếu không sẽ nhận `403 NOT_ENROLLED`).
- **Response `200 OK`:** Trả trực tiếp luồng nhị phân `application/pdf` (`Content-Disposition: inline`) để trình duyệt hoặc `<iframe / PDFViewer>` của Frontend hiển thị ngay.

#### 3. `DELETE /api/v1/files/:id`
- **Quyền truy cập:** `TRAINER` (người đã upload file) hoặc `ADMIN`.
- **Quy tắc:** Chặn xóa (`422 UNPROCESSABLE_ENTITY`) nếu tệp vẫn đang được gắn với bất kỳ bài học nào đang hoạt động.

---

### MODULE 6: BÀI HỌC – LESSONS (`/api/v1/modules/:id/lessons` & `/api/v1/lessons/:id`)

#### 1. `POST /api/v1/modules/:id/lessons`
- **Quyền truy cập:** `TRAINER` (chủ khóa học) hoặc `ADMIN`
- **Tham số URL:** `:id` là `moduleId`.
- **Hỗ trợ 2 kiểu gửi linh hoạt:** `application/json` hoặc `multipart/form-data`.

**Cách 1 – Tạo bài học `VIDEO` (gửi JSON):**
```json
{
  "title": "Bài 1: Cài đặt JDK 21 & IntelliJ IDEA",
  "contentType": "VIDEO",
  "contentUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "durationMinutes": 25,
  "lessonOrder": 1,
  "isRequired": true
}
```
*(Chỉ chấp nhận URL `http://` hoặc `https://`, tự động chặn `javascript:`)*

**Cách 2 – Tạo bài học `PDF` (Cách 2A: Upload trực tiếp qua `multipart/form-data`, hoặc Cách 2B: Upload qua `POST /files` trước rồi gửi JSON kèm `fileId`):**
- *Cách 2A (`multipart/form-data`):* Đính kèm trường `file` (tệp PDF) cùng các trường text `title`, `contentType="PDF"`, `durationMinutes`, `isRequired`.
- *Cách 2B (`application/json`):*
```json
{
  "title": "Bài 2: Slide tổng hợp OOP",
  "contentType": "PDF",
  "fileId": "file-uuid-1",
  "durationMinutes": 30,
  "isRequired": true
}
```
*(Hệ thống tự động gán `contentUrl = "/api/v1/files/file-uuid-1"`)*

**Cách 3 – Tạo bài học `MARKDOWN` (gửi JSON kèm `contentText` hoặc đính kèm file `.md`):**
```json
{
  "title": "Bài 3: Quy ước đặt tên biến trong Java",
  "contentType": "MARKDOWN",
  "contentText": "# Quy ước Coding Convention\n1. Class dùng PascalCase\n2. Method dùng camelCase...",
  "durationMinutes": 15,
  "isRequired": true
}
```
*(Hệ thống tự động sinh `contentUrl = "/api/v1/lessons/{id}/content"` để thỏa ràng buộc `NOT NULL` của DB)*

#### 2. `GET /api/v1/lessons/:id`
- **Quyền truy cập:** Mọi user đã đăng nhập (`EMPLOYEE` phải thuộc khóa học được giao, nếu chưa ghi danh trả `403 NOT_ENROLLED`).
- **Response `200 OK`:** Trả đầy đủ thông tin bài học bao gồm `contentUrl`, `contentText`, `fileId`, `durationMinutes`, `isRequired` và thông tin `module / course`.

#### 3. `GET /api/v1/lessons/:id/content`
- **Quyền truy cập:** Mọi user đã đăng nhập (kiểm tra ghi danh như `GET /lessons/:id`).
- **Mục đích:** Trả nội dung bài học (`{ id, title, contentType, contentUrl, contentText }`).

#### 4. `PUT /api/v1/lessons/:id`
- **Quyền truy cập:** `TRAINER` (chủ khóa học) hoặc `ADMIN`
- **Mục đích:** Cập nhật thông tin hoặc thay đổi nội dung/tệp đính kèm của bài học.

#### 5. `DELETE /api/v1/lessons/:id`
- **Quyền truy cập:** `TRAINER` (chủ khóa học) hoặc `ADMIN`
- **Mục đích:** Xóa mềm bài học, tự động dồn lại `lessonOrder` `1..n` cho các bài còn lại trong học phần, đồng thời trả về số câu hỏi Quiz đang tham chiếu tới bài học này (`referencedQuestionsCount`).

#### 6. `PUT /api/v1/modules/:id/lessons/order`
- **Quyền truy cập:** `TRAINER` (chủ khóa học) hoặc `ADMIN`
- **Tham số URL:** `:id` là `moduleId`.
- **Mục đích:** Sắp xếp lại thứ tự toàn bộ bài học trong học phần bằng thao tác kéo-thả.
- **Request Body:**
```json
{
  "orderedIds": [
    "lesson-uuid-2",
    "lesson-uuid-1"
  ]
}
```

---

### MODULE 7: QUIZZES & ĐÁNH GIÁ (`/api/v1/quizzes` – Phối hợp SV04)

#### 1. `POST /api/v1/quizzes/:id/submit`
- **Mục đích:** Học viên nộp bài kiểm tra Quiz và hệ thống chấm điểm tự động theo **BR-01** (Điểm đạt `>= 70%`).
- **Request Body:**
```json
{
  "answers": [
    { "questionId": "q-uuid-1", "selectedOption": "A" },
    { "questionId": "q-uuid-2", "selectedOption": "C" }
  ]
}
```

#### 2. `GET /api/v1/quizzes/:id/retake-suggestions`
- **Mục đích:** Khi học viên thi trượt (`isPassed = false`), trả về danh sách các bài học liên quan (`relatedLessonId`) tương ứng với các câu trả lời sai để học viên ôn tập lại (**BR-03**).

---

### MODULE 8: TÍCH HỢP MOCK HRM (`/api/v1/hrm`)

#### 1. `GET /api/v1/hrm/employees`
- **Query Params:** `?department=Software Engineering` (tùy chọn)
- **Mục đích:** Lấy danh sách nhân sự mẫu từ hệ thống Mock HRM.

#### 2. `POST /api/v1/hrm/sync-users`
- **Mục đích:** Đồng bộ danh sách nhân sự từ HRM sang LMS và tự động gán lộ trình Onboarding 30 ngày cho nhân sự mới.

---

## 4. Lộ Trình Các Module Tiếp Theo (Sẽ Cập Nhật Ngay Khi Hoàn Thành)

- [ ] **WP6 – Learning Paths (`/api/v1/learning-paths`)**: Quản lý 5 lộ trình theo cấp bậc (`INTERN`, `FRESHER`, `JUNIOR`, `SENIOR`, `LEAD`), thêm/xóa/kéo-thả khóa học trong lộ trình và API kiểm tra cấu trúc chuẩn `GET /learning-paths/:id/validation`.
- [ ] **WP7 – Enrollments (`/api/v1/enrollments` & `/api/v1/assignments/path`)**: Giao khóa học lẻ và giao lộ trình hàng loạt, xem/gia hạn hạn chót (`deadline`).
- [ ] **WP8 – Progress & Unlock Engine (`/api/v1/progress`)**: Mở khóa tuần tự Học phần 1 → 4 → Bài kiểm tra tổng hợp (`BR-02`), đánh dấu hoàn thành bài học (`POST /progress/update`).
- [ ] **WP10 – Notifications (`/api/v1/notifications`)**: Danh sách thông báo in-app và đánh dấu đã đọc.
- [ ] **WP11 – Reports & Competency Matrix (`/api/v1/reports`)**: Dashboard theo từng vai trò, Ma trận năng lực cá nhân/phòng ban và xuất Excel.
- [ ] **WP12 – HRM Sync Logs & Training Status (`/api/v1/hrm/sync-logs`, `/api/v1/hrm/training-status`)**: Tra cứu lịch sử đồng bộ và trạng thái đào tạo hoàn trả về HRM.

