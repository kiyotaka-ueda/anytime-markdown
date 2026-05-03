import * as vscode from 'vscode';
import { TraceCodeLensProvider } from '../providers/TraceCodeLensProvider';

function makeDoc(lines: string[], fileName = '/workspace/foo.test.ts'): vscode.TextDocument {
	return {
		getText: () => lines.join('\n'),
		lineCount: lines.length,
		lineAt: (i: number) => ({
			text: lines[i],
			range: new vscode.Range(
				new vscode.Position(i, 0),
				new vscode.Position(i, lines[i].length),
			),
		}),
		uri: vscode.Uri.file(fileName),
		fileName,
	} as unknown as vscode.TextDocument;
}

describe('TraceCodeLensProvider', () => {
	let provider: TraceCodeLensProvider;

	beforeEach(() => {
		provider = new TraceCodeLensProvider();
	});

	it('returns CodeLens for it()', () => {
		const doc = makeDoc([
			"import { describe, it } from 'vitest';",
			"describe('suite', () => {",
			"  it('does something', () => {});",
			'});',
		]);
		const lenses = provider.provideCodeLenses(doc);
		const itLens = lenses.find((l: vscode.CodeLens) => l.range.start.line === 2);
		expect(itLens).toBeDefined();
		expect(itLens?.command?.command).toBe('anytime-trail.runWithTrace');
	});

	it('returns CodeLens for test()', () => {
		const doc = makeDoc([
			"test('adds numbers', () => {});",
		]);
		const lenses = provider.provideCodeLenses(doc);
		expect(lenses).toHaveLength(1);
		expect(lenses[0].range.start.line).toBe(0);
	});

	it('returns CodeLens for describe()', () => {
		const doc = makeDoc([
			"describe('my suite', () => {",
			"  it('test', () => {});",
			'});',
		]);
		const lenses = provider.provideCodeLenses(doc);
		const describeLens = lenses.find((l: vscode.CodeLens) => l.range.start.line === 0);
		expect(describeLens).toBeDefined();
		expect(describeLens?.command?.title).toMatch(/Trace/);
	});

	it('returns empty array for non-test file', () => {
		const doc = makeDoc([
			"export function add(a: number, b: number) { return a + b; }",
		], '/workspace/utils.ts');
		const lenses = provider.provideCodeLenses(doc);
		expect(lenses).toHaveLength(0);
	});

	it('detects it.each', () => {
		const doc = makeDoc([
			"it.each([1, 2])('value %s', (v) => {});",
		]);
		const lenses = provider.provideCodeLenses(doc);
		expect(lenses).toHaveLength(1);
	});

	it('passes file path and line in command arguments', () => {
		const doc = makeDoc([
			"it('works', () => {});",
		]);
		const lenses = provider.provideCodeLenses(doc);
		expect(lenses[0].command?.arguments?.[0]).toBe('/workspace/foo.test.ts');
		expect(lenses[0].command?.arguments?.[1]).toBe(0);
	});
});
