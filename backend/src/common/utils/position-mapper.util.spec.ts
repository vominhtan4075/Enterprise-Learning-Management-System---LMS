import { describe, it, expect } from '@jest/globals';
import { PositionMapper } from './position-mapper.util.js';
import { PositionLevel } from '../../generated/prisma/client.js';

describe('PositionMapper (WP4 4.5)', () => {
  it('1. Map "Tech Lead" -> LEAD', () => {
    expect(PositionMapper.map('Tech Lead')).toBe(PositionLevel.LEAD);
  });

  it('2. Map "Team Lead Backend" -> LEAD', () => {
    expect(PositionMapper.map('Team Lead Backend')).toBe(PositionLevel.LEAD);
  });

  it('3. Map "LEAD" (chữ hoa) -> LEAD', () => {
    expect(PositionMapper.map('LEAD')).toBe(PositionLevel.LEAD);
  });

  it('4. Map "Senior Software Engineer" -> SENIOR', () => {
    expect(PositionMapper.map('Senior Software Engineer')).toBe(
      PositionLevel.SENIOR,
    );
  });

  it('5. Map "senior frontend developer" -> SENIOR', () => {
    expect(PositionMapper.map('senior frontend developer')).toBe(
      PositionLevel.SENIOR,
    );
  });

  it('6. Map "Junior Java Developer" -> JUNIOR', () => {
    expect(PositionMapper.map('Junior Java Developer')).toBe(
      PositionLevel.JUNIOR,
    );
  });

  it('7. Map "Fresher Backend Java" -> FRESHER', () => {
    expect(PositionMapper.map('Fresher Backend Java')).toBe(
      PositionLevel.FRESHER,
    );
  });

  it('8. Map "Intern QA Engineer" -> INTERN', () => {
    expect(PositionMapper.map('Intern QA Engineer')).toBe(
      PositionLevel.INTERN,
    );
  });

  it('9. Map chuỗi không khớp (Unknown Role) -> null', () => {
    expect(PositionMapper.map('Giám đốc tài chính')).toBeNull();
  });

  it('10. Map chuỗi rỗng hoặc chỉ có khoảng trắng -> null', () => {
    expect(PositionMapper.map('')).toBeNull();
    expect(PositionMapper.map('   ')).toBeNull();
  });

  it('11. Map null / undefined -> null', () => {
    expect(PositionMapper.map(null)).toBeNull();
    expect(PositionMapper.map(undefined)).toBeNull();
  });

  it('12. mapWithFallback với chuỗi hợp lệ -> trả về giá trị đã map', () => {
    expect(
      PositionMapper.mapWithFallback(
        'Senior QA',
        PositionLevel.FRESHER,
      ),
    ).toBe(PositionLevel.SENIOR);
  });

  it('13. mapWithFallback với chuỗi không khớp -> trả về fallback được chỉ định', () => {
    expect(
      PositionMapper.mapWithFallback('Khách mời', PositionLevel.INTERN),
    ).toBe(PositionLevel.INTERN);
  });
});

