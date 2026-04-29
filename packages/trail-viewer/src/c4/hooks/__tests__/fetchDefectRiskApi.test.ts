import { buildDefectRiskUrl } from '../fetchDefectRiskApi';

describe('buildDefectRiskUrl', () => {
  it('builds URL with required params', () => {
    const url = buildDefectRiskUrl('http://localhost:3000', { windowDays: 90, halfLifeDays: 90 });
    expect(url).toBe('http://localhost:3000/api/defect-risk?windowDays=90&halfLifeDays=90');
  });

  it('defaults apply when params omitted', () => {
    const url = buildDefectRiskUrl('http://localhost:3000', {});
    expect(url).toContain('/api/defect-risk');
    expect(url).toContain('windowDays=');
    expect(url).toContain('halfLifeDays=');
  });
});
