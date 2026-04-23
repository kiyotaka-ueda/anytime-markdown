import type { EditorView } from "@tiptap/pm/view";

import { computeDropTarget } from "../plugins/imageRowDropPlugin";

function makeMockView(
  imageBlock: { left: number; width: number; top: number; height: number } | null,
  coords: { pos: number } | null,
): EditorView {
  const el = imageBlock
    ? (() => {
        const div = document.createElement("div");
        div.setAttribute("data-image-block", "");
        Object.defineProperty(div, "getBoundingClientRect", {
          value: () => ({
            left: imageBlock.left,
            width: imageBlock.width,
            right: imageBlock.left + imageBlock.width,
            top: imageBlock.top,
            height: imageBlock.height,
            bottom: imageBlock.top + imageBlock.height,
            x: imageBlock.left,
            y: imageBlock.top,
            toJSON: () => ({}),
          }),
        });
        return div;
      })()
    : null;
  return {
    posAtCoords: () => coords,
    domAtPos: () => ({ node: el as unknown as Node, offset: 0 }),
  } as unknown as EditorView;
}

describe("computeDropTarget", () => {
  test("drop on left 15% of image block returns wrap-left", () => {
    const view = makeMockView({ left: 100, width: 200, top: 0, height: 100 }, { pos: 10 });
    const decision = computeDropTarget({ view, clientX: 130, clientY: 50 }); // 15% in
    expect(decision.action).toBe("wrap-left");
  });

  test("drop on right 85% of image block returns wrap-right", () => {
    const view = makeMockView({ left: 100, width: 200, top: 0, height: 100 }, { pos: 10 });
    const decision = computeDropTarget({ view, clientX: 270, clientY: 50 }); // 85% in
    expect(decision.action).toBe("wrap-right");
  });

  test("drop on center 50% returns default", () => {
    const view = makeMockView({ left: 100, width: 200, top: 0, height: 100 }, { pos: 10 });
    const decision = computeDropTarget({ view, clientX: 200, clientY: 50 }); // 50% in
    expect(decision.action).toBe("default");
  });

  test("drop off any image block returns default", () => {
    const view = makeMockView(null, { pos: 10 });
    const decision = computeDropTarget({ view, clientX: 10, clientY: 10 });
    expect(decision.action).toBe("default");
  });

  test("drop with no coords returns default", () => {
    const view = makeMockView({ left: 100, width: 200, top: 0, height: 100 }, null);
    const decision = computeDropTarget({ view, clientX: 130, clientY: 50 });
    expect(decision.action).toBe("default");
  });
});
