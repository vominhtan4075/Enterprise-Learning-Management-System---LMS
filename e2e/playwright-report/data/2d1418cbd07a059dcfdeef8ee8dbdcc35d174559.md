# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lms-e2e.spec.ts >> Corporate LMS - Kiểm thử E2E Tích hợp Hệ thống Thật (Tuần 2) >> TC04 - [API Thật] Trả về HTTP 400 Bad Request khi gửi thiếu email hoặc fullName vào POST /api/v1/hrm/sync-users
- Location: tests\lms-e2e.spec.ts:72:7

# Error details

```
AggregateError: apiRequestContext.post: connect ECONNREFUSED ::1:3000
connect ECONNREFUSED 127.0.0.1:3000
Call log:
  - → POST http://localhost:3000/api/v1/hrm/sync-users
    - user-agent: Playwright/1.64.1 (x64; windows 10.0) node/22.17
    - accept: application/json
    - accept-encoding: gzip,deflate,br
    - Content-Type: application/json
    - content-length: 74

```