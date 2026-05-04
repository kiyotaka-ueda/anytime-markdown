import { buildC4SequenceLayout } from '../engine/c4SequenceLayout';
import type { SequenceModel } from '@anytime-markdown/trace-core/c4Sequence';

function makeModel(root: SequenceModel['root']): SequenceModel {
    return {
        version: 1,
        rootElementId: 'root',
        participants: [
            { id: 'elem_A', elementId: 'A', label: 'A' },
            { id: 'elem_B', elementId: 'B', label: 'B' },
        ],
        root,
    };
}

describe('buildC4SequenceLayout', () => {
    it('produces one header node per participant', () => {
        const model = makeModel({ kind: 'sequence', steps: [] });
        const layout = buildC4SequenceLayout(model);
        const headers = layout.nodes.filter((n) => n.metadata?.['role'] === 'header');
        expect(headers).toHaveLength(2);
        expect(headers.map((h) => h.text).sort()).toEqual(['A', 'B']);
    });

    it('emits a call edge for each call step', () => {
        const model = makeModel({
            kind: 'sequence',
            steps: [
                {
                    kind: 'call',
                    from: 'elem_A',
                    to: 'elem_B',
                    fnName: 'foo',
                    callerFnName: 'caller',
                    chainId: 'c1',
                },
                {
                    kind: 'call',
                    from: 'elem_A',
                    to: 'elem_B',
                    fnName: 'bar',
                    callerFnName: 'caller',
                    chainId: 'c1',
                },
            ],
        });
        const layout = buildC4SequenceLayout(model);
        const calls = layout.edges.filter((e) => e.metadata?.['role'] === 'call');
        expect(calls).toHaveLength(2);
        expect(calls.map((c) => c.label).sort()).toEqual(['bar', 'foo']);
    });

    it('produces a fragment node for alt/loop/opt', () => {
        const model = makeModel({
            kind: 'sequence',
            steps: [
                {
                    kind: 'fragment',
                    fragment: {
                        kind: 'opt',
                        condition: 'isReady',
                        steps: [
                            {
                                kind: 'call',
                                from: 'elem_A',
                                to: 'elem_B',
                                fnName: 'foo',
                                callerFnName: 'caller',
                                chainId: 'c1',
                            },
                        ],
                    },
                },
            ],
        });
        const layout = buildC4SequenceLayout(model);
        const frags = layout.nodes.filter((n) => n.metadata?.['role'] === 'fragment');
        expect(frags).toHaveLength(1);
        expect(frags[0].metadata?.['fragmentKind']).toBe('opt');
        expect(frags[0].metadata?.['condition']).toBe('isReady');
    });

    it('emits divider node between alt branches', () => {
        const model = makeModel({
            kind: 'sequence',
            steps: [
                {
                    kind: 'fragment',
                    fragment: {
                        kind: 'alt',
                        branches: [
                            {
                                condition: 'a',
                                steps: [
                                    {
                                        kind: 'call',
                                        from: 'elem_A',
                                        to: 'elem_B',
                                        fnName: 'foo',
                                        callerFnName: 'caller',
                                        chainId: 'c1',
                                    },
                                ],
                            },
                            {
                                condition: 'else',
                                steps: [
                                    {
                                        kind: 'call',
                                        from: 'elem_A',
                                        to: 'elem_B',
                                        fnName: 'bar',
                                        callerFnName: 'caller',
                                        chainId: 'c1',
                                    },
                                ],
                            },
                        ],
                    },
                },
            ],
        });
        const layout = buildC4SequenceLayout(model);
        const dividers = layout.nodes.filter((n) => n.metadata?.['role'] === 'fragment-divider');
        expect(dividers).toHaveLength(1);
        expect(dividers[0].metadata?.['condition']).toBe('else');
    });

    it('handles nested fragments', () => {
        const model = makeModel({
            kind: 'sequence',
            steps: [
                {
                    kind: 'fragment',
                    fragment: {
                        kind: 'opt',
                        condition: 'outer',
                        steps: [
                            {
                                kind: 'fragment',
                                fragment: {
                                    kind: 'loop',
                                    condition: 'inner',
                                    steps: [
                                        {
                                            kind: 'call',
                                            from: 'elem_A',
                                            to: 'elem_B',
                                            fnName: 'foo',
                                            callerFnName: 'caller',
                                            chainId: 'c1',
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
            ],
        });
        const layout = buildC4SequenceLayout(model);
        const frags = layout.nodes.filter((n) => n.metadata?.['role'] === 'fragment');
        expect(frags).toHaveLength(2);
        const kinds = frags.map((f) => f.metadata?.['fragmentKind']).sort();
        expect(kinds).toEqual(['loop', 'opt']);
    });

    it('produces lifeline edges with dashed style', () => {
        const model = makeModel({ kind: 'sequence', steps: [] });
        const layout = buildC4SequenceLayout(model);
        const lifelines = layout.edges.filter((e) => e.metadata?.['role'] === 'lifeline');
        expect(lifelines).toHaveLength(2);
        expect(lifelines.every((e) => e.style.dashed)).toBe(true);
    });
});
