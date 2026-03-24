import * as vscode from 'vscode';
import { GraphEditorProvider } from './providers/GraphEditorProvider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(GraphEditorProvider.register(context));

	context.subscriptions.push(
		vscode.commands.registerCommand('anytime-graph.newGraph', async () => {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders) {
				vscode.window.showErrorMessage('Please open a workspace first.');
				return;
			}

			const name = await vscode.window.showInputBox({
				prompt: 'Graph file name',
				value: 'untitled',
			});
			if (!name) return;

			const fileName = name.endsWith('.graph.json') ? name : `${name}.graph.json`;
			const uri = vscode.Uri.joinPath(workspaceFolders[0].uri, fileName);

			const now = Date.now();
			const doc = {
				id: generateId(),
				name,
				nodes: [],
				edges: [],
				viewport: { offsetX: 0, offsetY: 0, scale: 1 },
				createdAt: now,
				updatedAt: now,
			};

			await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(doc, null, 2), 'utf-8'));
			await vscode.commands.executeCommand('vscode.openWith', uri, 'anytimeGraph');
		}),
	);
}

function generateId(): string {
	const bytes = new Uint8Array(16);
	for (let i = 0; i < 16; i++) {
		bytes[i] = Math.floor(Math.random() * 256);
	}
	const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function deactivate() {}
