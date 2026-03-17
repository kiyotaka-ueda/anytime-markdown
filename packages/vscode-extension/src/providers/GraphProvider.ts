import * as vscode from 'vscode';
import * as path from 'path';
import { execSync } from 'child_process';

/** 拡張機能ルートからの相対パスで SVG アイコンを返す */
let extensionPath = '';
function iconPath(name: string): { light: vscode.Uri; dark: vscode.Uri } {
	const p = vscode.Uri.file(path.join(extensionPath, 'images', name));
	return { light: p, dark: p };
}

function resolveIcon(hash: string, refs: string, isLocal: boolean): { light: vscode.Uri; dark: vscode.Uri } {
	if (!hash) {
		return iconPath('graph-empty.svg');
	}
	if (refs) {
		const isHead = refs.includes('HEAD');
		if (isHead) {
			// HEAD: ローカル=青中抜き、リモート済み=赤中抜き
			return iconPath(isLocal ? 'graph-head-outline.svg' : 'graph-head-remote.svg');
		}
		// ブランチ参照あり
		return iconPath(isLocal ? 'graph-branch-local2.svg' : 'graph-branch-remote2.svg');
	}
	// 通常コミット: ローカル=青塗り、リモート済み=赤塗り
	return iconPath(isLocal ? 'graph-dot.svg' : 'graph-dot-remote.svg');
}

export class GraphItem extends vscode.TreeItem {
	constructor(
		public readonly graph: string,
		public readonly hash: string,
		public readonly message: string,
		public readonly refs: string,
		public readonly date: string,
		public readonly author: string,
		isLocal: boolean,
	) {
		super('', vscode.TreeItemCollapsibleState.None);

		this.iconPath = resolveIcon(hash, refs, isLocal);

		if (!hash) {
			// グラフのみの行（マージライン等）
			this.label = graph;
			this.description = '';
			this.tooltip = '';
		} else if (refs) {
			this.label = `${graph} ${message}`;
			this.description = `[${refs}]  ${date}  ${author}`;
			this.tooltip = `${hash.substring(0, 7)}  ${message}\n${refs}\n${author}  ${date}`;
		} else {
			this.label = `${graph} ${message}`;
			this.description = `${date}  ${author}`;
			this.tooltip = `${hash.substring(0, 7)}  ${message}\n${author}  ${date}`;
		}
	}
}

export class GraphProvider implements vscode.TreeDataProvider<GraphItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private gitRoot: string | null = null;
	private items: GraphItem[] = [];

	constructor(context: vscode.ExtensionContext) {
		extensionPath = context.extensionPath;
	}

	setTargetRoot(rootPath: string | null): void {
		this.gitRoot = null;
		if (rootPath) {
			try {
				this.gitRoot = execSync('git rev-parse --show-toplevel', { cwd: rootPath, encoding: 'utf-8' }).trim();
			} catch { /* ignore */ }
		}
		this.items = [];
		this._onDidChangeTreeData.fire();
	}

	refresh(): void {
		this.items = [];
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: GraphItem): vscode.TreeItem {
		return element;
	}

	async getChildren(): Promise<GraphItem[]> {
		if (!this.gitRoot) { return []; }
		if (this.items.length > 0) { return this.items; }

		try {
			// ローカルのみのコミットハッシュを取得（リモートに存在しないもの）
			const localOnlyHashes = new Set<string>();
			try {
				const localOutput = execSync(
					'git log --format=%h --branches --not --remotes',
					{ cwd: this.gitRoot, encoding: 'utf-8' },
				);
				for (const h of localOutput.split('\n')) {
					const trimmed = h.trim();
					if (trimmed) { localOnlyHashes.add(trimmed); }
				}
			} catch { /* リモートなしの場合は全てローカル扱い */ }

			// %x00 をセパレータに使用
			const output = execSync(
				'git log --graph --all --oneline --decorate --format="%h%x00%s%x00%d%x00%ar%x00%an" -100',
				{ cwd: this.gitRoot, encoding: 'utf-8', maxBuffer: 1024 * 1024 },
			);
			for (const line of output.split('\n')) {
				if (!line.trim()) continue;
				// グラフ部分とデータ部分を分離
				const nullIdx = line.indexOf('\0');
				if (nullIdx === -1) {
					// グラフのみの行（マージライン等）
					this.items.push(new GraphItem(line.trim(), '', '', '', '', '', false));
					continue;
				}
				const parts = line.split('\0');
				const graphAndHash = parts[0];
				const message = parts[1] ?? '';
				const refs = (parts[2] ?? '').trim().replace(/^\(|\)$/g, '');
				const date = parts[3] ?? '';
				const author = parts[4] ?? '';

				// グラフ文字とハッシュを分離
				const hashMatch = graphAndHash.match(/([0-9a-f]{7,})\s*$/);
				const hash = hashMatch ? hashMatch[1] : '';
				let graph = hashMatch ? graphAndHash.substring(0, hashMatch.index).trimEnd() : graphAndHash;
				// 分岐なし（* のみ）の場合は * を除去
				if (graph.replace(/\s/g, '') === '*') {
					graph = '';
				}

				const isLocal = hash ? localOnlyHashes.has(hash) : false;
				this.items.push(new GraphItem(graph, hash, message, refs, date, author, isLocal));
			}
			return this.items;
		} catch {
			return [];
		}
	}

	dispose(): void { /* nothing */ }
}
