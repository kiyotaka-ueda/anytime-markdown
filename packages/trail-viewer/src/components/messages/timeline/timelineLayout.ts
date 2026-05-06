export function findMessageEl(uuids: readonly string[]): HTMLElement | null {
  for (const uuid of uuids) {
    const el = document.querySelector(`[data-message-uuid="${uuid}"]`) as HTMLElement | null;
    if (el) return el;
  }
  return null;
}

export function applyScrollHighlight(el: HTMLElement, highlightColor: string): void {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const prevOutline = el.style.outline;
  const prevOutlineOffset = el.style.outlineOffset;
  const prevTransition = el.style.transition;
  el.style.transition = 'outline-color 0.2s ease';
  el.style.outline = `2px solid ${highlightColor}`;
  el.style.outlineOffset = '4px';
  window.setTimeout(() => {
    el.style.outline = prevOutline;
    el.style.outlineOffset = prevOutlineOffset;
    el.style.transition = prevTransition;
  }, 1500);
}

export function scrollToMessage(uuids: readonly string[], highlightColor: string): void {
  const el = findMessageEl(uuids);
  if (el) applyScrollHighlight(el, highlightColor);
}

export function formatTimeLabel(ms: number, includeDate: boolean): string {
  if (!Number.isFinite(ms) || ms <= 0) return '-';
  const d = new Date(ms);
  const opts: Intl.DateTimeFormatOptions = includeDate
    ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
    : { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

export function extractAgentCallMeta(toolCalls: readonly { name: string; input: Record<string, unknown> }[] | undefined): {
  delegated: boolean;
  description?: string;
  subagentType?: string;
} {
  if (!toolCalls || toolCalls.length === 0) return { delegated: false };
  const agentCall = toolCalls.find((tc) => tc.name === 'Agent');
  if (!agentCall) return { delegated: false };
  const description = typeof agentCall.input?.description === 'string'
    ? agentCall.input.description
    : undefined;
  const subagentType = typeof agentCall.input?.subagent_type === 'string'
    ? agentCall.input.subagent_type
    : undefined;
  return { delegated: true, description, subagentType };
}
