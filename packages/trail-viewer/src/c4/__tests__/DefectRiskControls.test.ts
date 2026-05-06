import { computeDefectRiskWindowLabel, DEFAULT_DEFECT_RISK_VALUE } from '../components/overlays/DefectRiskControls';

describe('computeDefectRiskWindowLabel', () => {
  it('returns "30d" for 30', () => {
    expect(computeDefectRiskWindowLabel(30)).toBe('30d');
  });
  it('returns "All" for 365', () => {
    expect(computeDefectRiskWindowLabel(365)).toBe('All');
  });
});

describe('DEFAULT_DEFECT_RISK_VALUE', () => {
  it('has enabled=false by default', () => {
    expect(DEFAULT_DEFECT_RISK_VALUE.enabled).toBe(false);
  });
});
