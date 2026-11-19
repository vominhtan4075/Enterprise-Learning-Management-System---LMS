export const PositionEnum = {
  INTERN: 'INTERN',
  FRESHER: 'FRESHER',
  JUNIOR: 'JUNIOR',
  SENIOR: 'SENIOR',
  LEAD: 'LEAD',
} as const;

export type PositionEnum = (typeof PositionEnum)[keyof typeof PositionEnum];

export type CompetencyStatus = 'PASSED' | 'GAP';
export type CompetencyLevel = 'ADVANCED' | 'PROFICIENT' | 'NEEDS_IMPROVEMENT';

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

export function normalizeSkillName(moduleTitle: string): string {
  return moduleTitle.replace(/^(Học phần|Module)\s*\d+\s*[:\-–]\s*/i, '').trim();
}

export function evaluateCompetency(
  score: number,
  position: PositionEnum,
): {
  requiredScore: number;
  status: CompetencyStatus;
  level: CompetencyLevel;
  gapDelta: number;
} {
  const requiredScore = POSITION_REQUIRED_SCORES[position] ?? 70.0;
  const roundedScore = Math.round(score * 10) / 10;
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
    gapDelta: Math.round((roundedScore - requiredScore) * 10) / 10,
  };
}