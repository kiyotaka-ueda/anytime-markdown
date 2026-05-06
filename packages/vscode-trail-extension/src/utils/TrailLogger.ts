import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

function getChannel(): vscode.OutputChannel {
  channel ??= vscode.window.createOutputChannel('Anytime Trail');
  return channel;
}

function ts(): string {
  return new Date().toISOString();
}

function formatMeta(meta: unknown): string {
  if (meta === undefined) return '';
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return ` ${String(meta)}`;
  }
}

export const TrailLogger = {
  info(msg: string): void {
    getChannel().appendLine(`[${ts()}] [INFO] ${msg}`);
  },
  warn(msg: string): void {
    getChannel().appendLine(`[${ts()}] [WARN] ${msg}`);
  },
  error(msg: string, err?: unknown): void {
    const detail = err instanceof Error ? `: ${err.message}` : err ? `: ${String(err)}` : '';
    getChannel().appendLine(`[${ts()}] [ERROR] ${msg}${detail}`);
    if (err instanceof Error && err.stack) {
      getChannel().appendLine(err.stack);
    }
  },
  debugSql(meta: unknown): void {
    if (process.env.TRAIL_DEBUG_SQL !== '1') return;
    getChannel().appendLine(`[${ts()}] [DEBUG:SQL]${formatMeta(meta)}`);
  },
  debugPerf(meta: unknown): void {
    if (process.env.TRAIL_DEBUG_PERF !== '1') return;
    getChannel().appendLine(`[${ts()}] [DEBUG:PERF]${formatMeta(meta)}`);
  },
  dispose(): void {
    channel?.dispose();
    channel = undefined;
  },
};
