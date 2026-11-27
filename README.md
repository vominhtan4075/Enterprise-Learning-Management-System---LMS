# Enterprise-Learning-Management-System---LMS
# Corporate LMS - Nền Tảng Quản Lý Đào Tạo Nội Bộ & Đánh Giá Năng Lực (NovaTech Solutions)

> **Mã đề tài:** DT02 | **Quy mô:** 150 nhân viên
> **Stack chính:** TypeScript, Next.js, NestJS, PostgreSQL, Prisma ORM, Redis, Docker, Nginx, GitHub Actions

---

## 1. Tổng Quan Dự Án & Bộ Công Nghệ

Dự án **Corporate LMS** hướng tới số hóa toàn bộ quy trình đào tạo nội bộ và đánh giá năng lực nhân viên cho NovaTech Solutions, thay thế phương thức quản lý thủ công bằng bảng tính.

- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS)
- **Backend:** NestJS (Modular Monolith, TypeScript)
- **Database & ORM:** PostgreSQL + Prisma ORM
- **Cache & Memory:** Redis
- **Containerization & Proxy:** Docker, Docker Compose & Nginx Reverse Proxy
- **CI/CD:** GitHub Actions (`.github/workflows/ci.yml`)
- **Testing:** Playwright (E2E tests) & Jest (unit tests)

---

## 2. Phân Công Vai Trò Dự Án

| Vai trò | Thành viên phụ trách | Nhiệm vụ chính trong tuần 1 và dự án |
| --- | --- | --- |
| **BA / Full-stack Lead** | **Đức Huy** | Quản lý dự án, viết SRS, thiết kế và phê duyệt CSDL (ERD), kiến trúc hệ thống. |
| **Backend Developer** | **Quang Hưng** | Khởi tạo NestJS, thiết lập Prisma ORM với PostgreSQL, phát triển RESTful API. |
| **Frontend Developer** | **Thanh Trọng** | Khởi tạo Next.js, dựng UI/UX (Figma/mockup), phát triển giao diện với mock data. |
| **Assessment Developer** | **Ngọc Trâm** | Thiết kế module quiz, ngân hàng câu hỏi, logic chấm điểm và ma trận năng lực. |
| **QA / DevOps / Integration** | **Minh Tân** | Cấu hình Docker Compose, thiết lập GitHub repository, branch protection và CI/CD pipeline. |

---

## 3. Cấu Trúc Phân Nhánh (Git Flow)

Hệ thống áp dụng Git Flow tinh gọn. Trên GitHub, **`main` là default branch** và giữ phiên bản production/demo; **`develop`** là nhánh tích hợp của nhóm. Không push trực tiếp vào hai nhánh này.

| Loại nhánh | Tạo từ | Mục đích | Nhánh đích của PR |
| --- | --- | --- | --- |
| **`feature/<ten-tinh-nang>`** | `develop` | Phát triển tính năng, ví dụ `feature/login-ui`. | `develop` |
| **`bugfix/<ten-loi>`** | `develop` | Sửa lỗi phát hiện trong quá trình phát triển/tích hợp. | `develop` |
| **`docs/<pham-vi>`** | `develop` | Cập nhật README hoặc tài liệu, ví dụ `docs/update-readme`. | `develop` |
| **`release/<version>`** | `develop` | Ổn định và kiểm thử phiên bản trước demo/phát hành; chỉ tạo khi cần. | `main` |
| **`hotfix/<ten-loi>`** | `main` | Sửa lỗi khẩn cấp ảnh hưởng production/demo. | `main`, sau đó đồng bộ bản sửa về `develop` |

Sau khi release được gộp vào `main`, mọi sửa đổi phát sinh trong quá trình ổn định release phải được đưa lại vào `develop` qua PR. Nhánh feature, bugfix, docs, release và hotfix nên được xóa sau khi PR liên quan đã hoàn tất.

---

## 4. Quy Định Bảo Vệ Nhánh

Cả hai nhánh **`main`** và **`develop`** được bảo vệ trên GitHub:

1. **Chặn push trực tiếp:** Mọi thay đổi phải đi qua Pull Request (PR); không push trực tiếp vào `main` hoặc `develop`.
2. **Yêu cầu review và approval:** Cần ít nhất một approval từ thành viên khác có quyền ghi trước khi merge.
3. **Hủy approval cũ:** Nếu có commit mới được push lên PR, approval cũ sẽ bị hủy để yêu cầu review lại (Dismiss stale approvals).
4. **CI phải thành công:** Các kiểm tra bắt buộc từ GitHub Actions phải pass trước khi merge.
5. **Cập nhật nhánh đích:** PR phải đồng bộ với phiên bản mới nhất của nhánh đích trước khi merge.

---

## 5. Quy Trình Làm Việc Hàng Ngày

### Bước 1: Cập nhật `develop` và tạo nhánh công việc

```bash
git switch develop
git pull origin develop
git switch -c feature/chuc-nang-cua-ban
```

Thay `feature/chuc-nang-cua-ban` bằng loại nhánh phù hợp, như `bugfix/loi-dang-nhap` hoặc `docs/update-readme`. Nhánh `release/<version>` cũng được tạo từ `develop`; riêng `hotfix/<ten-loi>` phải được tạo từ `main`.

### Bước 2: Lập trình và commit code

```bash
git status
git add .
git commit -m "feat: bổ sung giao diện đăng nhập dạng mock data"
```

Quy ước commit message:

- `feat:` thêm tính năng mới.
- `fix:` sửa lỗi.
- `docs:` cập nhật tài liệu.
- `style:` chỉnh định dạng, không đổi logic.
- `refactor:` cải thiện cấu trúc code.

### Bước 3: Đẩy nhánh cá nhân lên GitHub

```bash
git push -u origin feature/chuc-nang-cua-ban
```

### Bước 4: Tạo Pull Request

1. Truy cập repository trên GitHub và chọn **Compare & pull request**.
2. Chọn nhánh đích theo quy tắc ở mục 3: feature/bugfix/docs vào `develop`; release/hotfix vào `main`.
3. Mô tả ngắn gọn các thay đổi trong PR và chọn reviewer phù hợp.

### Bước 5: Kiểm tra và merge

- Đảm bảo GitHub Actions CI pass và PR có ít nhất một approval.
- Chọn **Squash and merge** vào đúng nhánh đích.
- Với hotfix, sau khi PR vào `main` được merge, tạo PR đưa cùng bản sửa về `develop`.
- Xóa nhánh công việc trên GitHub sau khi các PR liên quan đã merge.

---

## 6. Quy Trình Kiểm Thử Tự Động (CI)

GitHub Actions workflow tại `.github/workflows/ci.yml` chạy khi có push hoặc Pull Request vào `main` hay `develop`.

- **Môi trường:** Ubuntu latest, Node.js 20.
- **Frontend:** Nếu thư mục `frontend` tồn tại, cài dependencies bằng `npm install` và chạy `npm run lint --if-present`.
- **Backend:** Nếu thư mục `backend` tồn tại, cài dependencies bằng `npm install` và chạy `npm run build --if-present`.

---

## 7. Hướng Dẫn Cài Đặt & Chạy Docker Local (4 Container)

Hệ thống sử dụng **Docker Compose** (`docker-compose.yml`) để chạy đồng bộ **4 container** trên máy cá nhân: **PostgreSQL 16** (`lms_postgres`), **Redis 7** (`lms_redis`), **Backend NestJS** (`lms_backend`) và **Frontend Next.js** (`lms_frontend`).

| Dịch vụ | Container | Image / Build | Cổng Local | Vai trò |
| --- | --- | --- | --- | --- |
| `postgres` | `lms_postgres` | `postgres:16-alpine` | `5432` | Cơ sở dữ liệu quan hệ chính (17 bảng Prisma) |
| `redis` | `lms_redis` | `redis:7-alpine` | `6379` | Bộ nhớ đệm (Caching) cho báo cáo và Ma trận năng lực |
| `backend` | `lms_backend` | `./backend/Dockerfile` | `3000` | RESTful API NestJS (`/api/v1/*`) & Swagger UI |
| `frontend` | `lms_frontend` | `./frontend/Dockerfile` | `3001` | Giao diện WebApp Next.js (App Router) |

### Bước 1: Bật Docker Desktop
Mở phần mềm **Docker Desktop** trên máy tính và đợi biểu tượng góc dưới màn hình báo đang chạy (*Engine running*).

### Bước 2: Khởi chạy toàn bộ 4 container (hoặc chỉ DB & Redis)
Mở Terminal tại thư mục gốc của dự án và chọn một trong hai cách:

- **Chạy trọn bộ 4 container:**
```bash
docker compose up -d --build
```

- **Chỉ chạy Database & Redis** (khi cần chạy code Backend/Frontend trực tiếp trên máy để debug):
```bash
docker compose up -d postgres redis
```

### Bước 3: Kiểm tra trạng thái
Chạy lệnh sau để kiểm tra:

```bash
docker compose ps
```
Nếu thấy các container `lms_postgres`, `lms_redis`, `lms_backend` hiện **`Up (healthy)`** và `lms_frontend` hiện **`Up`** là đã chạy thành công.

### Bước 4: Thông tin kết nối Database (Dành cho Backend Prisma ORM khi chạy local)
Copy dòng dưới đây vào file `backend/.env` khi chạy Backend trực tiếp trên máy:

```env
DATABASE_URL="postgresql://lms_user:lms_password@localhost:5432/corporate_lms?schema=public"
REDIS_URL="redis://localhost:6379"
```

Chạy migration và nạp dữ liệu mẫu (Master Seed Data):
```bash
cd backend
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

### Đường dẫn truy cập Local Dev
- **Frontend WebApp:** `http://localhost:3001`
- **Backend Healthcheck:** `http://localhost:3000/api/v1/health`
- **Swagger API Docs:** `http://localhost:3000/api/docs`

### Lệnh tắt Docker khi nghỉ làm việc
```bash
docker compose stop
```

---

## 8. Triển Khai Môi Trường Staging v1.0 (Docker Compose + Nginx Reverse Proxy)

Môi trường **Staging v1.0** (`docker-compose.staging.yml`) đóng gói **5 container** độc lập trong mạng nội bộ `lms_staging_net` (`lms_staging_postgres`, `lms_staging_redis`, `lms_staging_backend`, `lms_staging_frontend`, `lms_staging_nginx`). Các cổng dịch vụ nội bộ được cô lập hoàn toàn và chỉ mở duy nhất cổng truy cập qua **Nginx Reverse Proxy** (mặc định `8080`, có sẵn mẫu cấu hình HTTPS/TLS cổng `443` tại `nginx/nginx.conf`).

### Bước 1: Tạo tệp biến môi trường (tùy chọn)
```bash
cp .env.staging.example .env.staging
```
*(Nếu không tạo `.env.staging`, hệ thống tự sử dụng các giá trị mặc định trong `docker-compose.staging.yml`.)*

### Bước 2: Build và khởi chạy 5 container Staging
```bash
docker compose -f docker-compose.staging.yml up -d --build
docker compose -f docker-compose.staging.yml ps
```
Đảm bảo toàn bộ 5 container (`lms_staging_postgres`, `lms_staging_redis`, `lms_staging_backend`, `lms_staging_frontend`, `lms_staging_nginx`) đều đạt trạng thái **`Up (healthy)`**.

### Bước 3: Nạp Master Seed Data vào CSDL Staging
```bash
docker compose -f docker-compose.staging.yml exec backend npx tsx prisma/seed.ts
```
- **Chỉ tiêu dữ liệu sau khi seed:** `4 roles`, `100 users`, `5 learning_paths`, `20 courses`, `230 questions`, `200 competency_matrix`.
- **Mật khẩu tài khoản demo:** `Password123!` (ví dụ: `admin@novatech.com`, `hr@novatech.com`, `trainer@novatech.com`, `fresher.java@novatech.com`).

### Bước 4: Đường dẫn truy cập qua Nginx Reverse Proxy
- **Ứng dụng Web (Frontend):** `http://localhost:8080`
- **Healthcheck Nginx:** `http://localhost:8080/nginx-health`
- **Healthcheck Backend API:** `http://localhost:8080/api/v1/health`
- **Tài liệu Swagger UI:** `http://localhost:8080/api/docs`

### Dừng môi trường Staging
```bash
docker compose -f docker-compose.staging.yml down
```