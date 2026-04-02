import path from 'node:path';
import fs from 'node:fs';
import { analyze } from './analyze';
import { toCytoscape } from './transform/toCytoscape';
import { getTrailStylesheet } from './transform/trailStylesheet';

interface CliArgs {
  tsconfigPath: string;
  output: string;
  exclude: string[];
  includeTests: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let tsconfigPath = './tsconfig.json';
  let output = './trail.json';
  const exclude: string[] = [];
  let includeTests = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--tsconfig':
        tsconfigPath = args[++i];
        break;
      case '--output':
        output = args[++i];
        break;
      case '--exclude':
        exclude.push(args[++i]);
        break;
      case '--include-tests':
        includeTests = true;
        break;
      case 'analyze':
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  return { tsconfigPath, output, exclude, includeTests };
}

function main(): void {
  const args = parseArgs(process.argv);
  const absoluteTsconfig = path.resolve(args.tsconfigPath);

  if (!fs.existsSync(absoluteTsconfig)) {
    console.error(`tsconfig not found: ${absoluteTsconfig}`);
    process.exit(1);
  }

  console.log(`Analyzing: ${absoluteTsconfig}`);

  const graph = analyze({
    tsconfigPath: absoluteTsconfig,
    exclude: args.exclude,
    includeTests: args.includeTests,
  });

  const elements = toCytoscape(graph);
  const stylesheet = getTrailStylesheet();

  const result = {
    elements,
    stylesheet,
    metadata: graph.metadata,
  };

  const outputPath = path.resolve(args.output);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');

  console.log(
    `Done: ${graph.metadata.fileCount} files, ` +
    `${graph.nodes.length} nodes, ${graph.edges.length} edges`,
  );
  console.log(`Output: ${outputPath}`);
}

main();
