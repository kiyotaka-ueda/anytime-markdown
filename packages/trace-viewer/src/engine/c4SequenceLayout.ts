/**
 * C4 Sequence Layout
 *
 * SequenceModel（trace-core/c4Sequence）を graph-core の nodes/edges に変換する。
 * フラグメント矩形（alt/loop/opt）と関数別 activation を含む。
 */

import type { GraphNode, NodeStyle, EdgeStyle } from '@anytime-markdown/graph-core';
import type {
    SequenceFragment,
    SequenceModel,
    SequenceStep,
} from '@anytime-markdown/trace-core/c4Sequence';
import type { SequenceEdge, SequenceLayout } from './layout';

export interface C4LayoutOptions {
    isDark?: boolean;
}

const MARGIN_LEFT = 40;
const MARGIN_TOP = 10;
const MARGIN_BOTTOM = 60;
const HEADER_WIDTH = 160;
const HEADER_HEIGHT = 40;
const LIFELINE_SPACING = 200;
const STEP_HEIGHT = 36;
const ACTIVATION_WIDTH = 10;
const FRAGMENT_HEADER_HEIGHT = 26;
const FRAGMENT_PAD_X = 16;
const FRAGMENT_PAD_TOP = 4;
const FRAGMENT_PAD_BOTTOM = 4;
const FRAGMENT_DIVIDER_HEIGHT = 14;
const GAP_AFTER_HEADER = STEP_HEIGHT;

interface Style {
    readonly node: NodeStyle;
    readonly lifelineEdge: EdgeStyle;
    readonly callEdge: EdgeStyle;
    readonly fragment: NodeStyle;
}

function makeStyle(dark: boolean): Style {
    const headerFill = dark ? '#2d3748' : '#e2e8f0';
    const headerStroke = dark ? '#63b3ed' : '#3182ce';
    const lifelineStroke = dark ? '#4a5568' : '#a0aec0';
    const callStroke = dark ? '#63b3ed' : '#2b6cb0';
    const fontColor = dark ? '#e2e8f0' : '#1a202c';
    const fragmentStroke = dark ? '#a0aec0' : '#4a5568';
    const fragmentFill = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

    return {
        node: {
            fill: headerFill,
            stroke: headerStroke,
            strokeWidth: 1,
            fontSize: 12,
            fontFamily: 'monospace',
            fontColor,
        },
        lifelineEdge: {
            stroke: lifelineStroke,
            strokeWidth: 1,
            dashed: true,
        },
        callEdge: {
            stroke: callStroke,
            strokeWidth: 1,
            endShape: 'arrow',
        },
        fragment: {
            fill: fragmentFill,
            stroke: fragmentStroke,
            strokeWidth: 1,
            fontSize: 11,
            fontFamily: 'sans-serif',
            fontColor,
            borderRadius: 4,
        },
    };
}

function makeUid() {
    let counter = 0;
    return (prefix: string): string => `${prefix}-${++counter}`;
}

interface BuildState {
    readonly nodes: GraphNode[];
    readonly edges: SequenceEdge[];
    readonly lifelineXMap: ReadonlyMap<string, number>;
    readonly styles: Style;
    readonly uid: (prefix: string) => string;
    readonly activations: ActivationRecord[];
    tick: number;
}

interface ActivationRecord {
    readonly id: string;
    readonly lifelineId: string;
    readonly x: number;
    readonly fnName: string;
    readonly startTick: number;
    endTick: number;
}

interface FragmentBounds {
    readonly minX: number;
    readonly maxX: number;
    readonly startTick: number;
    readonly endTick: number;
}

/**
 * SequenceModel を SequenceLayout に変換する。
 */
export function buildC4SequenceLayout(
    model: SequenceModel,
    opts: C4LayoutOptions = {},
): SequenceLayout {
    const isDark = opts.isDark ?? true;
    const styles = makeStyle(isDark);
    const uid = makeUid();

    const lifelineXMap = new Map<string, number>();
    model.participants.forEach((p, idx) => {
        lifelineXMap.set(p.id, MARGIN_LEFT + idx * LIFELINE_SPACING + HEADER_WIDTH / 2);
    });

    const nodes: GraphNode[] = [];
    const edges: SequenceEdge[] = [];
    const activations: ActivationRecord[] = [];

    // Lifeline headers
    for (const p of model.participants) {
        const x = lifelineXMap.get(p.id);
        if (x === undefined) continue;
        nodes.push({
            id: uid('header'),
            type: 'rect',
            x: x - HEADER_WIDTH / 2,
            y: MARGIN_TOP,
            width: HEADER_WIDTH,
            height: HEADER_HEIGHT,
            text: p.label,
            style: { ...styles.node },
            metadata: { role: 'header', participantId: p.id, elementId: p.elementId },
        });
    }

    const state: BuildState = { nodes, edges, lifelineXMap, styles, uid, activations, tick: 0 };

    // Walk root fragment（root は通常 sequence なので外枠を描かない）
    walkFragment(model.root, /*depth*/ 0, /*isRoot*/ true, state);

    const totalHeight = MARGIN_TOP + HEADER_HEIGHT + GAP_AFTER_HEADER + (state.tick + 1) * STEP_HEIGHT + MARGIN_BOTTOM;

    // Lifeline vertical lines
    for (const p of model.participants) {
        const x = lifelineXMap.get(p.id);
        if (x === undefined) continue;
        edges.push({
            id: uid('lifeline'),
            type: 'line',
            from: { x, y: MARGIN_TOP + HEADER_HEIGHT },
            to: { x, y: totalHeight - MARGIN_BOTTOM / 2 },
            style: { ...styles.lifelineEdge },
            metadata: { role: 'lifeline', participantId: p.id },
        });
    }

    // Activation bars
    for (const act of activations) {
        const y1 = MARGIN_TOP + HEADER_HEIGHT + GAP_AFTER_HEADER + act.startTick * STEP_HEIGHT;
        const y2 = MARGIN_TOP + HEADER_HEIGHT + GAP_AFTER_HEADER + (act.endTick + 1) * STEP_HEIGHT;
        nodes.push({
            id: act.id,
            type: 'rect',
            x: act.x - ACTIVATION_WIDTH / 2,
            y: y1,
            width: ACTIVATION_WIDTH,
            height: Math.max(y2 - y1, 12),
            text: '',
            style: {
                fill: isDark ? '#3182ce' : '#bee3f8',
                stroke: isDark ? '#63b3ed' : '#2b6cb0',
                strokeWidth: 1,
                fontSize: 10,
                fontFamily: 'sans-serif',
            },
            metadata: { role: 'activation', lifelineId: act.lifelineId, fnName: act.fnName },
        });
    }

    const width = MARGIN_LEFT * 2 + Math.max(model.participants.length, 1) * LIFELINE_SPACING;
    return { nodes, edges, width, height: totalHeight, lifelineXMap };
}

// ---------------------------------------------------------------------------

function walkFragment(
    fragment: SequenceFragment,
    depth: number,
    isRoot: boolean,
    state: BuildState,
): FragmentBounds {
    const drawBox = !isRoot && fragment.kind !== 'sequence';

    let startTick = state.tick;
    if (drawBox) {
        // フラグメントヘッダーぶんの空間を確保
        startTick = state.tick;
        state.tick += 1;
    }

    let bounds: FragmentBounds;

    if (fragment.kind === 'sequence' || fragment.kind === 'loop' || fragment.kind === 'opt') {
        bounds = walkSteps(fragment.steps, depth + (drawBox ? 1 : 0), startTick, state);
    } else {
        // alt: 各 branch を縦に並べ、間に divider を挿入
        const branchBounds: FragmentBounds[] = [];
        fragment.branches.forEach((branch, i) => {
            if (i > 0) {
                emitDivider(branch.condition, depth + 1, state);
            }
            const b = walkSteps(branch.steps, depth + 1, state.tick, state);
            branchBounds.push(b);
        });
        bounds = mergeBounds(branchBounds, startTick, state.tick);
    }

    if (drawBox) {
        const condition = fragment.kind === 'alt'
            ? (fragment.branches[0]?.condition ?? '')
            : fragment.condition;
        emitFragmentRect(fragment.kind, condition, bounds, startTick, state.tick, depth, state);
    }

    return drawBox
        ? { minX: bounds.minX, maxX: bounds.maxX, startTick, endTick: state.tick }
        : bounds;
}

function walkSteps(
    steps: readonly SequenceStep[],
    depth: number,
    startTick: number,
    state: BuildState,
): FragmentBounds {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let lastActivation: ActivationRecord | null = null;
    let lastFromLifeline = '';

    for (const step of steps) {
        if (step.kind === 'call') {
            const fromX = state.lifelineXMap.get(step.from);
            const toX = state.lifelineXMap.get(step.to);
            if (fromX === undefined || toX === undefined) continue;
            if (fromX < minX) minX = fromX;
            if (toX < minX) minX = toX;
            if (fromX > maxX) maxX = fromX;
            if (toX > maxX) maxX = toX;

            const y = MARGIN_TOP + HEADER_HEIGHT + GAP_AFTER_HEADER + state.tick * STEP_HEIGHT;
            state.edges.push({
                id: state.uid('call'),
                type: 'line',
                from: { x: fromX, y },
                to: { x: toX, y },
                style: { ...state.styles.callEdge },
                label: step.fnName,
                metadata: {
                    role: 'call',
                    fromParticipant: step.from,
                    toParticipant: step.to,
                    callerFn: step.callerFnName,
                    chainId: step.chainId,
                },
            });

            // Activation: 同じ to lifeline + 同じ fnName が連続したら伸ばす（hybrid）
            if (
                lastActivation
                && lastActivation.lifelineId === step.to
                && lastActivation.fnName === step.fnName
                && lastFromLifeline === step.from
            ) {
                lastActivation.endTick = state.tick;
            } else {
                const newAct: ActivationRecord = {
                    id: state.uid('act'),
                    lifelineId: step.to,
                    x: toX,
                    fnName: step.fnName,
                    startTick: state.tick,
                    endTick: state.tick,
                };
                state.activations.push(newAct);
                lastActivation = newAct;
                lastFromLifeline = step.from;
            }

            state.tick += 1;
        } else {
            // fragment
            const sub = walkFragment(step.fragment, depth, false, state);
            if (sub.minX < minX) minX = sub.minX;
            if (sub.maxX > maxX) maxX = sub.maxX;
            // フラグメントを跨ぐ activation は連結しない
            lastActivation = null;
            lastFromLifeline = '';
        }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
        // ステップなし — bounds をゼロ幅にする
        const fallback = state.tick;
        return { minX: 0, maxX: 0, startTick, endTick: fallback };
    }
    return { minX, maxX, startTick, endTick: state.tick };
}

function emitDivider(condition: string, depth: number, state: BuildState): void {
    const y = MARGIN_TOP + HEADER_HEIGHT + GAP_AFTER_HEADER + state.tick * STEP_HEIGHT;
    // depth による x 範囲はあとで fragment box が計算するので、ここでは仮に 0..0 にし
    // 後で box が確定したら呼び出し側で divider のサイズを調整する選択肢もあるが、
    // 簡易実装として max participants 範囲を一旦使う。
    const xs = [...state.lifelineXMap.values()];
    const minX = xs.length > 0 ? Math.min(...xs) : 0;
    const maxX = xs.length > 0 ? Math.max(...xs) : 0;
    state.nodes.push({
        id: state.uid('divider'),
        type: 'fragment',
        x: minX - FRAGMENT_PAD_X,
        y: y - FRAGMENT_DIVIDER_HEIGHT / 2,
        width: maxX - minX + FRAGMENT_PAD_X * 2,
        height: FRAGMENT_DIVIDER_HEIGHT,
        text: '',
        style: { ...state.styles.fragment, dashed: true },
        metadata: { role: 'fragment-divider', condition, depth },
    });
    state.tick += 0.4; // divider はフルステップを取らない
}

function emitFragmentRect(
    kind: 'alt' | 'loop' | 'opt',
    condition: string,
    bounds: FragmentBounds,
    startTick: number,
    endTick: number,
    depth: number,
    state: BuildState,
): void {
    const padX = FRAGMENT_PAD_X + depth * 4;
    const minX = bounds.minX === 0 && bounds.maxX === 0
        ? (state.lifelineXMap.values().next().value ?? 0) - HEADER_WIDTH / 2
        : bounds.minX - padX;
    const maxX = bounds.maxX === 0 && bounds.minX === 0
        ? minX + HEADER_WIDTH
        : bounds.maxX + padX;
    const y1 = MARGIN_TOP + HEADER_HEIGHT + GAP_AFTER_HEADER + startTick * STEP_HEIGHT - FRAGMENT_PAD_TOP;
    const y2 = MARGIN_TOP + HEADER_HEIGHT + GAP_AFTER_HEADER + Math.max(endTick, startTick + 1) * STEP_HEIGHT + FRAGMENT_PAD_BOTTOM;

    state.nodes.push({
        id: state.uid('fragment'),
        type: 'fragment',
        x: minX,
        y: y1,
        width: Math.max(maxX - minX, FRAGMENT_HEADER_HEIGHT * 4),
        height: Math.max(y2 - y1, FRAGMENT_HEADER_HEIGHT + STEP_HEIGHT),
        text: '',
        style: { ...state.styles.fragment },
        metadata: { role: 'fragment', fragmentKind: kind, condition, depth },
    });
}

function mergeBounds(parts: readonly FragmentBounds[], startTick: number, endTick: number): FragmentBounds {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    for (const b of parts) {
        if (b.minX < minX) minX = b.minX;
        if (b.maxX > maxX) maxX = b.maxX;
    }
    return {
        minX: Number.isFinite(minX) ? minX : 0,
        maxX: Number.isFinite(maxX) ? maxX : 0,
        startTick,
        endTick,
    };
}
