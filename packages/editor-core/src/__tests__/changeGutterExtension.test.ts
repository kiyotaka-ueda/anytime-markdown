/**
 * changeGutterExtension.ts のテスト
 * getChangedPositions, ChangeGutterExtension の構造をテスト
 */
import { ChangeGutterExtension, getChangedPositions } from "../extensions/changeGutterExtension";

describe("ChangeGutterExtension", () => {
  it("has name 'changeGutter'", () => {
    expect(ChangeGutterExtension.name).toBe("changeGutter");
  });

  it("defines addCommands", () => {
    expect(ChangeGutterExtension.config.addCommands).toBeDefined();
  });

  it("defines addProseMirrorPlugins", () => {
    expect(ChangeGutterExtension.config.addProseMirrorPlugins).toBeDefined();
  });
});

describe("getChangedPositions", () => {
  it("returns empty array when plugin state is undefined", () => {
    // Mock editorState with no plugin state
    const mockState = {
      plugins: [],
    } as unknown as import("@tiptap/pm/state").EditorState;

    const positions = getChangedPositions(mockState);
    expect(positions).toEqual([]);
  });
});
