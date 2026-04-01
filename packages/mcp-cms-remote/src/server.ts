import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { S3Client } from '@aws-sdk/client-s3';
import { z } from 'zod';

import {
  type CmsConfig,
  deleteDoc,
  getPatentFile,
  listDocs,
  listPatentFiles,
  listReportKeys,
  uploadDoc,
  uploadReport,
} from '@anytime-markdown/cms-core';

interface PatentsConfig {
  bucket: string;
  patentsPrefix: string;
}

type ToolArgs = Record<string, unknown>;
type ToolResult = { content: Array<{ type: 'text'; text: string }> };
type ToolCallback = (args: ToolArgs) => Promise<ToolResult>;

/**
 * server.tool() のラッパー。MCP SDK の Zod スキーマ型推論が TS2589 を引き起こすため、
 * パラメータ型を Record<string, z.ZodType> にキャストして型推論の深さを制限する。
 */
function registerTool(
  server: McpServer,
  name: string,
  description: string,
  params: Record<string, z.ZodType>,
  handler: ToolCallback,
): void {
  // @ts-expect-error TS2589: MCP SDK の Zod 型推論が深すぎる既知の制限
  server.tool(name, description, params, handler);
}

const uploadReportParams: Record<string, z.ZodType> = {
  fileName: z.string().describe('File name (e.g. "2026-03-28-daily-research.md")'),
  content: z.string().describe('Markdown file content as UTF-8 string'),
};

const uploadDocParams: Record<string, z.ZodType> = {
  fileName: z.string().describe('File name (e.g. "guide.md" or "diagram.png")'),
  content: z.string().describe('File content: UTF-8 string for .md, base64-encoded string for images'),
  folder: z.string().optional().describe('Optional subfolder name'),
  isBase64: z.boolean().optional().describe('Set true if content is base64-encoded (for images)'),
};

const deleteDocParams: Record<string, z.ZodType> = {
  key: z.string().describe('S3 key of the document to delete (e.g. "docs/file.md")'),
};

const patentIndexParams: Record<string, z.ZodType> = {
  date: z.string().describe('Date in YYYY-MM-DD format'),
};

const patentDetailParams: Record<string, z.ZodType> = {
  date: z.string().describe('Date in YYYY-MM-DD format'),
  patentId: z.string().optional().describe('Filter by patent ID (exact match)'),
  keyword: z.string().optional().describe('Filter by keyword in title/abstract (case-insensitive)'),
};

export function createRemoteMcpServer(
  client: S3Client,
  config: CmsConfig,
  patentsConfig?: PatentsConfig,
): McpServer {
  const server = new McpServer({
    name: 'anytime-markdown-cms-remote',
    version: '0.0.1',
  });

  registerTool(server, 'upload_report', 'Upload a Markdown report to S3 reports prefix',
    uploadReportParams, async (args) => {
      const fileName = args.fileName as string;
      const content = args.content as string;
      const result = await uploadReport({ fileName, content }, client, config);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    });

  registerTool(server, 'list_reports', 'List all report files in S3 reports prefix',
    {}, async () => {
      const reports = await listReportKeys(client, config);
      return { content: [{ type: 'text', text: JSON.stringify(reports, null, 2) }] };
    });

  registerTool(server, 'upload_doc', 'Upload a document or image to S3 docs prefix',
    uploadDocParams, async (args) => {
      const fileName = args.fileName as string;
      const content = args.content as string;
      const folder = args.folder as string | undefined;
      const isBase64 = args.isBase64 as boolean | undefined;
      const body = isBase64 ? Buffer.from(content, 'base64') : content;
      const result = await uploadDoc({ fileName, content: body, folder }, client, config);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    });

  registerTool(server, 'list_docs', 'List all document files in S3 docs prefix',
    {}, async () => {
      const docs = await listDocs(client, config);
      return { content: [{ type: 'text', text: JSON.stringify(docs, null, 2) }] };
    });

  registerTool(server, 'delete_doc', 'Delete a document from S3 docs prefix',
    deleteDocParams, async (args) => {
      const key = args.key as string;
      await deleteDoc({ key }, client, config);
      return { content: [{ type: 'text', text: JSON.stringify({ deleted: true, key }) }] };
    });

  if (patentsConfig) {
    registerTool(server, 'list_patents', 'List saved patent data files by date',
      {}, async () => {
        const entries = await listPatentFiles(client, patentsConfig);
        return { content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }] };
      });

    registerTool(server, 'get_patent_index', 'Get TSV index of patents for a specific date (low token cost)',
      patentIndexParams, async (args) => {
        const date = args.date as string;
        const key = `${patentsConfig.patentsPrefix}${date}.tsv`;
        const content = await getPatentFile(key, client, patentsConfig);
        return { content: [{ type: 'text', text: content }] };
      });

    registerTool(server, 'get_patent_detail', 'Get patent details from JSONL data, optionally filtered by patent ID or keyword',
      patentDetailParams, async (args) => {
        const date = args.date as string;
        const patentId = args.patentId as string | undefined;
        const keyword = args.keyword as string | undefined;
        const key = `${patentsConfig.patentsPrefix}${date}.jsonl`;
        const content = await getPatentFile(key, client, patentsConfig);
        let lines = content.split('\n').filter(Boolean);

        if (patentId) {
          lines = lines.filter((line) => line.includes(`"${patentId}"`));
        }
        if (keyword) {
          const lower = keyword.toLowerCase();
          lines = lines.filter((line) => line.toLowerCase().includes(lower));
        }

        const result: unknown[] = [];
        for (const line of lines) {
          try {
            result.push(JSON.parse(line));
          } catch {
            // skip malformed lines
          }
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      });
  }

  return server;
}
