import {
  BLOCK_NODE_TYPES,
  setHandledByKeydown,
  getCopiedBlockNode,
  setCopiedBlockNode,
} from "../utils/blockClipboard";

describe("blockClipboard ユーティリティ", () => {
  describe("BLOCK_NODE_TYPES", () => {
    test("codeBlock を含む", () => {
      expect(BLOCK_NODE_TYPES.has("codeBlock")).toBe(true);
    });

    test("table を含む", () => {
      expect(BLOCK_NODE_TYPES.has("table")).toBe(true);
    });

    test("gifBlock を含む", () => {
      expect(BLOCK_NODE_TYPES.has("gifBlock")).toBe(true);
    });

    test("image を含む", () => {
      expect(BLOCK_NODE_TYPES.has("image")).toBe(true);
    });

    test("要素数が 4 である", () => {
      expect(BLOCK_NODE_TYPES.size).toBe(4);
    });
  });

  describe("setCopiedBlockNode / getCopiedBlockNode", () => {
    afterEach(() => {
      setCopiedBlockNode(null);
    });

    test("null を設定すると null を返す", () => {
      setCopiedBlockNode(null);
      expect(getCopiedBlockNode()).toBeNull();
    });

    test("モックノードを設定すると同じ参照を返す", () => {
      const mockNode = {} as any;
      setCopiedBlockNode(mockNode);
      expect(getCopiedBlockNode()).toBe(mockNode);
    });
  });

  describe("setHandledByKeydown", () => {
    test("true を渡しても例外が発生しない", () => {
      expect(() => setHandledByKeydown(true)).not.toThrow();
    });

    test("false を渡しても例外が発生しない", () => {
      expect(() => setHandledByKeydown(false)).not.toThrow();
    });
  });
});
