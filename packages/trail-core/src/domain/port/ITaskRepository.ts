// domain/port/ITaskRepository.ts — Task data access port

import type { TaskRow, TaskFileRow, TaskC4ElementRow, TaskFeatureRow } from '../model/task';
import type { SessionStats } from './ISessionRepository';

export interface ITaskRepository {
  existsByMergeHash(hash: string): boolean;
  insertTask(row: TaskRow): void;
  insertFiles(taskId: string, files: readonly TaskFileRow[]): void;
  insertC4Elements(taskId: string, elements: readonly TaskC4ElementRow[]): void;
  insertFeatures(taskId: string, features: readonly TaskFeatureRow[]): void;
  updateSessionStats(taskId: string, stats: SessionStats): void;
}
