import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDate(value?: string): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  async getDashboard(query: { from?: string; to?: string }) {
    const from = this.parseDate(query.from);
    const to = this.parseDate(query.to);

    const createdAt = from || to
      ? {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      : undefined;

    const [totalUsers, activeCourses, completedEnrollments, totalEnrollments, averageAttempt, courseRows, attempts, recentActivities] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.course.count({ where: { isPublished: true, deletedAt: null } }),
      this.prisma.courseEnrollment.count({ where: { status: 'COMPLETED', ...(createdAt ? { createdAt } : {}) } }),
      this.prisma.courseEnrollment.count({ where: createdAt ? { createdAt } : {} }),
      this.prisma.quizAttempt.aggregate({
        _avg: { score: true },
        where: createdAt ? { createdAt } : {},
      }),
      this.prisma.course.findMany({
        where: { isPublished: true, deletedAt: null },
        select: {
          id: true,
          title: true,
          courseEnrollments: {
            select: { status: true, progressPercentage: true },
            ...(createdAt ? { where: { createdAt } } : {}),
          },
        },
        take: 8,
      }),
      this.prisma.quizAttempt.findMany({
        select: { score: true },
        where: createdAt ? { createdAt } : {},
      }),
      this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, title: true, type: true, createdAt: true },
        ...(createdAt ? { where: { createdAt } } : {}),
      }),
    ]);

    const completionRate = totalEnrollments
      ? Math.round((completedEnrollments / totalEnrollments) * 1000) / 10
      : 0;

    const averageScore = Number(averageAttempt._avg.score ?? 0);

    const scoreRanges = [
      { label: 'Xuất sắc · 85–100', min: 85, max: 100, count: 0, color: 'bg-emerald-500' },
      { label: 'Đạt chuẩn · 70–84', min: 70, max: 84.999, count: 0, color: 'bg-blue-500' },
      { label: 'Cần cải thiện · 60–69', min: 60, max: 69.999, count: 0, color: 'bg-amber-500' },
      { label: 'Khoảng trống · <60', min: 0, max: 59.999, count: 0, color: 'bg-rose-500' },
    ];

    for (const attempt of attempts) {
      const score = Number(attempt.score);
      const range = scoreRanges.find((item) => score >= item.min && score <= item.max);
      if (range) range.count += 1;
    }

    const courseCompletion = courseRows.map((course) => {
      const values = course.courseEnrollments.map((enrollment) => Number(enrollment.progressPercentage));
      const value = values.length
        ? Math.round((values.reduce((sum, item) => sum + item, 0) / values.length) * 10) / 10
        : 0;
      return { name: course.title, value };
    });

    return {
      stats: {
        totalUsers,
        activeCourses,
        completionRate,
        averageScore: Math.round(averageScore * 10) / 10,
      },
      scoreDistribution: scoreRanges.map(({ label, count, color }) => ({ label, value: count, color })),
      courseCompletion,
      activities: recentActivities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        time: activity.createdAt,
        type: activity.type === 'QUIZ_PASSED' || activity.type === 'QUIZ_FAILED' ? 'assessment' : 'system',
      })),
      period: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
    };
  }

  async getCompetencyMatrix(query: { department?: string; position?: string }) {
    const where = {
      deletedAt: null,
      ...(query.department ? { department: query.department } : {}),
      ...(query.position ? { position: query.position as never } : {}),
    };

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        department: true,
        position: true,
        competencyMatrices: {
          select: { skillName: true, proficiencyScore: true },
          orderBy: { skillName: 'asc' },
        },
      },
    });

    const skillNames = await this.prisma.competencyMatrix.findMany({
      distinct: ['skillName'],
      select: { skillName: true },
      orderBy: { skillName: 'asc' },
    });

    const skills = skillNames.map((item) => item.skillName);
    const matrix = users.map((user) => {
      const scoreBySkill = new Map(
        user.competencyMatrices.map((item) => [item.skillName, Number(item.proficiencyScore)]),
      );
      const scores = skills.map((skill) => scoreBySkill.get(skill) ?? 0);
      const average = scores.length
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : 0;

      return {
        id: user.id,
        name: user.fullName,
        department: user.department ?? 'Chưa cập nhật',
        role: user.position,
        skills,
        scores,
        average: Math.round(average * 10) / 10,
        status: average >= 85 ? 'Xuất sắc' : average >= 70 ? 'Đạt chuẩn' : 'Cần hỗ trợ',
      };
    });

    return { skills, matrix, total: matrix.length };
  }

  async exportCompetencyMatrix(query: { department?: string; position?: string }) {
    const result = await this.getCompetencyMatrix(query);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Competency Matrix');

    sheet.columns = [
      { header: 'Nhân sự', key: 'name', width: 28 },
      { header: 'Phòng ban', key: 'department', width: 24 },
      { header: 'Cấp bậc', key: 'role', width: 16 },
      ...result.skills.map((skill) => ({ header: skill, key: skill, width: 18 })),
      { header: 'Điểm trung bình', key: 'average', width: 18 },
      { header: 'Trạng thái', key: 'status', width: 16 },
    ];

    for (const row of result.matrix) {
      const excelRow: Record<string, unknown> = {
        name: row.name,
        department: row.department,
        role: row.role,
        average: row.average,
        status: row.status,
      };
      result.skills.forEach((skill, index) => {
        excelRow[skill] = row.scores[index] ?? 0;
      });
      sheet.addRow(excelRow);
    }

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'darkGray', fgColor: { argb: 'FF2563EB' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    return workbook.xlsx.writeBuffer();
  }
}
