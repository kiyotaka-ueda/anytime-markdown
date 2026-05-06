import { useEffect, useState } from 'react';

import type { TrailPromptEntry } from '../domain/parser/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PromptsDataResult {
  readonly prompts: readonly TrailPromptEntry[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePromptsData(serverUrl: string): PromptsDataResult {
  const [prompts, setPrompts] = useState<readonly TrailPromptEntry[]>([]);

  const baseUrl = serverUrl;

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${baseUrl}/api/trail/prompts`);
        if (res.ok) {
          const data: unknown = await res.json();
          if (data && typeof data === 'object' && 'prompts' in data) {
            setPrompts((data as { prompts: readonly TrailPromptEntry[] }).prompts);
          }
        }
      } catch {
        // prompts endpoint may not exist
      }
    })();
  }, [baseUrl]);

  return { prompts };
}
