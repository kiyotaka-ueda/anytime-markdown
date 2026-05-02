import { instrumentCode } from '../astTransform';

describe('instrumentCode snapshots', () => {
    it('transforms function declaration', () => {
        const src = `function add(a, b) { return a + b; }`;
        expect(instrumentCode(src, 'src/add.js')).toMatchSnapshot();
    });

    it('transforms nested functions', () => {
        const src = `function outer() { function inner() { return 1; } return inner(); }`;
        expect(instrumentCode(src, 'src/nested.js')).toMatchSnapshot();
    });

    it('transforms async function', () => {
        const src = `async function fetchData(url) { const res = await fetch(url); return res.json(); }`;
        expect(instrumentCode(src, 'src/fetch.js')).toMatchSnapshot();
    });
});
