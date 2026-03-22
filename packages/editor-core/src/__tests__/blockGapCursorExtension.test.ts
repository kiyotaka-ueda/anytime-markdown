/**
 * blockGapCursorExtension.ts のテスト
 * BlockGapCursorExtension の構造と定数をテスト
 */
import { BlockGapCursorExtension } from "../extensions/blockGapCursorExtension";

describe("BlockGapCursorExtension", () => {
  it("has name 'blockGapCursor'", () => {
    expect(BlockGapCursorExtension.name).toBe("blockGapCursor");
  });

  it("defines addProseMirrorPlugins", () => {
    expect(BlockGapCursorExtension.config.addProseMirrorPlugins).toBeDefined();
  });
});
