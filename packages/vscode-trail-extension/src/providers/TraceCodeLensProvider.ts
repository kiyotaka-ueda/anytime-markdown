import * as vscode from 'vscode';

const TEST_CALL_RE = /^\s*(it|test|describe)(\.each|\.only|\.skip|\.concurrent)?\s*[(<`]/;
const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$/;

export class TraceCodeLensProvider implements vscode.CodeLensProvider {
	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		if (!TEST_FILE_RE.test(document.fileName)) {
			return [];
		}

		const lenses: vscode.CodeLens[] = [];
		const text = document.getText();
		const lines = text.split('\n');

		for (let i = 0; i < lines.length; i++) {
			if (!TEST_CALL_RE.test(lines[i])) { continue; }

			const range = new vscode.Range(
				new vscode.Position(i, 0),
				new vscode.Position(i, lines[i].length),
			);
			lenses.push(new vscode.CodeLens(range, {
				command: 'anytime-trail.runWithTrace',
				title: '$(beaker) Run with Trace',
				arguments: [document.uri.fsPath, i],
			}));
		}

		return lenses;
	}
}
