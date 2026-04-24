import { parseEmbedInfoString } from "../../utils/embedInfoString";

describe("parseEmbedInfoString", () => {
    test("default variant", () => {
        expect(parseEmbedInfoString("embed")).toEqual({ variant: "card" });
    });
    test("card", () => {
        expect(parseEmbedInfoString("embed card")).toEqual({ variant: "card" });
    });
    test("compact", () => {
        expect(parseEmbedInfoString("embed compact")).toEqual({ variant: "compact" });
    });
    test("空白複数", () => {
        expect(parseEmbedInfoString("embed   compact")).toEqual({ variant: "compact" });
    });
    test("非 embed", () => {
        expect(parseEmbedInfoString("typescript")).toBeNull();
    });
    test("不正 variant はデフォルト", () => {
        expect(parseEmbedInfoString("embed wide")).toEqual({ variant: "card" });
    });
});
