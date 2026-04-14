import type { C4Element, C4Model } from '../types';
import { filterModelForDrill } from '../view/filterModelForDrill';

// テスト用ヘルパー
function makeElement(
  id: string,
  type: C4Element['type'] = 'system',
  children?: C4Element[],
): C4Element {
  return { id, type, name: id, ...(children ? { children } : {}) };
}

function makeModel(
  elements: C4Element[],
  relationships: C4Model['relationships'] = [],
): C4Model {
  return { elements, relationships };
}

describe('filterModelForDrill', () => {
  it('子要素を持つ要素でフィルタすると、その children が elements になる', () => {
    const child1 = makeElement('c1', 'container');
    const child2 = makeElement('c2', 'container');
    const root = makeElement('sys', 'system', [child1, child2]);
    const model = makeModel([root]);

    const result = filterModelForDrill(model, root);

    expect(result.elements).toEqual([child1, child2]);
  });

  it('root 自身は elements に含まれない', () => {
    const child = makeElement('c1', 'container');
    const root = makeElement('sys', 'system', [child]);
    const model = makeModel([root]);

    const result = filterModelForDrill(model, root);

    expect(result.elements.find(e => e.id === 'sys')).toBeUndefined();
  });

  it('子要素間のリレーションシップのみ残す', () => {
    const child1 = makeElement('c1', 'container');
    const child2 = makeElement('c2', 'container');
    const other = makeElement('other', 'system');
    const root = makeElement('sys', 'system', [child1, child2]);
    const model = makeModel(
      [root, other],
      [
        { from: 'c1', to: 'c2', label: 'calls' },   // 残す
        { from: 'c1', to: 'other', label: 'uses' },  // 除外（other は可視外）
      ],
    );

    const result = filterModelForDrill(model, root);

    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0]).toMatchObject({ from: 'c1', to: 'c2' });
  });

  it('children が空の要素でフィルタすると elements が空配列になる', () => {
    const root = makeElement('sys', 'system', []);
    const model = makeModel([root]);

    const result = filterModelForDrill(model, root);

    expect(result.elements).toEqual([]);
  });

  it('孫要素も含む全子孫のリレーションシップを残す', () => {
    const grandchild = makeElement('gc1', 'component');
    const child = makeElement('c1', 'container', [grandchild]);
    const root = makeElement('sys', 'system', [child]);
    const other = makeElement('other', 'system');
    const model = makeModel(
      [root, other],
      [
        { from: 'c1', to: 'gc1', label: 'contains' }, // 残す
        { from: 'gc1', to: 'other', label: 'calls' },  // 除外
      ],
    );

    const result = filterModelForDrill(model, root);

    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0]).toMatchObject({ from: 'c1', to: 'gc1' });
  });
});
