import { lazyWithPreload } from '../shared/lazyWithPreload';

describe('lazyWithPreload', () => {
    it('preload プロパティが関数として付与されている', () => {
        const Comp = lazyWithPreload(async () => ({ default: () => null }));
        expect(typeof Comp.preload).toBe('function');
    });

    it('preload を呼ぶと loader が実行される', async () => {
        const loader = jest.fn(async () => ({ default: () => null }));
        const Comp = lazyWithPreload(loader);

        const result = await Comp.preload();
        expect(loader).toHaveBeenCalledTimes(1);
        expect(result).toHaveProperty('default');
    });

    it('preload を複数回呼んでも loader は 1 回しか実行されない (loader 側のキャッシュ前提)', async () => {
        let count = 0;
        let cached: { default: () => null } | null = null;
        const loader = async () => {
            if (cached) return cached;
            count += 1;
            cached = { default: () => null };
            return cached;
        };
        const Comp = lazyWithPreload(loader);

        await Comp.preload();
        await Comp.preload();
        await Comp.preload();
        expect(count).toBe(1);
    });
});
