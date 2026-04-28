import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { synthesizeC4ElementsFromFilesystem } from '../synthesizeC4Elements';

describe('synthesizeC4ElementsFromFilesystem', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'syn-c4-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  function mkpkg(repo: string, pkg: string, components: string[]): void {
    fs.mkdirSync(path.join(repo, 'packages', pkg, 'src'), { recursive: true });
    for (const c of components) {
      fs.mkdirSync(path.join(repo, 'packages', pkg, 'src', c), { recursive: true });
    }
  }

  it('returns container + component elements for each package/src/<dir>', () => {
    mkpkg(tmpRoot, 'web-app', ['components', 'hooks']);
    mkpkg(tmpRoot, 'trail-core', ['c4', 'engine']);

    const elements = synthesizeC4ElementsFromFilesystem([{ path: tmpRoot }]);

    expect(elements).toEqual(
      expect.arrayContaining([
        { id: 'pkg_web-app', type: 'container', name: 'web-app' },
        {
          id: 'pkg_web-app/components',
          type: 'component',
          name: 'components',
          boundaryId: 'pkg_web-app',
        },
        {
          id: 'pkg_web-app/hooks',
          type: 'component',
          name: 'hooks',
          boundaryId: 'pkg_web-app',
        },
        { id: 'pkg_trail-core', type: 'container', name: 'trail-core' },
        {
          id: 'pkg_trail-core/c4',
          type: 'component',
          name: 'c4',
          boundaryId: 'pkg_trail-core',
        },
        {
          id: 'pkg_trail-core/engine',
          type: 'component',
          name: 'engine',
          boundaryId: 'pkg_trail-core',
        },
      ]),
    );
    expect(elements).toHaveLength(6);
  });

  it('emits container only when src/ has no subdirectories', () => {
    fs.mkdirSync(path.join(tmpRoot, 'packages', 'cms-core', 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'packages', 'cms-core', 'src', 'client.ts'), '');

    const elements = synthesizeC4ElementsFromFilesystem([{ path: tmpRoot }]);
    expect(elements).toEqual([
      { id: 'pkg_cms-core', type: 'container', name: 'cms-core' },
    ]);
  });

  it('returns [] when no packages directory exists', () => {
    const elements = synthesizeC4ElementsFromFilesystem([{ path: tmpRoot }]);
    expect(elements).toEqual([]);
  });

  it('deduplicates across multiple repositories', () => {
    mkpkg(tmpRoot, 'shared', ['utils']);
    const second = fs.mkdtempSync(path.join(os.tmpdir(), 'syn-c4-'));
    try {
      mkpkg(second, 'shared', ['utils']);
      const elements = synthesizeC4ElementsFromFilesystem([
        { path: tmpRoot },
        { path: second },
      ]);
      expect(elements).toHaveLength(2);
      expect(elements.map((e) => e.id)).toEqual(['pkg_shared', 'pkg_shared/utils']);
    } finally {
      fs.rmSync(second, { recursive: true, force: true });
    }
  });
});
