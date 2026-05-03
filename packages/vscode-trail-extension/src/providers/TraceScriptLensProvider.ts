import * as vscode from 'vscode';

const TRACE_SCRIPT_RE = /^(test|e2e|coverage)([:.-].+)?$/;

export class TraceScriptLensProvider implements vscode.CodeLensProvider {
	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		if (!document.fileName.endsWith('package.json')) {
			return [];
		}

		const text = document.getText();
		let pkg: Record<string, unknown>;
		try {
			pkg = JSON.parse(text) as Record<string, unknown>;
		} catch {
			return [];
		}

		const scripts = pkg['scripts'];
		if (!scripts || typeof scripts !== 'object') {
			return [];
		}

		const lenses: vscode.CodeLens[] = [];
		const lines = text.split('\n');

		for (const scriptName of Object.keys(scripts as Record<string, string>)) {
			if (!TRACE_SCRIPT_RE.test(scriptName)) { continue; }

			const lineIndex = lines.findIndex(line => {
				const trimmed = line.trim();
				return trimmed.startsWith(`"${scriptName}"`) || trimmed.startsWith(`'${scriptName}'`);
			});
			if (lineIndex === -1) { continue; }

			const range = new vscode.Range(
				new vscode.Position(lineIndex, 0),
				new vscode.Position(lineIndex, lines[lineIndex].length),
			);
			lenses.push(new vscode.CodeLens(range, {
				command: 'anytime-trail.runWithTrace',
				title: `$(beaker) Run "${scriptName}" with Trace`,
				arguments: [document.uri.fsPath, scriptName],
			}));
		}

		return lenses;
	}
}
