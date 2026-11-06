# Hướng Dẫn Chạy Backend Corporate LMS 
Tài liệu hướng dẫn nhanh dành cho các thành viên trong nhóm để cài đặt, khởi tạo CSDL và chạy Backend 

---

## Yêu cầu chuẩn bị
- Máy đã cài **Node.js 20+**
- Đã bật sẵn ứng dụng **Docker Desktop**

---

## Các bước thực hiện

### Bước 1: Bật Database (PostgreSQL & Redis) bằng Docker
Mở Terminal tại **thư mục gốc của dự án** (`Enterprise-Learning-Management-System---LMS`) và chạy:

```bash
docker compose up -d
```

---

### Bước 2: Vào thư mục `backend` và cài đặt thư viện

```bash
cd backend
npm install
```

---

### Bước 3: Tạo file `.env`
Tạo file tên là **`.env`** nằm trong thư mục `backend/` (cùng cấp với `package.json`) và dán nội dung sau vào:

```env
DATABASE_URL="postgresql://lms_user:lms_password@localhost:5432/corporate_lms?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=5000
SEED_DEMO_PASSWORD="Password123!"
```

---

### Bước 4: Tạo bảng Database & Đổ dữ liệu mẫu (100 tài khoản, 20 khóa học, 200 câu hỏi, 5 lộ trình)
Chạy lần lượt 3 lệnh sau trong thư mục `backend/`:

```bash
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

> **Lưu ý:** Nếu máy bạn từng chạy bản Database cũ và báo lỗi xung đột bảng, hãy chạy lệnh `npx prisma migrate reset --force` rồi chạy lại `npm run db:seed`.

---

### Bước 5: Chạy Server Backend

```bash
npm run start:dev
```

Khi màn hình hiện thông báo khởi chạy thành công, bạn có thể mở trình duyệt truy cập:
- **Swagger UI (Xem & Test API trực tiếp):** `http://localhost:5000/api/docs`
- **Kiểm tra kết nối (Healthcheck):** `http://localhost:5000/api/v1/health`

---

## Tài khoản mẫu để đăng nhập & test (Mật khẩu chung: `Password123!`)

| Vai trò | Email | Cấp bậc |
| :--- | :--- | :--- |
| **Admin** | `admin@novatech.com` | `LEAD` |
| **HR** | `hr@novatech.com` | `SENIOR` |
| **Trainer** | `trainer@novatech.com` | `SENIOR` |
| **Employee (Fresher)** | `fresher.java@novatech.com` | `FRESHER` |
| **Employee (Junior)** | `huan.nguyen@novatech.com` | `JUNIOR` |

---

## Kiểm tra trước khi Push code / Tạo Pull Request
Trước khi đẩy code lên GitHub, chạy 3 lệnh sau để đảm bảo không bị lỗi trên CI:

```bash
npm run lint
npm test
npm run build
```
