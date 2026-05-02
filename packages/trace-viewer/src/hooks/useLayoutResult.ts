import { useMemo } from 'react';
import { buildCallTree } from '@anytime-markdown/trace-core/parse';
import type { TraceFile } from '@anytime-markdown/trace-core/types';
import { buildSequenceLayout, type LayoutOptions, type SequenceLayout } from '../engine/layout';

export function useLayoutResult(
    file: TraceFile | null,
    opts?: LayoutOptions,
): SequenceLayout | null {
    return useMemo(() => {
        if (!file) return null;
        const tree = buildCallTree(file);
        return buildSequenceLayout(file, tree, opts);
    // opts オブジェクトの参照変化で不要な再計算が起きないよう個別フィールドで依存させる
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file, opts?.maxDepth, opts?.hiddenLifelines, opts?.isDark]);
}
