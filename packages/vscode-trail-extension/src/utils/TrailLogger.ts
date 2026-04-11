import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

function getChannel(): vscode.OutputChannel {
  channel ??= vscode.window.createOutputChannel('Anytime Trail');
  return channel;
}

export const TrailLogger = {
  info(msg: string): void {
    getChannel().appendLine(`[INFO] ${msg}`);
  },
  warn(msg: string): void {
    getChannel().appendLine(`[WARN] ${msg}`);
  },
  error(msg: string, err?: unknown): void {
    const detail = err instanceof Error ? `: ${err.message}` : err ? `: ${String(err)}` : '';
    getChannel().appendLine(`[ERROR] ${msg}${detail}`);
    if (err instanceof Error && err.stack) {
      getChannel().appendLine(err.stack);
    }
  },
  dispose(): void {
    channel?.dispose();
    channel = undefined;
  },
};
