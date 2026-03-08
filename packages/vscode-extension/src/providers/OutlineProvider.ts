import * as vscode from 'vscode';

interface HeadingData {
	level: number;
	text: string;
	pos: number;
	kind: string;
}

const KIND_ICONS: Record<string, string> = {
	heading: 'symbol-structure',
	mermaid: 'graph',
	plantuml: 'graph',
	codeBlock: 'code',
	table: 'table',
	image: 'file-media',
};

export class OutlineItem extends vscode.TreeItem {
	public readonly children: OutlineItem[] = [];

	constructor(
		public readonly heading: HeadingData,
	) {
		super(heading.text || '(empty)', vscode.TreeItemCollapsibleState.None);
		this.iconPath = new vscode.ThemeIcon(KIND_ICONS[heading.kind] ?? 'symbol-structure');
		this.command = {
			command: 'anytime-markdown.scrollToHeading',
			title: 'Go to heading',
			arguments: [heading.pos],
		};
	}
}

export class OutlineProvider implements vscode.TreeDataProvider<OutlineItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private roots: OutlineItem[] = [];

	update(headings: HeadingData[]): void {
		this.roots = this.buildTree(headings);
		this._onDidChangeTreeData.fire();
	}

	clear(): void {
		this.roots = [];
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: OutlineItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: OutlineItem): OutlineItem[] {
		if (!element) {
			return this.roots;
		}
		return element.children;
	}

	private buildTree(headings: HeadingData[]): OutlineItem[] {
		const items = headings.map(h => new OutlineItem(h));
		// 見出しレベルに基づく階層構造を構築
		const roots: OutlineItem[] = [];
		const stack: OutlineItem[] = [];

		for (const item of items) {
			// 非見出し項目（level 6: mermaid, table 等）は直前の見出しの子にする
			if (item.heading.kind !== 'heading') {
				if (stack.length > 0) {
					const parent = stack[stack.length - 1];
					parent.children.push(item);
					parent.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
				} else {
					roots.push(item);
				}
				continue;
			}

			// スタックから現在レベル以上の項目を除去
			while (stack.length > 0 && stack[stack.length - 1].heading.level >= item.heading.level) {
				stack.pop();
			}

			if (stack.length > 0) {
				const parent = stack[stack.length - 1];
				parent.children.push(item);
				parent.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
			} else {
				roots.push(item);
			}

			stack.push(item);
		}

		return roots;
	}
}
