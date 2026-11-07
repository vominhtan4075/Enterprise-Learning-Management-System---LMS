-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('EMPLOYEE', 'TRAINER', 'HR', 'ADMIN');

-- CreateEnum
CREATE TYPE "PositionLevel" AS ENUM ('INTERN', 'FRESHER', 'JUNIOR', 'SENIOR', 'LEAD');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('VIDEO', 'PDF', 'MARKDOWN');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "EnrollmentSource" AS ENUM ('MANUAL', 'HRM', 'AUTO_ONBOARDING');

-- CreateEnum
CREATE TYPE "QuizType" AS ENUM ('MODULE', 'FINAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('WELCOME', 'ENROLLMENT_ASSIGNED', 'DEADLINE_REMINDER', 'ENROLLMENT_OVERDUE', 'FINAL_FAILED_ALERT', 'QUIZ_PASSED', 'QUIZ_FAILED');

-- CreateEnum
CREATE TYPE "HrmSyncStatus" AS ENUM ('INITIATED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "code" "RoleCode" NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role_id" INTEGER NOT NULL,
    "position" "PositionLevel" NOT NULL,
    "department" TEXT,
    "employee_code" TEXT,
    "job_title" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_by" TEXT NOT NULL,
    "estimated_hours" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "module_order" INTEGER NOT NULL,
    "description" TEXT,
    "day_start" INTEGER,
    "day_end" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_type" "ContentType" NOT NULL,
    "content_url" TEXT NOT NULL,
    "lesson_order" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "content_text" TEXT,
    "file_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "passing_score" DECIMAL(5,2) NOT NULL DEFAULT 70,
    "time_limit_min" INTEGER,
    "quiz_type" "QuizType" NOT NULL DEFAULT 'MODULE',
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correct_answer" TEXT NOT NULL,
    "related_lesson_id" TEXT,
    "skill_name" TEXT,
    "explanation" TEXT,
    "concept_tag" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "is_passed" BOOLEAN NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" TEXT DEFAULT 'SUBMITTED',
    "answers" JSONB,
    "idempotency_key" TEXT,
    "started_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_paths" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target_position" "PositionLevel" NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "estimated_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "path_courses" (
    "id" TEXT NOT NULL,
    "path_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,

    CONSTRAINT "path_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_enrollments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "deadline" TIMESTAMP(3) NOT NULL,
    "assigned_by" TEXT,
    "completed_at" TIMESTAMP(3),
    "progress_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "source" "EnrollmentSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "path_enrollments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "path_id" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "deadline" TIMESTAMP(3) NOT NULL,
    "assigned_by" TEXT,
    "completed_at" TIMESTAMP(3),
    "progress_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "source" "EnrollmentSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "path_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_progresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_progresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_matrices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "skill_name" TEXT NOT NULL,
    "proficiency_score" DECIMAL(5,2) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_matrices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dedupe_key" TEXT,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_sync_logs" (
    "id" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "HrmSyncStatus" NOT NULL,
    "message" TEXT,
    "user_id" TEXT,
    "assigned_path_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hrm_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_code_key" ON "users"("employee_code");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_position_department_idx" ON "users"("position", "department");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE INDEX "modules_course_id_module_order_idx" ON "modules"("course_id", "module_order");

-- CreateIndex
CREATE INDEX "lessons_module_id_lesson_order_idx" ON "lessons"("module_id", "lesson_order");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_module_id_key" ON "quizzes"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_attempts_idempotency_key_key" ON "quiz_attempts"("idempotency_key");

-- CreateIndex
CREATE INDEX "quiz_attempts_user_id_quiz_id_idx" ON "quiz_attempts"("user_id", "quiz_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_paths_code_key" ON "learning_paths"("code");

-- CreateIndex
CREATE UNIQUE INDEX "path_courses_path_id_course_id_key" ON "path_courses"("path_id", "course_id");

-- CreateIndex
CREATE INDEX "course_enrollments_status_deadline_idx" ON "course_enrollments"("status", "deadline");

-- CreateIndex
CREATE INDEX "course_enrollments_assigned_by_idx" ON "course_enrollments"("assigned_by");

-- CreateIndex
CREATE UNIQUE INDEX "course_enrollments_user_id_course_id_key" ON "course_enrollments"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "path_enrollments_status_deadline_idx" ON "path_enrollments"("status", "deadline");

-- CreateIndex
CREATE INDEX "path_enrollments_assigned_by_idx" ON "path_enrollments"("assigned_by");

-- CreateIndex
CREATE UNIQUE INDEX "path_enrollments_user_id_path_id_key" ON "path_enrollments"("user_id", "path_id");

-- CreateIndex
CREATE INDEX "user_progresses_user_id_lesson_id_idx" ON "user_progresses"("user_id", "lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_progresses_user_id_lesson_id_key" ON "user_progresses"("user_id", "lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "competency_matrices_user_id_skill_name_key" ON "competency_matrices"("user_id", "skill_name");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "hrm_sync_logs_created_at_idx" ON "hrm_sync_logs"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_related_lesson_id_fkey" FOREIGN KEY ("related_lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_courses" ADD CONSTRAINT "path_courses_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_courses" ADD CONSTRAINT "path_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_enrollments" ADD CONSTRAINT "path_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_enrollments" ADD CONSTRAINT "path_enrollments_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_enrollments" ADD CONSTRAINT "path_enrollments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progresses" ADD CONSTRAINT "user_progresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progresses" ADD CONSTRAINT "user_progresses_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_matrices" ADD CONSTRAINT "competency_matrices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- CHECK CONSTRAINTS (Section 4.4 - Plan v4)
-- =============================================================================

-- quizzes
ALTER TABLE "quizzes" ADD CONSTRAINT "chk_quizzes_passing_score" CHECK ("passing_score" BETWEEN 70 AND 100);
ALTER TABLE "quizzes" ADD CONSTRAINT "chk_quizzes_time_limit_min" CHECK ("time_limit_min" IS NULL OR "time_limit_min" > 0);
ALTER TABLE "quizzes" ADD CONSTRAINT "chk_quizzes_max_attempts" CHECK ("max_attempts" > 0);

-- courses
ALTER TABLE "courses" ADD CONSTRAINT "chk_courses_estimated_hours" CHECK ("estimated_hours" >= 0);

-- lessons
ALTER TABLE "lessons" ADD CONSTRAINT "chk_lessons_duration_minutes" CHECK ("duration_minutes" >= 0);
ALTER TABLE "lessons" ADD CONSTRAINT "chk_lessons_lesson_order" CHECK ("lesson_order" > 0);

-- modules
ALTER TABLE "modules" ADD CONSTRAINT "chk_modules_module_order" CHECK ("module_order" > 0);
ALTER TABLE "modules" ADD CONSTRAINT "chk_modules_day_range" CHECK (
    ("day_start" IS NULL OR "day_start" > 0) AND 
    ("day_end" IS NULL OR "day_start" IS NULL OR "day_end" >= "day_start")
);

-- path_courses
ALTER TABLE "path_courses" ADD CONSTRAINT "chk_path_courses_step_order" CHECK ("step_order" > 0);

-- course_enrollments
ALTER TABLE "course_enrollments" ADD CONSTRAINT "chk_course_enrollments_progress" CHECK ("progress_percentage" BETWEEN 0 AND 100);

-- path_enrollments
ALTER TABLE "path_enrollments" ADD CONSTRAINT "chk_path_enrollments_progress" CHECK ("progress_percentage" BETWEEN 0 AND 100);

-- quiz_attempts
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "chk_quiz_attempts_score" CHECK ("score" BETWEEN 0 AND 100);

