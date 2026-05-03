import * as vscode from 'vscode';
import { TraceScriptLensProvider } from '../providers/TraceScriptLensProvider';

function makeDoc(content: string, fileName = '/workspace/package.json'): vscode.TextDocument {
	const lines = content.split('\n');
	return {
		getText: () => content,
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

const PKG = JSON.stringify({
	name: 'my-app',
	scripts: {
		test: 'jest',
		'test:unit': 'jest src/unit',
		build: 'tsc',
		e2e: 'playwright test',
		dev: 'next dev',
	},
}, null, 2);

describe('TraceScriptLensProvider', () => {
	let provider: TraceScriptLensProvider;

	beforeEach(() => {
		provider = new TraceScriptLensProvider();
	});

	it('returns CodeLens for "test" script', () => {
		const doc = makeDoc(PKG);
		const lenses = provider.provideCodeLenses(doc);
		const testLens = lenses.find((l: vscode.CodeLens) => {
			const lineText = PKG.split('\n')[l.range.start.line];
			return lineText.includes('"test"');
		});
		expect(testLens).toBeDefined();
		expect(testLens?.command?.command).toBe('anytime-trail.runWithTrace');
	});

	it('returns CodeLens for "test:unit" script', () => {
		const doc = makeDoc(PKG);
		const lenses = provider.provideCodeLenses(doc);
		const unitLens = lenses.find((l: vscode.CodeLens) => {
			const lineText = PKG.split('\n')[l.range.start.line];
			return lineText.includes('"test:unit"');
		});
		expect(unitLens).toBeDefined();
	});

	it('returns CodeLens for "e2e" script', () => {
		const doc = makeDoc(PKG);
		const lenses = provider.provideCodeLenses(doc);
		const e2eLens = lenses.find((l: vscode.CodeLens) => {
			const lineText = PKG.split('\n')[l.range.start.line];
			return lineText.includes('"e2e"');
		});
		expect(e2eLens).toBeDefined();
	});

	it('does not return CodeLens for "build" or "dev" scripts', () => {
		const doc = makeDoc(PKG);
		const lenses = provider.provideCodeLenses(doc);
		const buildLens = lenses.find((l: vscode.CodeLens) => {
			const lineText = PKG.split('\n')[l.range.start.line];
			return lineText.includes('"build"') || lineText.includes('"dev"');
		});
		expect(buildLens).toBeUndefined();
	});

	it('returns empty array for non-package.json file', () => {
		const doc = makeDoc(PKG, '/workspace/tsconfig.json');
		const lenses = provider.provideCodeLenses(doc);
		expect(lenses).toHaveLength(0);
	});

	it('returns empty array for invalid JSON', () => {
		const doc = makeDoc('{ invalid json }');
		const lenses = provider.provideCodeLenses(doc);
		expect(lenses).toHaveLength(0);
	});

	it('passes script name and file path in command arguments', () => {
		const doc = makeDoc(PKG);
		const lenses = provider.provideCodeLenses(doc);
		const testLens = lenses.find((l: vscode.CodeLens) => {
			const lineText = PKG.split('\n')[l.range.start.line];
			return lineText.includes('"test"') && !lineText.includes('"test:');
		});
		expect(testLens?.command?.arguments?.[0]).toBe('/workspace/package.json');
		expect(testLens?.command?.arguments?.[1]).toBe('test');
	});
});
