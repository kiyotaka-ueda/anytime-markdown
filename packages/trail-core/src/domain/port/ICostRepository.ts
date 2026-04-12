// domain/port/ICostRepository.ts — Cost data access port

import type { SkillModelRow, CostOptimizationData } from '../model/cost';

export interface ICostRepository {
  getSkillModels(): readonly SkillModelRow[];
  registerSkillIfNew(skill: string, defaultModel: string): void;
  rebuildDailyCosts(tzOffset: string): void;
  getCostOptimization(): CostOptimizationData;
}
