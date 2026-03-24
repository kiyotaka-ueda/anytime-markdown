import { useReducer } from 'react';
import type { GraphDocument } from '@anytime-markdown/graph-core';
import { graphReducer, createInitialState } from '@anytime-markdown/graph-core/state';
import type { GraphState, Action } from '@anytime-markdown/graph-core/state';

export type { GraphState, Action };

export function useGraphState(initialDoc?: GraphDocument) {
  const [state, dispatch] = useReducer(graphReducer, undefined, () => createInitialState(initialDoc));
  return { state, dispatch };
}
