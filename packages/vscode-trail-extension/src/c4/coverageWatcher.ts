import * as fs from 'node:fs';
import { TrailLogger } from '../utils/TrailLogger';

const DEBOUNCE_MS = 500;

export class CoverageWatcher {
  private watcher: fs.FSWatcher | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly onFileChanged: (filePath: string) => void,
    private readonly logger: typeof TrailLogger,
  ) {}

  start(filePath: string): void {
    this.stop();
    if (!fs.existsSync(filePath)) {
      this.logger.info(`CoverageWatcher: file not found, waiting for creation: ${filePath}`);
    }

    try {
      this.watcher = fs.watch(filePath, { persistent: false }, (eventType) => {
        if (eventType === 'change' || eventType === 'rename') {
          this.debounce(filePath);
        }
      });

      this.watcher.on('error', (err) => {
        this.logger.warn(`CoverageWatcher error: ${err.message}`);
      });

      this.logger.info(`CoverageWatcher: watching ${filePath}`);
    } catch {
      this.logger.warn(`CoverageWatcher: cannot watch ${filePath}, will retry on config change`);
    }
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
  }

  private debounce(filePath: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      this.onFileChanged(filePath);
    }, DEBOUNCE_MS);
  }
}
