import type { C4Model } from '@anytime-markdown/trail-core/c4';

import { computeContextMenuCapabilities } from '../contextMenuCapabilities';

const baseModel: C4Model = {
  level: 'component',
  elements: [
    { id: 'sys_app', name: 'App', type: 'system', external: false },
    { id: 'pkg_core', name: 'core', type: 'container', external: false, boundaryId: 'sys_app' },
    { id: 'fn_foo', name: 'foo', type: 'component', external: false, boundaryId: 'pkg_core' },
    { id: 'file::src/foo.ts', name: 'foo.ts', type: 'component', external: false, boundaryId: 'pkg_core' },
  ],
  relationships: [],
};

const noManualActions = (): boolean => false;

describe('computeContextMenuCapabilities', () => {
  it('component を右クリック → canShowSequence: true（バグ再現テスト）', () => {
    const r = computeContextMenuCapabilities({
      c4Model: baseModel,
      c4Id: 'fn_foo',
      drillStack: [],
      hasShowSequenceHandler: true,
      canShowManualContextActions: noManualActions,
    });
    expect(r.canShowSequence).toBe(true);
    expect(r.showContextMenu).toBe(true);
  });

  it('container（boundary）→ canShowSequence: false', () => {
    const r = computeContextMenuCapabilities({
      c4Model: baseModel,
      c4Id: 'pkg_core',
      drillStack: [],
      hasShowSequenceHandler: true,
      canShowManualContextActions: noManualActions,
    });
    expect(r.canShowSequence).toBe(false);
  });

  it('hasShowSequenceHandler=false → canShowSequence: false', () => {
    const r = computeContextMenuCapabilities({
      c4Model: baseModel,
      c4Id: 'fn_foo',
      drillStack: [],
      hasShowSequenceHandler: false,
      canShowManualContextActions: noManualActions,
    });
    expect(r.canShowSequence).toBe(false);
  });

  it('system 要素 → canShowOnlyFrame: true / canDrillUp は drillStack 依存', () => {
    const empty = computeContextMenuCapabilities({
      c4Model: baseModel,
      c4Id: 'sys_app',
      drillStack: [],
      hasShowSequenceHandler: false,
      canShowManualContextActions: noManualActions,
    });
    expect(empty.canShowOnlyFrame).toBe(true);
    expect(empty.canDrillUp).toBe(false);

    const drilled = computeContextMenuCapabilities({
      c4Model: baseModel,
      c4Id: 'sys_app',
      drillStack: [{ element: baseModel.elements[0] }],
      hasShowSequenceHandler: false,
      canShowManualContextActions: noManualActions,
    });
    expect(drilled.canDrillUp).toBe(true);
  });

  it('container（boundary）は子要素を持つが canDrillDown: false（boundary 自体はドリル起点にしない）', () => {
    const r = computeContextMenuCapabilities({
      c4Model: baseModel,
      c4Id: 'pkg_core',
      drillStack: [],
      hasShowSequenceHandler: false,
      canShowManualContextActions: noManualActions,
    });
    expect(r.canDrillDown).toBe(false);
  });

  it('file:: で始まる c4Id → canOpenFile / canCopyPath が true', () => {
    const r = computeContextMenuCapabilities({
      c4Model: baseModel,
      c4Id: 'file::src/foo.ts',
      drillStack: [],
      hasShowSequenceHandler: true,
      canShowManualContextActions: noManualActions,
    });
    expect(r.canOpenFile).toBe(true);
    expect(r.canCopyPath).toBe(true);
    expect(r.canShowSequence).toBe(true);
  });

  it('c4Id が null → showContextMenu: false', () => {
    const r = computeContextMenuCapabilities({
      c4Model: baseModel,
      c4Id: null,
      drillStack: [],
      hasShowSequenceHandler: true,
      canShowManualContextActions: () => true,
    });
    expect(r.showContextMenu).toBe(false);
  });

  it('canShowManualContextActions が true → showContextMenu: true', () => {
    const r = computeContextMenuCapabilities({
      c4Model: baseModel,
      c4Id: 'unknown_id',
      drillStack: [],
      hasShowSequenceHandler: false,
      canShowManualContextActions: () => true,
    });
    expect(r.canShowManualActions).toBe(true);
    expect(r.showContextMenu).toBe(true);
  });
});
