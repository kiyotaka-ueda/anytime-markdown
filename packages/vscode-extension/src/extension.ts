import * as vscode from 'vscode';
import { MarkdownEditorProvider } from './providers/MarkdownEditorProvider';
import { GitHistoryProvider, GitHistoryItem } from './providers/GitHistoryProvider';
import { OutlineProvider } from './providers/OutlineProvider';
import { CommentProvider } from './providers/CommentProvider';
import type { CommentData } from './providers/CommentProvider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(MarkdownEditorProvider.register(context));

	// Git 履歴パネル
	const gitHistoryProvider = new GitHistoryProvider();
	const gitTreeView = vscode.window.createTreeView('anytimeMarkdown.gitHistory', {
		treeDataProvider: gitHistoryProvider,
	});

	// アウトラインパネル
	const outlineProvider = new OutlineProvider();
	const outlineTreeView = vscode.window.createTreeView('anytimeMarkdown.outline', {
		treeDataProvider: outlineProvider,
		showCollapseAll: true,
	});

	// コメントパネル
	const commentProvider = new CommentProvider();
	const commentTreeView = vscode.window.createTreeView('anytimeMarkdown.comments', {
		treeDataProvider: commentProvider,
	});

	// Webview からの変更通知を各パネルに反映
	const provider = MarkdownEditorProvider.getInstance();
	if (provider) {
		provider.onHeadingsChanged = (headings) => {
			outlineProvider.update(headings as Array<{ level: number; text: string; pos: number; kind: string }>);
		};
		provider.onCommentsChanged = (comments) => {
			commentProvider.update(comments as CommentData[]);
		};
	}

	// アクティブドキュメント変更時に履歴を更新
	const updateGitHistory = () => {
		const p = MarkdownEditorProvider.getInstance();
		gitHistoryProvider.refresh(p?.activeDocumentUri ?? null);
	};

	// カスタムエディタのアクティブ変更を監視
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(() => updateGitHistory()),
	);

	// activeDocumentUri の変更を検出するためのポーリング
	let lastActiveUri: string | null = null;
	const intervalId = setInterval(() => {
		const p = MarkdownEditorProvider.getInstance();
		const currentUri = p?.activeDocumentUri?.toString() ?? null;
		if (currentUri !== lastActiveUri) {
			lastActiveUri = currentUri;
			updateGitHistory();
			// アクティブドキュメントが変わったらアウトラインをクリア（新しい見出しが来るまで）
			if (!currentUri) {
				outlineProvider.clear();
				commentProvider.clear();
			}
		}
		// コールバックの再設定（Provider 再生成時の対応）
		const currentProvider = MarkdownEditorProvider.getInstance();
		if (currentProvider && !currentProvider.onHeadingsChanged) {
			currentProvider.onHeadingsChanged = (headings) => {
				outlineProvider.update(headings as Array<{ level: number; text: string; pos: number; kind: string }>);
			};
		}
		if (currentProvider && !currentProvider.onCommentsChanged) {
			currentProvider.onCommentsChanged = (comments) => {
				commentProvider.update(comments as CommentData[]);
			};
		}
	}, 500);
	context.subscriptions.push({ dispose: () => clearInterval(intervalId) });

	const openEditorWithFile = vscode.commands.registerCommand(
		'anytime-markdown.openEditorWithFile',
		(uri?: vscode.Uri) => {
			const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;
			if (fileUri) {
				vscode.commands.executeCommand(
					'vscode.openWith',
					fileUri,
					MarkdownEditorProvider.viewType
				);
			}
		}
	);

	const compareCmd = vscode.commands.registerCommand(
		'anytime-markdown.compareWithMarkdownEditor',
		async (uri?: vscode.Uri) => {
			const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;
			if (!fileUri) { return; }
			const p = MarkdownEditorProvider.getInstance();
			if (!p) { return; }
			const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
			p.compareFileUri = fileUri;
			p.postMessageToActivePanel({
				type: 'loadCompareFile',
				content,
			});
		}
	);

	const compareWithCommit = vscode.commands.registerCommand(
		'anytime-markdown.compareWithCommit',
		async (item: GitHistoryItem) => {
			const p = MarkdownEditorProvider.getInstance();
			if (!p) { return; }
			const content = await gitHistoryProvider.getCommitContent(item);
			if (content == null) {
				vscode.window.showWarningMessage('Could not load file content for this commit.');
				return;
			}
			p.compareFileUri = null;
			p.postMessageToActivePanel({
				type: 'loadCompareFile',
				content,
			});
		}
	);

	const scrollToHeading = vscode.commands.registerCommand(
		'anytime-markdown.scrollToHeading',
		(pos: number) => {
			const p = MarkdownEditorProvider.getInstance();
			p?.postMessageToActivePanel({ type: 'scrollToHeading', pos });
		}
	);

	const scrollToComment = vscode.commands.registerCommand(
		'anytime-markdown.scrollToComment',
		(pos: number) => {
			const p = MarkdownEditorProvider.getInstance();
			p?.postMessageToActivePanel({ type: 'scrollToComment', pos });
		}
	);

	const resolveComment = vscode.commands.registerCommand(
		'anytime-markdown.resolveComment',
		(item: { comment?: { id?: string } }) => {
			const id = item?.comment?.id;
			if (!id) return;
			const p = MarkdownEditorProvider.getInstance();
			p?.postMessageToActivePanel({ type: 'resolveComment', id });
		}
	);

	const unresolveComment = vscode.commands.registerCommand(
		'anytime-markdown.unresolveComment',
		(item: { comment?: { id?: string } }) => {
			const id = item?.comment?.id;
			if (!id) return;
			const p = MarkdownEditorProvider.getInstance();
			p?.postMessageToActivePanel({ type: 'unresolveComment', id });
		}
	);

	const deleteComment = vscode.commands.registerCommand(
		'anytime-markdown.deleteComment',
		(item: { comment?: { id?: string } }) => {
			const id = item?.comment?.id;
			if (!id) return;
			const p = MarkdownEditorProvider.getInstance();
			p?.postMessageToActivePanel({ type: 'deleteComment', id });
		}
	);

	// コメントフィルタ
	const filterCommentsAll = vscode.commands.registerCommand(
		'anytime-markdown.filterCommentsAll', () => commentProvider.setFilter('all')
	);
	const filterCommentsOpen = vscode.commands.registerCommand(
		'anytime-markdown.filterCommentsOpen', () => commentProvider.setFilter('open')
	);
	const filterCommentsResolved = vscode.commands.registerCommand(
		'anytime-markdown.filterCommentsResolved', () => commentProvider.setFilter('resolved')
	);

	const toggleSectionNumbers = vscode.commands.registerCommand(
		'anytime-markdown.toggleSectionNumbers',
		() => {
			outlineProvider.toggleSectionNumbers();
			const p = MarkdownEditorProvider.getInstance();
			p?.postMessageToActivePanel({
				type: 'toggleSectionNumbers',
				show: outlineProvider.showSectionNumbers,
			});
		}
	);

	const toggleBlockElements = vscode.commands.registerCommand(
		'anytime-markdown.toggleBlockElements',
		() => {
			outlineProvider.toggleBlockElements();
		}
	);

	context.subscriptions.push(
		gitTreeView, outlineTreeView, commentTreeView,
		openEditorWithFile, compareCmd, compareWithCommit, scrollToHeading,
		scrollToComment, resolveComment, unresolveComment, deleteComment,
		filterCommentsAll, filterCommentsOpen, filterCommentsResolved,
		toggleSectionNumbers, toggleBlockElements,
	);
}

export function deactivate() {}
