import * as vscode from 'vscode';
import type { WorktreeMapping, SessionMapping, MappingState } from '@anytime-markdown/trail-core';

// アイコン: ThemeIcon + ThemeColor
const STATE_ICONS: Record<MappingState, vscode.ThemeIcon> = {
  active: new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green')),
  recent: new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.yellow')),
  stale: new vscode.ThemeIcon('circle-outline'),
};

export class WorktreeTreeItem extends vscode.TreeItem {
  constructor(public readonly mapping: WorktreeMapping) {
    super(
      mapping.worktreeName,
      mapping.aggregatedState === 'active'
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed,
    );
    const stateLabel = mapping.aggregatedState === 'active'
      ? `[${mapping.activeCount} active]`
      : mapping.aggregatedState === 'stale' ? '[stale]' : `[${mapping.activeCount} active]`;
    this.description = `${mapping.branch}  ${stateLabel}`;
    this.iconPath = mapping.aggregatedState === 'active'
      ? new vscode.ThemeIcon('folder-active')
      : new vscode.ThemeIcon('folder');
    this.contextValue = `worktree.${mapping.aggregatedState}`;
    this.tooltip = new vscode.MarkdownString(
      `**${mapping.worktreePath}**\n\nbranch: \`${mapping.branch}\`\nsessions: ${mapping.sessions.length}`,
    );
  }
}

export class SessionTreeItem extends vscode.TreeItem {
  constructor(public readonly session: SessionMapping) {
    super(session.sessionId.slice(0, 8));
    const stateStr = session.state === 'active' ? 'editing' : 'idle';
    const age = session.ageSeconds < 60
      ? `${session.ageSeconds} sec ago`
      : `${Math.round(session.ageSeconds / 60)} min ago`;
    this.description = `${stateStr} • ${age}${session.fileBasename ? `    ${session.fileBasename}` : ''}`;
    this.iconPath = STATE_ICONS[session.state];
    this.contextValue = `session.${session.state}`;
    this.tooltip = new vscode.MarkdownString(
      `**Session:** \`${session.sessionId}\`\n\n` +
      (session.sessionEdits.length > 0
        ? `**Edits:**\n${session.sessionEdits.map(e => `- \`${e.file}\``).join('\n')}`
        : '') +
      (session.plannedEdits.length > 0
        ? `\n\n**Planned:**\n${session.plannedEdits.map(f => `- \`${f}\``).join('\n')}`
        : ''),
    );
    if (session.file) {
      this.command = {
        command: 'vscode.open',
        title: 'Open Last Edited File',
        arguments: [vscode.Uri.file(session.file)],
      };
    }
  }
}
