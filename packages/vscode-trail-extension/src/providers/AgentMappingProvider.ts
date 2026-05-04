import * as cp from 'node:child_process';
import * as vscode from 'vscode';
import { ClaudeStatusWatcher } from '@anytime-markdown/vscode-common';
import { buildAgentMapping } from '@anytime-markdown/trail-core';
import type { WorktreeEntry, WorktreeMapping } from '@anytime-markdown/trail-core';
import { WorktreeTreeItem, SessionTreeItem } from './AgentMappingItem';

type AgentMappingItem = WorktreeTreeItem | SessionTreeItem;

const WORKTREE_CACHE_TTL_MS = 30_000;

export class AgentMappingProvider
  implements vscode.TreeDataProvider<AgentMappingItem>, vscode.Disposable
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _showStale = true;
  private _cachedWorktrees: readonly WorktreeEntry[] = [];
  private _worktreeCacheExpiry = 0;

  constructor(
    private readonly watcher: ClaudeStatusWatcher,
    private readonly gitRoot: string,
  ) {
    watcher.onMultiStatusChange(() => this.refresh());
  }

  get showStale(): boolean { return this._showStale; }

  toggleStale(): void {
    this._showStale = !this._showStale;
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AgentMappingItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AgentMappingItem): AgentMappingItem[] {
    if (element instanceof WorktreeTreeItem) {
      return element.mapping.sessions.map(s => new SessionTreeItem(s));
    }
    const agents = [...this.watcher.getAgents().values()];
    const worktrees = this._getWorktreesCached();
    const mappings = buildAgentMapping(agents, worktrees);
    const filtered = this._showStale
      ? mappings
      : mappings.filter(m => m.aggregatedState !== 'stale');
    return filtered.map(m => new WorktreeTreeItem(m));
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }

  cleanupStale(): void {
    void vscode.window.showInformationMessage(
      'To delete a stale status file, right-click a session node.',
    );
    this.refresh();
  }

  private _getWorktreesCached(): readonly WorktreeEntry[] {
    const now = Date.now();
    if (now < this._worktreeCacheExpiry) {
      return this._cachedWorktrees;
    }
    this._cachedWorktrees = this._fetchWorktrees();
    this._worktreeCacheExpiry = now + WORKTREE_CACHE_TTL_MS;
    return this._cachedWorktrees;
  }

  private _fetchWorktrees(): readonly WorktreeEntry[] {
    try {
      const output = cp.execSync('git worktree list --porcelain', {
        cwd: this.gitRoot,
        encoding: 'utf-8',
        timeout: 5000,
      });
      return parseWorktreeList(output);
    } catch {
      return [];
    }
  }
}

interface MutableWorktreeEntry {
  path?: string;
  branch?: string;
  isMain?: boolean;
}

function parseWorktreeList(output: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  let current: MutableWorktreeEntry = {};
  let isFirst = true;
  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) {
        entries.push({
          path: current.path,
          branch: current.branch ?? '(detached)',
          isMain: current.isMain ?? false,
        });
      }
      current = { path: line.slice('worktree '.length).trim(), isMain: isFirst };
      isFirst = false;
    } else if (line.startsWith('branch refs/heads/')) {
      current.branch = line.slice('branch refs/heads/'.length);
    }
  }
  if (current.path) {
    entries.push({
      path: current.path,
      branch: current.branch ?? '(detached)',
      isMain: current.isMain ?? false,
    });
  }
  return entries;
}
