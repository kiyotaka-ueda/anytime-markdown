import { agentPalette } from '../../../theme/designTokens';

export function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getAgentColor(agentId: string): string {
  return agentPalette[hashString(agentId) % agentPalette.length];
}

export function getDelegatedAgentLabel(agentId: string): string {
  if (agentId.startsWith('codex:') || agentId.startsWith('delegated:')) {
    return 'Codex';
  }
  return 'Claude Code';
}

export function getTurnColor(
  toolNames: readonly string[],
  toolColors: { bash: string; edit: string; write: string; read: string; task: string; other: string; plain: string },
): string {
  if (toolNames.includes('Task')) return toolColors.task;
  if (toolNames.includes('Bash')) return toolColors.bash;
  if (toolNames.includes('Edit') || toolNames.includes('MultiEdit')) return toolColors.edit;
  if (toolNames.includes('Write')) return toolColors.write;
  if (toolNames.includes('Read')) return toolColors.read;
  if (toolNames.length > 0) return toolColors.other;
  return toolColors.plain;
}
