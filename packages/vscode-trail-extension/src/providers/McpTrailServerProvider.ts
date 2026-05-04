import * as path from 'node:path';

import * as vscode from 'vscode';

import { TrailLogger } from '../utils/TrailLogger';

const DEFAULT_VIEWER_PORT = 19841;

export class McpTrailServerProvider implements vscode.McpServerDefinitionProvider, vscode.Disposable {
    private readonly _changeEmitter = new vscode.EventEmitter<void>();
    public readonly onDidChangeMcpServerDefinitions = this._changeEmitter.event;
    private readonly _configWatcher: vscode.Disposable;

    constructor(private readonly extensionDistPath: string) {
        this._configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('anytimeTrail.viewer.port')) {
                TrailLogger.info('[mcp-trail-provider] viewer port changed, refreshing MCP server definition');
                this._changeEmitter.fire();
            }
        });
    }

    provideMcpServerDefinitions(_token: vscode.CancellationToken): vscode.McpServerDefinition[] {
        const port = vscode.workspace
            .getConfiguration('anytimeTrail.viewer')
            .get<number>('port', DEFAULT_VIEWER_PORT);
        const serverScriptPath = path.join(this.extensionDistPath, 'mcp-trail-server.js');
        const definition = new vscode.McpStdioServerDefinition(
            'mcp-trail',
            process.execPath,
            [serverScriptPath],
            { TRAIL_SERVER_URL: `http://localhost:${port}` },
            '0.10.0',
        );
        return [definition];
    }

    dispose(): void {
        this._configWatcher.dispose();
        this._changeEmitter.dispose();
    }
}
