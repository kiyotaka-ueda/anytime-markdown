import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** ノートページの TreeItem */
export class AiNoteItem extends vscode.TreeItem {
	constructor(
		public readonly filePath: string,
		public readonly fileName: string,
		label: string,
	) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.tooltip = filePath;
		this.iconPath = new vscode.ThemeIcon('note');
		this.contextValue = 'noteItem';
		this.command = {
			command: 'anytime-markdown.openNotePage',
			title: 'Open Note',
			arguments: [filePath],
		};
	}
}

/** globalStorage 内の .md ファイルをノートページとして一覧する TreeDataProvider */
export class AiNoteProvider implements vscode.TreeDataProvider<AiNoteItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	constructor(private readonly storageDir: string) {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: AiNoteItem): vscode.TreeItem {
		return element;
	}

	getChildren(): AiNoteItem[] {
		if (!fs.existsSync(this.storageDir)) { return []; }

		const files = fs.readdirSync(this.storageDir)
			.filter(f => f.endsWith('.md'))
			.sort((a, b) => {
				// anytime-context.md を先頭に固定
				if (a === 'anytime-context.md') { return -1; }
				if (b === 'anytime-context.md') { return 1; }
				return a.localeCompare(b);
			});

		return files.map(fileName => {
			const filePath = path.join(this.storageDir, fileName);
			const label = fileName === 'anytime-context.md'
				? 'Note'
				: fileName.replace(/\.md$/, '');
			return new AiNoteItem(filePath, fileName, label);
		});
	}
}
