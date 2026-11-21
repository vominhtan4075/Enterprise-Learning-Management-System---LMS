import { test } from '@playwright/test';

test.describe('Corporate LMS E2E - Dashboard Admin & Báo cáo Thống kê (Tuần 4)', () => {
  test.fixme(
    'TC07 - [UAT-SEC-02] Chặn vai trò EMPLOYEE gọi GET /api/v1/reports/company bằng HTTP 403 Forbidden',
    async () => {
      // TODO(Tuần 4 - chờ SV02 Quang Hưng): Kích hoạt sau khi module Reports
      // và endpoint GET /api/v1/reports/company được merge vào nhánh develop.
      // Lưu ý: Cần xác nhận thêm với Lead về RolesGuard (ADMIN/HR vs ADMIN/TRAINER).
    },
  );

  test.fixme(
    'TC08 - [UAT-REP-01] Admin/HR xem báo cáo toàn công ty và xuất file CSV chuẩn UTF-8 BOM',
    async () => {
      // TODO(Tuần 4 - chờ SV02 Quang Hưng & SV03 Thanh Trọng):
      // 1. Gọi GET /api/v1/reports/company kiểm tra summary (totalEmployees, activeCourses, avgCompletionRate, avgScore).
      // 2. Gọi endpoint xuất CSV (chờ Lead chốt GET /api/v1/reports/company?format=csv
      //    hay GET /api/v1/reports/competency-matrix/export) và xác minh 3 byte đầu UTF-8 BOM (0xEF, 0xBB, 0xBF).
    },
  );

  test.fixme(
    'TC09 - [UAT-REP-02] Admin/HR truy xuất Ma trận Năng lực (GET /api/v1/reports/competency-matrix)',
    async () => {
      // TODO(Tuần 4 - chờ SV02 Quang Hưng & SV04 Ngọc Trâm):
      // Kích hoạt sau khi API /api/v1/reports/competency-matrix và logic tính điểm kỹ năng 5 cấp bậc được merge.
      // Xác minh dữ liệu trả về có danh sách skills, employees và trạng thái PASSED / GAP.
    },
  );

  test.fixme(
    'TC10 - [UAT-HRM-01] Admin xem nhật ký đồng bộ HRM Sync Logs và giao diện Dashboard Báo cáo',
    async () => {
      // TODO(Tuần 4 - chờ Lead chốt route & SV02 Quang Hưng, SV03 Thanh Trọng):
      // 1. Gọi API xem log đồng bộ HRM (chờ chốt GET /api/v1/hrm/logs hay GET /api/v1/reports/hrm-sync-logs).
      // 2. Kiểm tra màn hình /admin/reports và /hr/competency-matrix trên Frontend khi hoàn thiện.
    },
  );
});