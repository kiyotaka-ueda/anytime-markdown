import { getMainAgentLabel } from '../AnalyticsPanel';

describe('getMainAgentLabel', () => {
  it('returns Codex for Codex sessions', () => {
    expect(getMainAgentLabel('codex')).toBe('Codex');
  });

  it('returns Claude Code for Claude Code and legacy sessions', () => {
    expect(getMainAgentLabel('claude_code')).toBe('Claude Code');
    expect(getMainAgentLabel(undefined)).toBe('Claude Code');
  });
});
