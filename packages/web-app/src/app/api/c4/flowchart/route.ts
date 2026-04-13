// packages/web-app/src/app/api/c4/flowchart/route.ts
//
// GET /api/c4/flowchart?componentId=...&symbolId=...&type=control|call&repo=...
//
// 指定コンポーネント内の関数に対して制御フローまたはコールグラフを生成して返す。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  FlowAnalyzer,
  createSourceFile,
  findFunctionNode,
} from '@anytime-markdown/trail-core/analyzer';

import { NO_STORE_HEADERS, createC4ModelStore } from '../../../../lib/api-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const componentId = searchParams.get('componentId');
  const symbolId = searchParams.get('symbolId');
  const type = searchParams.get('type') ?? 'control';
  const repo = searchParams.get('repo') ?? '';

  if (!componentId || !symbolId) {
    return NextResponse.json(
      { error: 'componentId and symbolId are required' },
      { status: 400 },
    );
  }
  if (type !== 'control' && type !== 'call') {
    return NextResponse.json(
      { error: 'type must be control or call' },
      { status: 400 },
    );
  }

  const store = createC4ModelStore();
  if (!store) return new NextResponse(null, { status: 204 });

  try {
    const [modelResult, graphResult] = await Promise.all([
      store.getCurrentC4Model(repo),
      store.getCurrentGraph(repo),
    ]);
    if (!modelResult || !graphResult) return new NextResponse(null, { status: 204 });

    const { model } = modelResult;
    const { graph } = graphResult;
    const { projectRoot } = graph.metadata;

    // C4 code 要素のうち指定コンポーネント配下のものの ID を収集
    const codeElementIds = new Set(
      model.elements
        .filter(el => el.type === 'code' && el.boundaryId === componentId)
        .map(el => el.id),
    );

    // TrailGraph からソースファイルを読み込む
    const sourceFiles = [];
    for (const node of graph.nodes) {
      if (node.type !== 'file') continue;
      if (!codeElementIds.has(node.id)) continue;
      const absolutePath = join(projectRoot, node.filePath);
      try {
        const content = readFileSync(absolutePath, 'utf-8');
        sourceFiles.push(createSourceFile(node.filePath, content));
      } catch (readErr) {
        console.warn(
          `[/api/c4/flowchart] failed to read file: ${absolutePath}`,
          readErr instanceof Error ? readErr.message : String(readErr),
        );
      }
    }

    if (type === 'control') {
      // symbolId = "filePath::funcName" の形式
      const parts = symbolId.split('::');
      const funcName = parts.at(-1);
      const filePart = parts[0];

      if (!funcName || !filePart) {
        return NextResponse.json(
          { graph: { nodes: [], edges: [] } },
          { headers: NO_STORE_HEADERS },
        );
      }

      const targetSf = sourceFiles.find(sf => sf.fileName === filePart);
      if (!targetSf) {
        return NextResponse.json(
          { graph: { nodes: [], edges: [] } },
          { headers: NO_STORE_HEADERS },
        );
      }

      const funcNode = findFunctionNode(targetSf, funcName);
      if (!funcNode) {
        return NextResponse.json(
          { graph: { nodes: [], edges: [] } },
          { headers: NO_STORE_HEADERS },
        );
      }

      const flowGraph = FlowAnalyzer.buildControlFlow(targetSf, funcNode);
      return NextResponse.json({ graph: flowGraph }, { headers: NO_STORE_HEADERS });
    } else {
      const flowGraph = FlowAnalyzer.buildCallGraph(sourceFiles, symbolId);
      return NextResponse.json({ graph: flowGraph }, { headers: NO_STORE_HEADERS });
    }
  } catch (e) {
    console.error(
      '[/api/c4/flowchart] error',
      e instanceof Error ? e.stack : String(e),
    );
    return NextResponse.json(
      { graph: { nodes: [], edges: [] } },
      { headers: NO_STORE_HEADERS },
    );
  }
}
