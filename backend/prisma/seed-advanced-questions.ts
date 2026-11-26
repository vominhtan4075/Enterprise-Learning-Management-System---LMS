import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

interface AdvancedQuizSeedItem {
  moduleOrder: number;
  moduleTitle: string;
  quizTitle: string;
  passingScore: number;
  timeLimitMinutes: number;
  questions: Array<{
    questionText: string;
    questionType?: string;
    options: Array<{ key: string; text: string }>;
    correctAnswer: string;
    explanation?: string;
    relatedLessonTopic?: string;
  }>;
}

const TARGET_QUIZ_MAPPING: Record<
  number,
  { moduleId: string; quizId: string; skillName: string }
> = {
  6: {
    moduleId: 'module-JUNIOR_CLEAN_01-1',
    quizId: 'quiz-module-JUNIOR_CLEAN_01-1',
    skillName: 'React & Next.js Frontend',
  },
  7: {
    moduleId: 'module-SENIOR_ARCH_03-1',
    quizId: 'quiz-module-SENIOR_ARCH_03-1',
    skillName: 'Cloud & Kubernetes',
  },
  8: {
    moduleId: 'module-SENIOR_ARCH_04-1',
    quizId: 'quiz-module-SENIOR_ARCH_04-1',
    skillName: 'Performance & Security',
  },
};

function resolveSeedJsonPath(): string | undefined {
  const candidates = [
    path.resolve(process.cwd(), 'prisma', 'advanced-quiz-seed.json'),
    path.resolve(process.cwd(), 'backend', 'prisma', 'advanced-quiz-seed.json'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

export async function seedAdvancedQuestions(prisma: PrismaClient): Promise<number> {
  const seedJsonPath = resolveSeedJsonPath();

  if (!seedJsonPath) {
    console.warn('⚠️ Không tìm thấy file advanced-quiz-seed.json, bỏ qua bước nạp câu hỏi nâng cao.');
    return 0;
  }

  const raw = fs.readFileSync(seedJsonPath, 'utf-8');
  const advancedModules: AdvancedQuizSeedItem[] = JSON.parse(raw);

  let upsertedCount = 0;

  for (const modItem of advancedModules) {
    const target = TARGET_QUIZ_MAPPING[modItem.moduleOrder];
    if (!target) continue;

    const quiz = await prisma.quiz.findUnique({
      where: { id: target.quizId },
      select: { id: true },
    });

    if (!quiz) {
      console.warn(
        `⚠️ Chưa tồn tại Quiz "${target.quizId}" trong DB. Hãy chạy seed gốc trước.`,
      );
      continue;
    }

    const lessons = await prisma.lesson.findMany({
      where: { moduleId: target.moduleId },
      orderBy: { lessonOrder: 'asc' },
      select: { id: true },
    });

    for (let idx = 0; idx < modItem.questions.length; idx += 1) {
      const q = modItem.questions[idx];
      const questionId = `${target.quizId}-adv-${idx + 1}`;
      const relatedLessonId =
        lessons.length > 0 ? lessons[idx % lessons.length].id : null;
      const explanation =
        q.explanation ??
        `Ôn tập chuyên đề: ${q.relatedLessonTopic ?? target.skillName}.`;

      await prisma.question.upsert({
        where: { id: questionId },
        update: {
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation,
          skillName: target.skillName,
          relatedLessonId,
        },
        create: {
          id: questionId,
          quizId: target.quizId,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation,
          skillName: target.skillName,
          relatedLessonId,
        },
      });

      upsertedCount += 1;
    }
  }

  console.log(
    `✅ Đã nạp/cập nhật ${upsertedCount} câu hỏi nâng cao (React, Cloud, Security).`,
  );
  return upsertedCount;
}

const entryScript = process.argv[1] ?? '';
const isDirectRun =
  entryScript.endsWith('seed-advanced-questions.ts') ||
  entryScript.endsWith('seed-advanced-questions.js');

if (isDirectRun) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  seedAdvancedQuestions(prisma)
    .catch((error) => {
      console.error('❌ Lỗi khi nạp câu hỏi nâng cao:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}