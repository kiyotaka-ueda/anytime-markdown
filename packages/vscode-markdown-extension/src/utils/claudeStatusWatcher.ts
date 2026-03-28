import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getStatusFilePath } from './claudeHookSetup';

interface ClaudeStatus {
  editing: boolean;
  file: string;
  timestamp: number;
}

type StatusChangeCallback = (editing: boolean, filePath: string) => void;

const STALE_THRESHOLD_MS = 30_000;

export class ClaudeStatusWatcher implements vscode.Disposable {
  private readonly callbacks: StatusChangeCallback[] = [];
  private readonly statusFilePath: string;
  private fsWatcher: fs.FSWatcher | null = null;

  constructor() {
    this.statusFilePath = getStatusFilePath();
    this.startWatching();
  }

  onStatusChange(callback: StatusChangeCallback): void {
    this.callbacks.push(callback);
  }

  private startWatching(): void {
    const dir = path.dirname(this.statusFilePath);
    const fileName = path.basename(this.statusFilePath);

    // fs.watch: イベント駆動（PreToolUse の即時検知に必要）
    try {
      this.fsWatcher = fs.watch(dir, (_, changedFile) => {
        if (changedFile === fileName) {
          this.handleChange();
        }
      });
      this.fsWatcher.on('error', () => {
        // エラー時は無視（fs.watchFile にフォールバック）
      });
    } catch {
      // fs.watch が利用できない場合は無視
    }

    // fs.watchFile: stat ポーリング（fs.watch がイベントを取りこぼす環境向けフォールバック）
    fs.watchFile(this.statusFilePath, { interval: 1000 }, () => {
      this.handleChange();
    });
  }

  private handleChange(): void {
    try {
      const raw = fs.readFileSync(this.statusFilePath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (!this.isValidStatus(parsed)) {
        return;
      }

      const isStale = Date.now() - parsed.timestamp > STALE_THRESHOLD_MS;
      const editing = isStale ? false : parsed.editing;

      for (const cb of this.callbacks) {
        cb(editing, parsed.file);
      }
    } catch {
      // JSON パース失敗やファイル読み取り失敗は無視
    }
  }

  private isValidStatus(obj: unknown): obj is ClaudeStatus {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    const record = obj as Record<string, unknown>;
    return (
      typeof record.editing === 'boolean' &&
      typeof record.file === 'string' &&
      typeof record.timestamp === 'number'
    );
  }

  dispose(): void {
    this.fsWatcher?.close();
    fs.unwatchFile(this.statusFilePath);
  }
}
