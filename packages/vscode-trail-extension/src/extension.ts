import * as fs from 'node:fs';
import * as path from 'node:path';

import { setupClaudeHooks } from '@anytime-markdown/vscode-common';
import * as vscode from 'vscode';

import { registerTraceCommands } from './commands/traceCommands';
import { CodeGraphService } from './graph/CodeGraphService';
import { GraphDetector } from './graph/GraphDetector';
import { AiNoteItem,AiNoteProvider } from './providers/AiNoteProvider';
import { TraceCodeLensProvider } from './providers/TraceCodeLensProvider';
import { TraceScriptLensProvider } from './providers/TraceScriptLensProvider';
import { TrailDataServer } from './server/TrailDataServer';
import { TrailDatabase, ExecFileGitService } from '@anytime-markdown/trail-db';
import { analyze } from '@anytime-markdown/trail-core';
import { DatabaseProvider } from './trail/DatabaseProvider';
import { TrailPanel } from './trail/TrailPanel';
import { TrailLogger } from './utils/TrailLogger';

let trailDataServer: TrailDataServer | undefined;
let trailDb: TrailDatabase | undefined;
let extensionDistPath = '';

const EXCLUDE_PATTERNS: readonly string[] = ['.worktrees', '.vscode-test', '__tests__', 'fixtures'];

function getEffectiveWorkspacePath(): string | undefined {
	const configured = vscode.workspace.getConfiguration('anytimeTrail.workspace').get<string>('path', '').trim();
	return configured || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function applyDocsPathConfig(): void {
	const docsPath = vscode.workspace.getConfiguration('anytimeTrail.workspace').get<string>('docsPath', '');
	trailDataServer?.setDocsPath(docsPath || undefined);
}

function setupServerCallbacks(server: TrailDataServer): void {
	applyDocsPathConfig();
	server.onOpenDocLink = (docPath) => {
		const docsDir = vscode.workspace.getConfiguration('anytimeTrail.workspace').get<string>('docsPath', '');
		if (!docsDir) return;
		const uri = vscode.Uri.file(path.join(docsDir, docPath));
		vscode.commands.executeCommand('vscode.openWith', uri, 'anytimeMarkdown').then(
			undefined,
			() => {
				vscode.workspace.openTextDocument(uri).then(
					(doc) => vscode.window.showTextDocument(doc),
					() => vscode.window.showWarningMessage(`File not found: ${uri.fsPath}`),
				);
			},
		);
	};
	server.onOpenFile = (filePath) => {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) return;
		const uri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, filePath));
		vscode.workspace.openTextDocument(uri).then(
			(doc) => vscode.window.showTextDocument(doc),
			() => vscode.window.showWarningMessage(`File not found: ${uri.fsPath}`),
		);
	};
}

export async function activate(context: vscode.ExtensionContext) {
	extensionDistPath = path.join(context.extensionUri.fsPath, 'dist');

	// Claude Code hook を ~/.claude/settings.json に自動登録
	const claudeStatusDirSetting = vscode.workspace.getConfiguration('anytimeTrail.claudeStatus').get<string>('directory', '') || '.vscode';
	const trailPortForHooks = vscode.workspace.getConfiguration('anytimeTrail.viewer').get<number>('port', 19841);
	{
		const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (wsRoot) {
			const registered = setupClaudeHooks(wsRoot, claudeStatusDirSetting, trailPortForHooks);
			TrailLogger.info(`Claude hooks setup: ${registered ? 'registered' : 'skipped (already registered or .claude not found)'}`);
		}
	}

	// Agent Note ビュー
	const noteStorageDir = context.globalStorageUri.fsPath;
	const aiNoteProvider = new AiNoteProvider(noteStorageDir);
	const aiNoteTreeView = vscode.window.createTreeView('anytimeTrail.aiNote', {
		treeDataProvider: aiNoteProvider,
	});

	const noteWatcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(vscode.Uri.file(noteStorageDir), 'anytime-note-*.md')
	);
	noteWatcher.onDidCreate(() => aiNoteProvider.refresh());
	noteWatcher.onDidDelete(() => aiNoteProvider.refresh());

	/** ノートファイルをカスタムエディタで開く */
	async function openNoteFile(filePath: string): Promise<void> {
		const uri = vscode.Uri.file(filePath);
		for (const group of vscode.window.tabGroups.all) {
			for (const tab of group.tabs) {
				const input = tab.input as { uri?: vscode.Uri } | undefined;
				if (input?.uri?.fsPath === uri.fsPath) {
					await vscode.window.tabGroups.close(tab, true);
				}
			}
		}
		try {
			await vscode.commands.executeCommand('vscode.openWith', uri, 'anytimeMarkdown');
		} catch {
			vscode.window.showErrorMessage(`ノートファイルを開けませんでした: ${filePath}`);
		}
	}

	const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '';
	const claudeDir = homeDir ? path.join(homeDir, '.claude') : '';
	const hasClaudeDir = Boolean(claudeDir) && fs.existsSync(claudeDir);

	const openAiNote = vscode.commands.registerCommand(
		'anytime-trail.openAiNote',
		async () => {
			const dir = noteStorageDir;
			const filePath = path.join(dir, 'anytime-note-1.md');
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			try {
				fs.writeFileSync(filePath, '', { encoding: 'utf-8', flag: 'wx' });
			} catch {
				// EEXIST: ファイル既存は正常
			}
			aiNoteProvider.refresh();

			if (hasClaudeDir) {
				const skillDir = path.join(claudeDir, 'skills', 'anytime-note');
				const skillPath = path.join(skillDir, 'SKILL.md');
				try {
					fs.mkdirSync(skillDir, { recursive: true });
					const imagesDir = path.join(dir, 'images');
					const skillContent = [
						'---',
						'name: anytime-note',
						'description: Agent Note（anytime-note-N.md）を読んで指示を実行する。「/anytime-note [ページ番号] 対応内容」の形式で使用。ノートに書かれたコンテキスト（画像・テキスト・メモ）を参照し、指示された作業を行う。',
						'user_invocable: true',
						'argument: task',
						'---',
						'',
						'# Agent Note 連携',
						'',
						'## 引継ぎモード',
						'',
						'引数が「引継ぎ」の場合、以下の手順で実行する。',
						'',
						'1. 最新の要約ページを特定する',
						'',
						`   - ノートフォルダ: \`${dir}\``,
						'   - フォルダ内の `anytime-note-*.md` を Glob で検索し、最大番号のファイルを読み込む',
						'   - ファイルが見つからない場合は「要約ページがありません」と表示して終了する',
						'',
						'2. 要約ページの内容を読み込む',
						'',
						'   - Read ツールでファイルを読み込む',
						`   - 画像フォルダ: \`${imagesDir}\``,
						'   - 画像が参照されている場合は画像も読み込む',
						'',
						'3. 内容をユーザーに報告する（変更点と次にやることを簡潔に伝える）',
						'',
						'4. 「次にやること」セクションの最初の未完了タスクから作業を開始する（ユーザーに確認してから進める）',
						'',
						'## 要約モード',
						'',
						'引数が「要約」の場合、以下の手順で実行する。**このモードのみノートの新規作成・書き込みを許可する。**',
						'',
						'1. 現在の変更点を収集する',
						'',
						'   - `git log --oneline -20` で直近のコミットを確認する',
						'   - `git diff --stat` で未コミットの変更を確認する',
						'   - 会話の中で実施した作業内容を振り返る',
						'',
						'2. 次にやるべきことを整理する（未完了のタスク、保留事項、既知の問題）',
						'',
						'3. 新規ノートページを作成する',
						'',
						`   - ノートフォルダ: \`${dir}\``,
						'   - フォルダ内の `anytime-note-*.md` を Glob で検索し、最大番号 + 1 のファイル名で作成する',
						'',
						'4. 要約内容を書き出す（フロントマター + # 要約 (YYYY-MM-DD) / ## 変更点 / ## 次にやること の形式）',
						'',
						'   フロントマター:',
						'   ```',
						'   ---',
						'   title: "要約 (YYYY-MM-DD)"',
						'   date: "YYYY-MM-DD"',
						'   type: "summary"',
						'   ---',
						'   ```',
						'',
						'5. ユーザーに作成したページ番号と要約内容を報告する',
						'',
						'## 通常モード',
						'',
						'引数が「要約」「引継ぎ」以外の場合、以下の手順で実行する。',
						'',
						'1. 引数からページ番号を判定する',
						'',
						'   - 引数の先頭が数字の場合、その数字をページ番号として使用し、残りを作業内容とする',
						'   - 引数の先頭が数字でない場合、ページ番号は指定なし（最小番号を使用）',
						'   - 引数が空の場合もページ番号は指定なし',
						'',
						'2. Agent Note ファイルを読み込む',
						'',
						`   - ノートフォルダ: \`${dir}\``,
						`   - 画像フォルダ: \`${imagesDir}\``,
						'   - ページ番号が指定された場合: `anytime-note-{N}.md` を読み込む',
						'   - ページ番号が指定されない場合: フォルダ内の `anytime-note-*.md` を Glob で検索し、最小番号のファイルを読み込む',
						'   - 画像が参照されている場合は Read ツールで画像も読み込む',
						'',
						'3. ノート内容を確認し、ユーザーに概要を報告する',
						'',
						'4. 引数で指定された作業を、ノートの内容をコンテキストとして実行する',
						'',
						'   - 引数が空の場合はノート内容を要約し、何をすべきか提案する',
						'   - 引数がある場合はノートを踏まえて作業を実行する',
						'',
						'## 注意事項',
						'',
						'- 既存のノートを変更・削除しない（読み取り専用）',
						'- 「要約」モードの場合のみ、新規ページの作成と書き込みを許可する',
						'- 作業結果はノートではなく、通常のコードベースやドキュメントに出力する',
						'',
					].join('\n');
					fs.writeFileSync(skillPath, skillContent, { encoding: 'utf-8', flag: 'wx' });
				} catch {
					// EEXIST: ファイル既存は正常
				}
			}

			await openNoteFile(filePath);
		}
	);

	const openAiNoteSkill = vscode.commands.registerCommand(
		'anytime-trail.openAiNoteSkill',
		async () => {
			const skillPath = path.join(homeDir, '.claude', 'skills', 'anytime-note', 'SKILL.md');
			if (!fs.existsSync(skillPath)) {
				vscode.window.showWarningMessage('スキルファイルが見つかりません。先にノートを作成してください。');
				return;
			}
			await openNoteFile(skillPath);
		}
	);

	const copyAiNotePath = vscode.commands.registerCommand(
		'anytime-trail.copyAiNotePath',
		async () => {
			const filePath = path.join(noteStorageDir, 'anytime-context.md');
			await vscode.env.clipboard.writeText(filePath);
			vscode.window.showInformationMessage(`Copied: ${filePath}`);
		}
	);

	const clearAiNote = vscode.commands.registerCommand(
		'anytime-trail.clearAiNote',
		async () => {
			const answer = await vscode.window.showWarningMessage(
				'すべてのノートページと画像を削除しますか？',
				{ modal: true },
				'Delete'
			);
			if (answer !== 'Delete') { return; }
			if (fs.existsSync(noteStorageDir)) {
				for (const f of fs.readdirSync(noteStorageDir)) {
					if (f.startsWith('anytime-note') && f.endsWith('.md')) {
						fs.rmSync(path.join(noteStorageDir, f));
					}
				}
				const imagesDir = path.join(noteStorageDir, 'images');
				if (fs.existsSync(imagesDir)) {
					fs.rmSync(imagesDir, { recursive: true, force: true });
				}
			}
			aiNoteProvider.refresh();
			vscode.window.showInformationMessage('ノートをクリアしました。');
		}
	);

	const addAiNotePage = vscode.commands.registerCommand(
		'anytime-trail.addAiNotePage',
		async () => {
			const dir = noteStorageDir;
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			const existing = fs.existsSync(dir)
				? fs.readdirSync(dir)
					.filter(f => /^anytime-note-\d+\.md$/.test(f))
					.map(f => Number.parseInt(f.replace('anytime-note-', '').replace('.md', ''), 10))
				: [];
			const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;
			const fileName = `anytime-note-${nextNum}.md`;
			const filePath = path.join(dir, fileName);
			fs.writeFileSync(filePath, '', { encoding: 'utf-8' });
			aiNoteProvider.refresh();
			await openNoteFile(filePath);
		}
	);

	const deleteAiNotePage = vscode.commands.registerCommand(
		'anytime-trail.deleteAiNotePage',
		async (item: AiNoteItem) => {
			const answer = await vscode.window.showWarningMessage(
				`"${item.label as string}" を削除しますか？`,
				{ modal: true },
				'Delete'
			);
			if (answer !== 'Delete') { return; }
			if (fs.existsSync(item.filePath)) {
				fs.rmSync(item.filePath);
			}
			aiNoteProvider.refresh();
		}
	);

	const openAiNotePage = vscode.commands.registerCommand(
		'anytime-trail.openAiNotePage',
		async (filePath: string) => {
			await openNoteFile(filePath);
		}
	);

	context.subscriptions.push(
		aiNoteTreeView,
		noteWatcher,
		openAiNote,
		openAiNoteSkill,
		copyAiNotePath,
		clearAiNote,
		addAiNotePage,
		deleteAiNotePage,
		openAiNotePage,
	);

	// Trail Database + Data Server (non-blocking initialization)
	const dbStoragePathSetting = vscode.workspace.getConfiguration('anytimeTrail.database').get<string>('storagePath', '') || '.vscode';
	const wsRootForDb = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	const dbStorageDir = path.isAbsolute(dbStoragePathSetting)
		? dbStoragePathSetting
		: wsRootForDb ? path.join(wsRootForDb, dbStoragePathSetting) : undefined;
	const backupGenerations = vscode.workspace.getConfiguration('anytimeTrail.database').get<number>('backupGenerations', 1);
	trailDb = new TrailDatabase(extensionDistPath, dbStorageDir, backupGenerations, TrailLogger);
	trailDb.setIntegrityAlertHandler((alerts) => {
		for (const a of alerts) {
			TrailLogger.warn(
				`[DatabaseIntegrity] Suspicious data loss in "${a.table}": ${a.previous} → ${a.current} rows ` +
					`(loss rate ${(a.lossRate * 100).toFixed(1)}%). Inspect write history immediately.`,
			);
		}
	});
	const gitRoot = wsRootForDb;
	trailDataServer = new TrailDataServer(extensionDistPath, trailDb, gitRoot);
	TrailPanel.setDataServer(trailDataServer);
	setupServerCallbacks(trailDataServer);

	// Code graph service
	const codeGraphRepos: { id: string; label: string; path: string }[] = [];
	const analysisWorkspacePath = getEffectiveWorkspacePath();
	if (analysisWorkspacePath) {
		codeGraphRepos.push({ id: 'Workspace', label: 'Workspace', path: analysisWorkspacePath });
	}

	const docsPathForCodeGraph = vscode.workspace.getConfiguration('anytimeTrail.workspace').get<string>('docsPath', '').trim();
	if (docsPathForCodeGraph && !codeGraphRepos.some((r) => r.path === docsPathForCodeGraph)) {
		codeGraphRepos.push({ id: 'Docs', label: 'Docs', path: docsPathForCodeGraph });
	}

	const codeGraphService = new CodeGraphService({
		repositories: codeGraphRepos,
		trailDb: trailDb!,
	});
	trailDataServer.setCodeGraphService(codeGraphService);
	// loadFromDb() は trailDb.init() 完了後に下の async IIFE 内で呼ぶ。
	// ここで呼ぶと DB 未初期化のまま ensureDb() が throw → null が返るため。

	context.subscriptions.push(
		vscode.commands.registerCommand('anytime-trail.analyzeCurrentCode', async () => {
			const analysisRoot = getEffectiveWorkspacePath();
			if (!analysisRoot) {
				vscode.window.showErrorMessage('解析対象のワークスペースが指定されていません。anytimeTrail.workspace.path を設定するか、ワークスペースを開いてください。');
				return;
			}
			let rootStat: fs.Stats;
			try {
				rootStat = fs.statSync(analysisRoot);
			} catch {
				vscode.window.showErrorMessage(`anytimeTrail.workspace.path のパスが存在しません: ${analysisRoot}`);
				return;
			}
			if (!rootStat.isDirectory()) {
				vscode.window.showErrorMessage(`anytimeTrail.workspace.path はディレクトリではありません: ${analysisRoot}`);
				return;
			}
			const repoName = path.basename(analysisRoot);
			TrailLogger.info(`C4 analysis [${repoName}]: searching tsconfig.json under ${analysisRoot}`);
			const tsconfigFiles = new GraphDetector(analysisRoot, EXCLUDE_PATTERNS)
				.detectFilesByName('tsconfig.json')
				.map(p => ({ fsPath: p, rel: path.relative(analysisRoot, p) }))
				.sort((a, b) => {
					const aDepth = a.rel.split(path.sep).length;
					const bDepth = b.rel.split(path.sep).length;
					return aDepth !== bDepth ? aDepth - bDepth : a.rel.localeCompare(b.rel);
				});
			if (tsconfigFiles.length === 0) {
				TrailLogger.warn(`C4 analysis [${repoName}]: no tsconfig.json found under ${analysisRoot}`);
				vscode.window.showWarningMessage(`No tsconfig.json found under ${analysisRoot}`);
				return;
			}

			let tsconfigPath: string;
			if (tsconfigFiles.length === 1) {
				tsconfigPath = tsconfigFiles[0].fsPath;
			} else {
				const items = tsconfigFiles.map(f => ({
					label: f.rel,
					description: f.rel === 'tsconfig.json' ? '(workspace root — analyzes all packages)' : undefined,
					fsPath: f.fsPath,
				}));
				const picked = await vscode.window.showQuickPick(items, {
					placeHolder: 'Select tsconfig.json to analyze',
					matchOnDescription: true,
				});
				if (!picked) {
					TrailLogger.info(`C4 analysis [${repoName}]: cancelled at tsconfig selection`);
					return;
				}
				tsconfigPath = picked.fsPath;
			}

			TrailLogger.info(`C4 analysis [${repoName}]: starting for ${tsconfigPath}`);
			const startedAt = Date.now();
			TrailPanel.openViewer(true);

			try {
				await vscode.window.withProgress(
					{ location: vscode.ProgressLocation.Notification, title: 'C4 Analysis', cancellable: false },
					async (progress) => {
						const phases = ['Loading project...', 'Extracting symbols...', 'Extracting dependencies...', 'Filtering results...'];
						const phasePercent = (phase: string): number => {
							const idx = phases.indexOf(phase);
							return idx >= 0 ? Math.round((idx / phases.length) * 100) : -1;
						};

						trailDataServer?.notifyProgress('Loading project...', 0);
						const graph = analyze({
							tsconfigPath,
							exclude: EXCLUDE_PATTERNS.map(p => `**/${p}/**`),
							onProgress: (phase) => {
								TrailLogger.info(`C4 analysis [${repoName}]: ${phase}`);
								progress.report({ message: phase });
								trailDataServer?.notifyProgress(phase, phasePercent(phase));
							},
						});

						TrailLogger.info(
							`C4 analysis [${repoName}]: analyzed ${graph.metadata.fileCount} files, ${graph.nodes.length} nodes, ${graph.edges.length} edges`,
						);

						const dbRepoName = path.basename(analysisRoot);
						let commitId = '';
						try {
							commitId = new ExecFileGitService(analysisRoot).getHeadCommit();
						} catch (err) {
							TrailLogger.warn(`C4 analysis [${repoName}]: getHeadCommit failed (not a git repo?): ${err instanceof Error ? err.message : String(err)}`);
						}
						trailDb?.saveCurrentGraph(graph, tsconfigPath, commitId, dbRepoName);
						TrailLogger.info(`C4 analysis [${repoName}]: TrailGraph saved to current_graphs (repo=${dbRepoName}, commit=${commitId || 'unknown'})`);

						try {
							progress.report({ message: 'Computing importance scores...' });
							await trailDataServer?.computeAndNotifyImportance(tsconfigPath);
							TrailLogger.info(`C4 analysis [${repoName}]: importance matrix computed and notified`);
						} catch (err) {
							TrailLogger.warn(`C4 analysis [${repoName}]: importance computation failed: ${err instanceof Error ? err.message : String(err)}`);
						}

						try {
							progress.report({ message: 'Generating code graph...' });
							await codeGraphService.generate((phase, percent) => {
								progress.report({ message: `Code graph: ${phase} (${percent}%)` });
								trailDataServer?.notifyCodeGraphProgress(phase, percent);
							});
							trailDataServer?.notifyCodeGraphUpdated();
						} catch (err) {
							TrailLogger.error(`C4 analysis [${repoName}]: code graph generation failed`, err);
							vscode.window.showWarningMessage(`Code graph generation failed: ${err instanceof Error ? err.message : String(err)}`);
						}

						if (trailDb) {
							try {
								const count = trailDb.importCurrentCoverage(analysisRoot, dbRepoName);
								TrailLogger.info(`C4 analysis [${repoName}]: current_coverage updated (${count} entries)`);
							} catch (err) {
								TrailLogger.warn(`C4 analysis [${repoName}]: importCurrentCoverage failed: ${err instanceof Error ? err.message : String(err)}`);
							}
						}

						trailDataServer?.notifyProgress('', 100);
					},
				);
				TrailLogger.info(`C4 analysis [${repoName}]: completed in ${Date.now() - startedAt}ms`);
				vscode.window.showInformationMessage('C4 analysis completed.');
			} catch (err) {
				TrailLogger.error(`C4 analysis [${repoName}] failed`, err);
				vscode.window.showErrorMessage(`C4 analysis failed: ${err instanceof Error ? err.message : String(err)}`);
			}
		}),
		vscode.commands.registerCommand('anytime-trail.analyzeReleaseCode', async () => {
			if (!trailDb) {
				vscode.window.showErrorMessage('Trail DB is not initialized.');
				return;
			}
			if (!gitRoot) {
				vscode.window.showErrorMessage('No workspace folder found.');
				return;
			}
			await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: 'Trail: Analyze Release Code', cancellable: false },
				async (progress) => {
					try {
						progress.report({ message: 'Clearing release code graphs...' });
						trailDb!.deleteReleaseCodeGraphs();
						progress.report({ message: 'Analyzing release code...' });
						const count = await trailDb!.analyzeReleaseCodeGraphsForce({
							codeGraphService,
							gitRoot,
							onProgress: (msg) => progress.report({ message: msg }),
						});
						vscode.window.showInformationMessage(`Release code analyzed (${count} releases).`);
					} catch (err) {
						TrailLogger.error('Failed to analyze release code', err);
						vscode.window.showErrorMessage(`Analyze release code failed: ${err instanceof Error ? err.message : String(err)}`);
					}
				},
			);
		}),
	);

	const trailPort = vscode.workspace.getConfiguration('anytimeTrail.viewer').get<number>('port', 19841);

	// Database panel
	const databaseProvider = new DatabaseProvider(trailDb);
	const databaseTreeView = vscode.window.createTreeView('anytimeTrail.database', {
		treeDataProvider: databaseProvider,
	});

	// Initialize DB and start server in background — do not block activate
	void (async () => {
		try {
			TrailLogger.info(`Trail DB: initializing with distPath=${extensionDistPath}`);
			await trailDb!.init();
			databaseProvider.updateSqliteStatus('Ready', trailDb!.getLastImportedAt());
			TrailLogger.info('Trail DB: initialized');
			// DB 初期化完了後に loadFromDb() を実行（初期化前に呼ぶと ensureDb が throw するため）
			const dbGraph = await codeGraphService!.loadFromDb();
			if (dbGraph) {
				trailDataServer?.notifyCodeGraphUpdated();
			}
		} catch (err) {
			TrailLogger.error('Failed to initialize trail database', err);
			databaseProvider.updateSqliteStatus('Error');
			return; // DB 初期化失敗時はサーバー起動もスキップ
		}
		try {
			TrailLogger.info(`Trail Data Server: starting on port ${trailPort}...`);
			await trailDataServer!.start(trailPort);
			TrailLogger.info(`Trail Data Server started on port ${trailPort}`);

			// トークン予算設定を反映
			const budgetConfig = vscode.workspace.getConfiguration('anytimeTrail.budget');
			trailDataServer!.setTokenBudgetConfig({
				dailyLimitTokens: budgetConfig.get<number | null>('dailyLimitTokens', null),
				sessionLimitTokens: budgetConfig.get<number | null>('sessionLimitTokens', null),
				alertThresholdPct: budgetConfig.get<number>('alertThresholdPct', 80),
			});

			// 閾値超過時の VS Code 通知
			trailDataServer!.onTokenBudgetExceeded = (status) => {
				const sessionLabel = status.sessionId.slice(0, 8);
				const messages: string[] = [];
				if (status.dailyLimitTokens !== null && status.dailyTokens >= status.dailyLimitTokens * status.alertThresholdPct / 100) {
					messages.push(`[${sessionLabel}] 本日のトークン使用量が上限の ${status.alertThresholdPct}% を超えました（${status.dailyTokens.toLocaleString()} / ${status.dailyLimitTokens.toLocaleString()}）`);
				}
				if (status.sessionLimitTokens !== null && status.sessionTokens >= status.sessionLimitTokens * status.alertThresholdPct / 100) {
					messages.push(`[${sessionLabel}] 現セッションのトークン使用量が上限の ${status.alertThresholdPct}% を超えました（${status.sessionTokens.toLocaleString()} / ${status.sessionLimitTokens.toLocaleString()}）`);
				}
				for (const msg of messages) {
					void vscode.window.showWarningMessage(msg);
					TrailLogger.warn(msg);
				}
			};
		} catch (err) {
			TrailLogger.error('Trail Data Server failed to start', err);
			const message = err instanceof Error ? err.message : String(err);
			// EADDRINUSE は別 VS Code ウィンドウが同じポートを掴んでいるケースが圧倒的に多いので、
			// OutputChannel のみだとユーザーが trail viewer 不通の原因に気付けない。
			// 通知でポートと回復策を示す。
			const isPortConflict = /EADDRINUSE|already in use/i.test(message);
			const userMsg = isPortConflict
				? `Trail Data Server failed to bind port ${trailPort} (already in use). 別の VS Code ウィンドウが同じポートを掴んでいる可能性が高いです。古いウィンドウを閉じるか anytimeTrail.viewer.port 設定で別ポートに変更してください。`
				: `Trail Data Server failed to start: ${message}`;
			void vscode.window.showErrorMessage(userMsg);
		}
	})().catch((err) => {
		TrailLogger.error('Unexpected error during initialization', err);
		void vscode.window.showErrorMessage(`Anytime Trail initialization failed: ${err instanceof Error ? err.message : String(err)}`);
	});

	context.subscriptions.push(
		vscode.commands.registerCommand('anytime-trail.openTrailViewer', () => {
			TrailPanel.openViewer(true);
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('anytime-trail.restoreBackup', async (arg?: number) => {
			if (!trailDb) {
				vscode.window.showErrorMessage('Trail DB is not initialized.');
				return;
			}
			const entries = trailDb.listBackups();
			if (entries.length === 0) {
				vscode.window.showInformationMessage(
					'No backups available yet. Backups are created on the first save of each VS Code session.',
				);
				return;
			}
			let generation: number | undefined = typeof arg === 'number' ? arg : undefined;
			if (generation === undefined) {
				const items = entries.map((e) => ({
					label: `$(history) Generation ${e.generation}`,
					description: e.mtime.toLocaleString(),
					detail: `${(e.compressedSize / 1024 / 1024).toFixed(2)} MB (gzip) · ${e.path}`,
					generation: e.generation,
				}));
				const picked = await vscode.window.showQuickPick(items, {
					title: 'Restore Trail DB from backup',
					placeHolder: 'Select a generation to restore (current DB will be saved as .restore-safety-*)',
					ignoreFocusOut: true,
				});
				if (!picked) return;
				generation = picked.generation;
			}
			if (!entries.some((e) => e.generation === generation)) {
				vscode.window.showErrorMessage(`Backup generation ${generation} not found.`);
				return;
			}
			const confirm = await vscode.window.showWarningMessage(
				`Restore Trail DB from generation ${generation}? ` +
				'The current DB will be backed up to a .restore-safety-* file. ' +
				'You must reload the VS Code window after restore for changes to take effect.',
				{ modal: true },
				'Restore',
			);
			if (confirm !== 'Restore') return;
			try {
				const result = trailDb.restoreFromBackup(generation);
				TrailLogger.info(
					`Trail DB restored from ${result.restoredFrom}; safety copy at ${result.safetyCopy ?? '(none)'}`,
				);
				databaseProvider.refresh();
				const reload = await vscode.window.showInformationMessage(
					`Restored from generation ${generation}. Reload the window now?`,
					'Reload Window',
				);
				if (reload === 'Reload Window') {
					await vscode.commands.executeCommand('workbench.action.reloadWindow');
				}
			} catch (err) {
				TrailLogger.error('Trail DB restore failed', err);
				vscode.window.showErrorMessage(
					`Restore failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('anytime-trail.analyzeAll', async () => {
			const repoName = vscode.workspace.workspaceFolders?.[0]?.name ?? '(no workspace)';
			if (!trailDb) {
				TrailLogger.error(`Trail import [${repoName}] skipped: trailDb is null (not initialized)`);
				return;
			}
			TrailLogger.info(`Trail DB [${repoName}]: import started`);
			databaseProvider.setImporting(true);
			try {
				const result = await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: 'Trail: Refreshing Trail Data',
						cancellable: false,
					},
					async (progress) => {
						const gitRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
						return trailDb!.importAll((message, increment) => {
							progress.report({ message, increment });
							TrailLogger.info(`Trail import [${repoName}]: ${message}`);
						}, gitRoot, EXCLUDE_PATTERNS);
					},
				);
				TrailLogger.info(`Trail DB [${repoName}]: import complete - imported=${result.imported}, skipped=${result.skipped}, commits=${result.commitsResolved}, releases=${result.releasesResolved}, analyzed=${result.releasesAnalyzed}`);
				databaseProvider.updateSqliteStatus('Ready', trailDb.getLastImportedAt());
				databaseProvider.setImporting(false);

				trailDataServer?.notifySessionsUpdated();

				vscode.window.showInformationMessage(
					`Trail: imported ${result.imported} sessions, ${result.commitsResolved} commits linked, ${result.releasesResolved} releases resolved, ${result.releasesAnalyzed} releases analyzed, ${result.coverageImported} coverage entries (${result.skipped} skipped)`,
				);
			} catch (err) {
				databaseProvider.setImporting(false);
				databaseProvider.updateSqliteStatus('Import failed');
				TrailLogger.error(`Trail import [${repoName}] failed`, err);
			}
		}),
	);

	context.subscriptions.push({
		dispose: () => {
			trailDataServer?.stop().catch(() => {});
			trailDb?.close();
		},
	});

	// Watch for configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('anytimeTrail.workspace.docsPath')) {
				applyDocsPathConfig();
			}
			if (e.affectsConfiguration('anytimeTrail.budget') && trailDataServer) {
				const budgetConfig = vscode.workspace.getConfiguration('anytimeTrail.budget');
				trailDataServer.setTokenBudgetConfig({
					dailyLimitTokens: budgetConfig.get<number | null>('dailyLimitTokens', null),
					sessionLimitTokens: budgetConfig.get<number | null>('sessionLimitTokens', null),
					alertThresholdPct: budgetConfig.get<number>('alertThresholdPct', 80),
				});
			}
		}),
	);

	context.subscriptions.push(
		databaseTreeView,
	);

	// Trace CodeLens providers
	const testSelector: vscode.DocumentSelector = [
		{ language: 'typescript', scheme: 'file' },
		{ language: 'javascript', scheme: 'file' },
	];
	const jsonSelector: vscode.DocumentSelector = { language: 'json', scheme: 'file' };
	context.subscriptions.push(
		vscode.languages.registerCodeLensProvider(testSelector, new TraceCodeLensProvider()),
		vscode.languages.registerCodeLensProvider(jsonSelector, new TraceScriptLensProvider()),
	);

	// Trace run command
	registerTraceCommands(context);

	// .vscode/trace/ watcher: notify when a new trace file is created
	if (wsRootForDb) {
		const traceDir = vscode.Uri.file(path.join(wsRootForDb, '.vscode', 'trace'));
		const traceWatcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(traceDir, '*.json'),
		);
		traceWatcher.onDidCreate((uri) => {
			const fileName = path.basename(uri.fsPath);
			void vscode.window.showInformationMessage(
				`トレースファイルを保存しました: ${fileName}`,
				'Trail Viewer で開く',
			).then((action) => {
				if (action === 'Trail Viewer で開く') {
					void vscode.commands.executeCommand('anytime-trail.openTrailViewer');
				}
			});
		});
		context.subscriptions.push(traceWatcher);
	}
}

export function deactivate(): void {
	trailDataServer?.stop().catch((err) => TrailLogger.error('Failed to stop trail data server', err));
	trailDb?.close();
	TrailLogger.dispose();
}
