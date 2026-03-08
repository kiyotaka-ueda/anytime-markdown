import * as vscode from 'vscode';
import { MarkdownEditorProvider } from './providers/MarkdownEditorProvider';
import { GitHistoryProvider, GitHistoryItem } from './providers/GitHistoryProvider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(MarkdownEditorProvider.register(context));

	// Git 履歴パネル
	const gitHistoryProvider = new GitHistoryProvider();
	const treeView = vscode.window.createTreeView('anytimeMarkdown.gitHistory', {
		treeDataProvider: gitHistoryProvider,
	});

	// アクティブドキュメント変更時に履歴を更新
	const updateGitHistory = () => {
		const provider = MarkdownEditorProvider.getInstance();
		gitHistoryProvider.refresh(provider?.activeDocumentUri ?? null);
	};

	// カスタムエディタのアクティブ変更を監視
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(() => updateGitHistory()),
		// Webview パネルのフォーカスは onDidChangeActiveTextEditor では検出できないため、
		// activeDocumentUri の変更を定期的にチェック
	);

	// activeDocumentUri の変更を検出するためのポーリング
	let lastActiveUri: string | null = null;
	const intervalId = setInterval(() => {
		const provider = MarkdownEditorProvider.getInstance();
		const currentUri = provider?.activeDocumentUri?.toString() ?? null;
		if (currentUri !== lastActiveUri) {
			lastActiveUri = currentUri;
			updateGitHistory();
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
			const provider = MarkdownEditorProvider.getInstance();
			if (!provider) { return; }
			const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
			provider.compareFileUri = fileUri;
			provider.postMessageToActivePanel({
				type: 'loadCompareFile',
				content,
			});
		}
	);

	const compareWithCommit = vscode.commands.registerCommand(
		'anytime-markdown.compareWithCommit',
		async (item: GitHistoryItem) => {
			const provider = MarkdownEditorProvider.getInstance();
			if (!provider) { return; }
			const content = await gitHistoryProvider.getCommitContent(item);
			if (content == null) {
				vscode.window.showWarningMessage('Could not load file content for this commit.');
				return;
			}
			provider.compareFileUri = null;
			provider.postMessageToActivePanel({
				type: 'loadCompareFile',
				content,
			});
		}
	);

	context.subscriptions.push(treeView, openEditorWithFile, compareCmd, compareWithCommit);
}

export function deactivate() {}
