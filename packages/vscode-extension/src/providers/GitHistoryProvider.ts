import * as vscode from 'vscode';
import * as path from 'path';

interface GitExtension {
	getAPI(version: 1): GitAPI;
}
interface GitAPI {
	getRepository(uri: vscode.Uri): Repository | null;
}
interface Repository {
	rootUri: vscode.Uri;
	show(ref: string, filePath: string): Promise<string>;
	log(options?: { maxEntries?: number; path?: string }): Promise<Commit[]>;
}
interface Commit {
	hash: string;
	message: string;
	authorName?: string;
	authorDate?: Date;
}

export class GitHistoryItem extends vscode.TreeItem {
	constructor(
		public readonly commit: Commit,
		public readonly fileUri: vscode.Uri,
	) {
		const shortMsg = commit.message.split('\n')[0];
		super(shortMsg, vscode.TreeItemCollapsibleState.None);

		const date = commit.authorDate
			? formatDate(commit.authorDate)
			: '';
		const author = commit.authorName ?? '';
		this.description = `${date}  ${author}`;
		this.tooltip = `${commit.hash.substring(0, 7)}  ${shortMsg}\n${author}  ${date}`;
		this.iconPath = new vscode.ThemeIcon('git-commit');
		this.command = {
			command: 'anytime-markdown.compareWithCommit',
			title: 'Compare with this commit',
			arguments: [this],
		};
	}
}

function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	const h = String(date.getHours()).padStart(2, '0');
	const min = String(date.getMinutes()).padStart(2, '0');
	return `${y}-${m}-${d} ${h}:${min}`;
}

export class GitHistoryProvider implements vscode.TreeDataProvider<GitHistoryItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private fileUri: vscode.Uri | null = null;
	private items: GitHistoryItem[] = [];

	refresh(uri: vscode.Uri | null): void {
		this.fileUri = uri;
		this.items = [];
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: GitHistoryItem): vscode.TreeItem {
		return element;
	}

	async getChildren(): Promise<GitHistoryItem[]> {
		if (!this.fileUri) {
			return [];
		}
		if (this.items.length > 0) {
			return this.items;
		}

		const repo = await this.getRepository(this.fileUri);
		if (!repo) {
			return [];
		}

		const relativePath = path.relative(repo.rootUri.fsPath, this.fileUri.fsPath).replace(/\\/g, '/');
		try {
			const commits = await repo.log({ path: relativePath });
			this.items = commits.map(c => new GitHistoryItem(c, this.fileUri!));
			return this.items;
		} catch {
			return [];
		}
	}

	async getCommitContent(item: GitHistoryItem): Promise<string | null> {
		const repo = await this.getRepository(item.fileUri);
		if (!repo) { return null; }
		const relativePath = path.relative(repo.rootUri.fsPath, item.fileUri.fsPath).replace(/\\/g, '/');
		try {
			return await repo.show(item.commit.hash, relativePath);
		} catch {
			return null;
		}
	}

	private async getRepository(uri: vscode.Uri): Promise<Repository | null> {
		const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
		if (!gitExtension) { return null; }
		if (!gitExtension.isActive) {
			await gitExtension.activate();
		}
		return gitExtension.exports.getAPI(1).getRepository(uri);
	}
}
