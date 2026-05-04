import type { C4Element, C4ElementType, C4Model } from '@anytime-markdown/trail-core/c4';

const BOUNDARY_TYPES: ReadonlySet<C4ElementType> = new Set(['system', 'container', 'containerDb']);

export interface DrillFrame {
  readonly element: C4Element;
}

export interface ContextMenuCapabilities {
  readonly canDrillDown: boolean;
  readonly canDrillUp: boolean;
  readonly canShowOnlyFrame: boolean;
  readonly canShowSequence: boolean;
  readonly canCopyPath: boolean;
  readonly canOpenFile: boolean;
  readonly canShowManualActions: boolean;
  readonly showContextMenu: boolean;
}

export interface ComputeContextMenuCapabilitiesArgs {
  readonly c4Model: C4Model | null;
  readonly c4Id: string | null;
  readonly drillStack: ReadonlyArray<DrillFrame>;
  readonly hasShowSequenceHandler: boolean;
  readonly canShowManualContextActions: (model: C4Model | null, c4Id: string | null) => boolean;
}

const EMPTY_CAPABILITIES: ContextMenuCapabilities = {
  canDrillDown: false,
  canDrillUp: false,
  canShowOnlyFrame: false,
  canShowSequence: false,
  canCopyPath: false,
  canOpenFile: false,
  canShowManualActions: false,
  showContextMenu: false,
};

export function computeContextMenuCapabilities(
  args: ComputeContextMenuCapabilitiesArgs,
): ContextMenuCapabilities {
  const { c4Model, c4Id, drillStack, hasShowSequenceHandler, canShowManualContextActions } = args;

  if (c4Id === null) return EMPTY_CAPABILITIES;

  const target = c4Model?.elements.find((e) => e.id === c4Id) ?? null;
  const isBoundary = target !== null && BOUNDARY_TYPES.has(target.type);

  const canDrillDown = target !== null
    && !isBoundary
    && drillStack.at(-1)?.element.id !== c4Id
    && (c4Model?.elements.some((e) => e.boundaryId === c4Id) ?? false);

  const canDrillUp = isBoundary && drillStack.length > 0;
  const canShowOnlyFrame = isBoundary;
  const canShowSequence = target?.type === 'component' && hasShowSequenceHandler;
  const canCopyPath = c4Id.startsWith('pkg_') || c4Id.startsWith('file::');
  const canOpenFile = c4Id.startsWith('file::');
  const canShowManualActionsResult = canShowManualContextActions(c4Model, c4Id);

  const showContextMenu = (
    canDrillDown
    || canDrillUp
    || canShowOnlyFrame
    || canOpenFile
    || canCopyPath
    || canShowSequence
    || canShowManualActionsResult
  );

  return {
    canDrillDown,
    canDrillUp,
    canShowOnlyFrame,
    canShowSequence,
    canCopyPath,
    canOpenFile,
    canShowManualActions: canShowManualActionsResult,
    showContextMenu,
  };
}
