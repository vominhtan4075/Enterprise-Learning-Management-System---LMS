export const PositionEnum = {
  INTERN: 'INTERN',
  FRESHER: 'FRESHER',
  JUNIOR: 'JUNIOR',
  SENIOR: 'SENIOR',
  LEAD: 'LEAD',
} as const;

export type PositionEnum = (typeof PositionEnum)[keyof typeof PositionEnum];

export type CompetencyStatus = 'PASSED' | 'GAP' | 'NOT_ASSESSED';
export type CompetencyLevel = 'ADVANCED' | 'PROFICIENT' | 'NEEDS_IMPROVEMENT' | 'UNRATED';

export const POSITION_REQUIRED_SCORES: Record<PositionEnum, number> = {
  [PositionEnum.INTERN]: 60.0,
  [PositionEnum.FRESHER]: 70.0,
  [PositionEnum.JUNIOR]: 75.0,
  [PositionEnum.SENIOR]: 85.0,
  [PositionEnum.LEAD]: 90.0,
};

export const ALL_POSITIONS: PositionEnum[] = [
  PositionEnum.INTERN,
  PositionEnum.FRESHER,
  PositionEnum.JUNIOR,
  PositionEnum.SENIOR,
  PositionEnum.LEAD,
];

export const COMPETENCY_CACHE_TTL_SECONDS = 900; // 15 phút
export const COMPETENCY_CACHE_PREFIX = 'competency:matrix';

/**
 * Quy tắc gom nhóm tiêu đề Module/Course về danh mục kỹ năng chuẩn của NovaTech
 */
export const SKILL_TAXONOMY_RULES: Array<{ keywords: string[]; canonicalSkill: string }> = [
  {
    keywords: ['java', 'spring boot', 'oop', 'collection'],
    canonicalSkill: 'Java Core & Spring Boot',
  },
  {
    keywords: ['postgres', 'postgresql', 'sql', 'prisma', 'database', 'restful'],
    canonicalSkill: 'PostgreSQL & RESTful API',
  },
  {
    keywords: ['microservice', 'microservices', 'kafka'],
    canonicalSkill: 'Microservices, Redis & Docker',
  },
  {
    keywords: ['react', 'next.js', 'nextjs', 'frontend', 'tailwind'],
    canonicalSkill: 'React & Next.js Frontend',
  },
  {
    keywords: ['cloud', 'aws', 'gcp', 'azure', 'kubernetes', 'k8s', 'terraform'],
    canonicalSkill: 'Cloud Infrastructure & DevOps',
  },
  {
    keywords: ['security', 'bảo mật', 'owasp', 'jwt', 'oauth', 'rbac', 'xss', 'csrf'],
    canonicalSkill: 'Application Security & Auth',
  },
  {
    keywords: ['playwright', 'jest', 'testing', 'ci/cd', 'github actions'],
    canonicalSkill: 'Automated Testing & CI/CD',
  },
];

/**
 * Làm tròn 2 chữ số thập phân, tránh lỗi làm tròn 1 chữ số (69.99 -> 70.0) và sai số float JS
 */
export function roundScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeSkillName(moduleTitle: string): string {
  if (!moduleTitle || !moduleTitle.trim()) {
    return 'General Engineering';
  }

  const cleaned = moduleTitle
    .replace(/^(Học phần|Module|Chương|Part|Section)\s*\d+\s*[:\-–.]\s*/i, '')
    .trim();

  const lower = cleaned.toLowerCase();
  for (const rule of SKILL_TAXONOMY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.canonicalSkill;
    }
  }

  return cleaned || 'General Engineering';
}

export function evaluateCompetency(
  score: number | null,
  position: PositionEnum,
): {
  requiredScore: number;
  status: CompetencyStatus;
  level: CompetencyLevel;
  gapDelta: number;
} {
  const requiredScore = POSITION_REQUIRED_SCORES[position] ?? 70.0;

  if (score === null || score === undefined) {
    return {
      requiredScore,
      status: 'NOT_ASSESSED',
      level: 'UNRATED',
      gapDelta: roundScore(-requiredScore),
    };
  }

  const roundedScore = roundScore(score);
  const isPassed = roundedScore >= requiredScore;
  const advancedThreshold = Math.min(97.0, requiredScore + 15.0);

  let level: CompetencyLevel = 'NEEDS_IMPROVEMENT';
  if (roundedScore >= advancedThreshold) {
    level = 'ADVANCED';
  } else if (isPassed) {
    level = 'PROFICIENT';
  }

  return {
    requiredScore,
    status: isPassed ? 'PASSED' : 'GAP',
    level,
    gapDelta: roundScore(roundedScore - requiredScore),
  };
}