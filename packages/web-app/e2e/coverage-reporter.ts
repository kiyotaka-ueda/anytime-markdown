import type {
  Reporter,
  FullResult,
} from "@playwright/test/reporter";
import { readdir, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import v8ToIstanbul from "v8-to-istanbul";

const V8_COV_DIR = join(import.meta.dirname, "..", ".v8-coverage");
const OUT_DIR = join(import.meta.dirname, "..", "coverage");
const PROJECT_ROOT = join(import.meta.dirname, "..");

/** webpack internals, node_modules, Next.js runtime are excluded */
function shouldInclude(url: string): boolean {
  if (url.includes("node_modules")) return false;
  if (url.includes("_next/static/chunks/webpack")) return false;
  if (url.includes("__nextjs_original-stack-frame")) return false;
  return url.includes("/src/");
}

class CoverageReporter implements Reporter {
  async onEnd(_result: FullResult): Promise<void> {
    let files: string[];
    try {
      files = await readdir(V8_COV_DIR);
    } catch {
      return;
    }

    const istanbulMap: Record<string, unknown> = {};

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await readFile(join(V8_COV_DIR, file), "utf-8");
      const entries: Array<{
        url: string;
        source?: string;
        functions: Array<{
          functionName: string;
          ranges: Array<{
            startOffset: number;
            endOffset: number;
            count: number;
          }>;
          isBlockCoverage: boolean;
        }>;
      }> = JSON.parse(raw);

      for (const entry of entries) {
        if (!shouldInclude(entry.url)) continue;

        const converter = v8ToIstanbul(entry.url, 0, {
          source: entry.source ?? "",
        });
        await converter.load();
        converter.applyCoverage(entry.functions);
        const istanbul = converter.toIstanbul();

        for (const [filePath, data] of Object.entries(istanbul)) {
          const relPath = relative(PROJECT_ROOT, filePath);
          if (istanbulMap[relPath]) {
            mergeFileCoverage(
              istanbulMap[relPath] as Record<string, unknown>,
              data as Record<string, unknown>,
            );
          } else {
            istanbulMap[relPath] = data;
          }
        }
      }
    }

    if (Object.keys(istanbulMap).length > 0) {
      await mkdir(OUT_DIR, { recursive: true });
      await writeFile(
        join(OUT_DIR, "coverage-final.json"),
        JSON.stringify(istanbulMap, null, 2),
      );
      console.log(
        `\nE2E coverage: ${Object.keys(istanbulMap).length} files → coverage/coverage-final.json`,
      );
    }

    await rm(V8_COV_DIR, { recursive: true, force: true });
  }
}

function mergeFileCoverage(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): void {
  const targetS = target.s as Record<string, number>;
  const sourceS = source.s as Record<string, number>;
  for (const key of Object.keys(sourceS)) {
    targetS[key] = (targetS[key] ?? 0) + sourceS[key];
  }
  const targetF = target.f as Record<string, number>;
  const sourceF = source.f as Record<string, number>;
  for (const key of Object.keys(sourceF)) {
    targetF[key] = (targetF[key] ?? 0) + sourceF[key];
  }
  const targetB = target.b as Record<string, number[]>;
  const sourceB = source.b as Record<string, number[]>;
  for (const key of Object.keys(sourceB)) {
    if (targetB[key]) {
      for (let i = 0; i < sourceB[key].length; i++) {
        targetB[key][i] = (targetB[key][i] ?? 0) + sourceB[key][i];
      }
    } else {
      targetB[key] = sourceB[key];
    }
  }
}

export default CoverageReporter;
