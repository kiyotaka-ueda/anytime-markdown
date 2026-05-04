export type { TrailGraph } from './model/types';
export { trailToC4 } from './transform/toC4';
export { formatLocalDate, formatLocalTime, formatLocalDateTime, toLocalDateKey } from './formatDate';

// Domain layer
export * from './domain';

export type { ManualElement, ManualRelationship, ManualGroup, IManualElementProvider } from './c4/manualTypes';
export { mergeManualIntoC4Model } from './c4/mergeManual';
export type { C4Model } from './c4/types';

export type { ServiceEntry } from './c4/services/catalog';
export { SERVICE_CATALOG, findService, filterServices } from './c4/services/catalog';

export { computeTemporalCoupling } from './temporalCoupling/computeTemporalCoupling';
export { computeSessionCoupling } from './temporalCoupling/computeSessionCoupling';
export { computeSubagentTypeCoupling } from './temporalCoupling/computeSubagentTypeCoupling';
export { computeConfidenceCoupling } from './temporalCoupling/computeConfidenceCoupling';
export { computeSessionConfidenceCoupling } from './temporalCoupling/computeSessionConfidenceCoupling';
export { computeSubagentTypeConfidenceCoupling } from './temporalCoupling/computeSubagentTypeConfidenceCoupling';
export type {
  CommitFileRow,
  SessionFileRow,
  SubagentTypeFileRow,
  GroupedFileRow,
  ComputeTemporalCouplingOptions,
  TemporalCouplingEdge,
  ComputeConfidenceCouplingOptions,
  ConfidenceCouplingEdge,
  CouplingDirection,
} from './temporalCoupling/types';

export {
  computeDefectRisk,
  type CommitRiskRow,
  type DefectRiskEntry,
  type ComputeDefectRiskOptions,
} from './defectRisk';
