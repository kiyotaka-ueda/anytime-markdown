import * as path from 'node:path';

import * as vscode from 'vscode';

import { TrailLogger } from '../utils/TrailLogger';

const DEFAULT_VIEWER_PORT = 19841;
const SERVER_NAME = 'mcp-trail';

function buildClaudeMcpAddCommand(extensionDistPath: string): string {
    const port = vscode.workspace
        .getConfiguration('anytimeTrail.viewer')
        .get<number>('port', DEFAULT_VIEWER_PORT);
    const serverScript = path.join(extensionDistPath, 'mcp-trail-server.js');
    const trailUrl = `http://localhost:${port}`;
    const quotedNode = JSON.stringify(process.execPath);
    const quotedScript = JSON.stringify(serverScript);
    return `claude mcp add ${SERVER_NAME} ${quotedNode} ${quotedScript} -e TRAIL_SERVER_URL=${trailUrl}`;
}

export function registerMcpRegistrationCommand(
    context: vscode.ExtensionContext,
    extensionDistPath: string,
): void {
    const disposable = vscode.commands.registerCommand(
        'anytime-trail.registerMcpToClaudeCode',
        async () => {
            const command = buildClaudeMcpAddCommand(extensionDistPath);
            try {
                await vscode.env.clipboard.writeText(command);
                TrailLogger.info(`[mcp-register] copied command to clipboard: ${command}`);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                TrailLogger.error('[mcp-register] failed to copy command to clipboard', err);
                vscode.window.showErrorMessage(`Failed to copy command: ${message}`);
                return;
            }

            const runInTerminal = 'ターミナルで実行';
            const showOutput = 'コマンドを表示';
            const choice = await vscode.window.showInformationMessage(
                'Claude Code に mcp-trail を登録するコマンドをクリップボードにコピーしました。',
                runInTerminal,
                showOutput,
            );

            if (choice === runInTerminal) {
                const terminal = vscode.window.createTerminal({ name: 'Anytime Trail: claude mcp add' });
                terminal.show();
                terminal.sendText(command, false);
            } else if (choice === showOutput) {
                const doc = await vscode.workspace.openTextDocument({
                    content: command,
                    language: 'shellscript',
                });
                await vscode.window.showTextDocument(doc, { preview: true });
            }
        },
    );
    context.subscriptions.push(disposable);
}
