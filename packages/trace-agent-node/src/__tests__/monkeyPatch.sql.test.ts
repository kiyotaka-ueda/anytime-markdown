import { patchSql } from '../monkeyPatch/sql';

describe('patchSql', () => {
    it('does not throw when optional DB packages are not installed', () => {
        expect(() => patchSql()).not.toThrow();
    });
});
