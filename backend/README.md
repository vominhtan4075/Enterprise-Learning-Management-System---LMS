# Corporate LMS - Backend (NestJS & Prisma ORM)

Dịch vụ Backend cho nền tảng quản lý đào tạo nội bộ Corporate LMS (NovaTech Solutions), phát triển bằng **NestJS (Modular Monolith)**, **TypeScript**, **PostgreSQL** và **Prisma ORM**.

---

## 1. Yêu Cầu Môi Trường

Đảm bảo máy tính đã cài đặt:
- **Node.js**: Phiên bản 20 trở lên.
- **Docker Desktop**: Đang bật để chạy PostgreSQL và Redis.

---

## 2. Hướng Dẫn Cài Đặt & Khởi Chạy

### Bước 1: Khởi động Database & Cache
Mở Terminal tại thư mục gốc của dự án (`Enterprise-Learning-Management-System---LMS`) và chạy:

```bash
docker compose up -d
```
> Kiểm tra bằng lệnh `docker compose ps` thấy `lms_postgres` và `lms_redis` báo **`Up (healthy)`** là thành công.

---

### Bước 2: Cài đặt thư viện
Di chuyển vào thư mục `backend` và cài đặt các dependencies:

```bash
cd backend
npm install
```

---

### Bước 3: Tạo file môi trường (`.env`)
Tạo file **`.env`** ngay trong thư mục `backend/` (hoặc sao chép từ file mẫu `.env.example`):

```env
# Kết nối PostgreSQL Docker Local
DATABASE_URL="postgresql://lms_user:lms_password@localhost:5432/corporate_lms?schema=public"

# Kết nối Redis Local
REDIS_URL="redis://localhost:6379"

# Cổng khởi chạy Backend API
PORT=5000
```

---

### Bước 4: Đồng bộ CSDL & Sinh Prisma Client

```bash
npx prisma migrate dev
npx prisma generate
```

---

### Bước 5: Khởi chạy Server Backend

```bash
npm run start:dev
```

Server sẽ khởi chạy tại: **`http://localhost:5000/api`**  
Giao diện Swagger API Docs: **`http://localhost:5000/api/docs`**

---

## 3. Tài Liệu Swagger UI & Danh Sách API

Truy cập trực tiếp trên trình duyệt: 👉 **`http://localhost:5000/api/docs`** để xem mô tả các Schema và bấm **"Try it out"** test API trực quan.

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/docs` | **Swagger UI**: Giao diện tài liệu và test API trực quan |
| `GET` | `/api/health` | **Healthcheck**: Kiểm tra trạng thái server, kết nối CSDL và CORS |
| `GET` | `/api/users` | Lấy danh sách tất cả người dùng (sắp xếp mới nhất) |
| `POST` | `/api/users` | Tạo người dùng mới (`email`, `fullName`, `role` tùy chọn) |
| `GET` | `/api/users/:id` | Xem chi tiết thông tin một người dùng theo UUID |
| `PATCH` | `/api/users/:id` | Cập nhật thông tin người dùng (`fullName`, `role`,...) |
| `DELETE` | `/api/users/:id` | Xóa người dùng theo UUID |

---

## 4. Kiểm Tra Build Trước Khi Tạo Pull Request

Trước khi push code lên GitHub, hãy chạy lệnh build để đảm bảo đạt chuẩn CI:

```bash
npm run build
```
*(Lệnh này kết thúc êm đẹp với exit code 0 và tạo ra thư mục `dist/` là đạt chuẩn CI).*
