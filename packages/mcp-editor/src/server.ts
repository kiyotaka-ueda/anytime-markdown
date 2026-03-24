import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface McpEditorOptions {
  rootDir: string;
}

export function createMcpServer(options: McpEditorOptions): McpServer {
  const server = new McpServer({
    name: 'anytime-markdown-editor',
    version: '0.7.7',
  });

  // ツールは後続タスクで追加

  return server;
}
