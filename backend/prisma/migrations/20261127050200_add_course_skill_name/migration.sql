-- AlterTable
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "skill_name" TEXT;

-- Backfill existing courses from their quiz questions' skill_name if available
UPDATE "courses" c
SET "skill_name" = sub."skill_name"
FROM (
  SELECT DISTINCT ON (m."course_id")
    m."course_id",
    q."skill_name"
  FROM "modules" m
  JOIN "quizzes" qz ON qz."module_id" = m."id"
  JOIN "questions" q ON q."quiz_id" = qz."id"
  WHERE q."skill_name" IS NOT NULL
    AND TRIM(q."skill_name") <> ''
    AND q."deleted_at" IS NULL
  ORDER BY m."course_id", m."module_order" ASC
) sub
WHERE c."id" = sub."course_id"
  AND c."skill_name" IS NULL;
