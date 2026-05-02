import { Recorder } from '../recorder';

describe('Recorder', () => {
    let rec: Recorder;

    beforeEach(() => {
        rec = new Recorder({ depthLimit: 3 });
    });

    it('enter increments depth and returns an id', () => {
        const id = rec.enter('L0', null, 'foo', [1, 2], 0);
        expect(id).toBeGreaterThan(0);
        expect(rec.entries()).toHaveLength(1);
    });

    it('exit records return event', () => {
        const id = rec.enter('L0', null, 'foo', [], 0);
        rec.exit(id, 42);
        expect(rec.entries()[1]).toMatchObject({ type: 'return', ofId: id });
    });

    it('throw records throw event', () => {
        const id = rec.enter('L0', null, 'foo', [], 0);
        rec.throw(id, new Error('oops'));
        expect(rec.entries()[1]).toMatchObject({ type: 'throw', ofId: id });
    });

    it('skips enter when depth exceeds depthLimit', () => {
        const id = rec.enter('L0', null, 'f', [], 4);
        expect(id).toBe(-1);
        expect(rec.entries()).toHaveLength(0);
    });

    it('reset clears all entries', () => {
        rec.enter('L0', null, 'foo', [], 0);
        rec.reset();
        expect(rec.entries()).toHaveLength(0);
    });
});
