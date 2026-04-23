import { buildImageWrapperSx } from "../ImageNodeView";

describe("buildImageWrapperSx hover toolbar behavior", () => {
  test("inside imageRow: hides toolbar by default", () => {
    const sx = buildImageWrapperSx(true, false, true) as Record<string, unknown>;
    const hidden = sx["& > [data-block-toolbar]"] as Record<string, unknown> | undefined;
    expect(hidden).toBeDefined();
    expect(hidden?.opacity).toBe(0);
    expect(hidden?.maxHeight).toBe(0);
  });

  test("inside imageRow: shows toolbar on hover", () => {
    const sx = buildImageWrapperSx(true, false, true) as Record<string, unknown>;
    const hover = sx["&:hover > [data-block-toolbar], &[data-selected='true'] > [data-block-toolbar]"] as Record<string, unknown> | undefined;
    expect(hover).toBeDefined();
    expect(hover?.opacity).toBe(1);
  });

  test("standalone image with showBorder: toolbar visible (no hidden rule)", () => {
    const sx = buildImageWrapperSx(true, false, false) as Record<string, unknown>;
    const hidden = sx["& > [data-block-toolbar]"];
    expect(hidden).toBeUndefined();
  });

  test("standalone image without showBorder: toolbar hidden by default, visible on hover", () => {
    const sx = buildImageWrapperSx(false, false, false) as Record<string, unknown>;
    const hidden = sx["& > [data-block-toolbar]"] as Record<string, unknown> | undefined;
    expect(hidden).toBeDefined();
    expect(hidden?.opacity).toBe(0);
    const hover = sx["&:hover > [data-block-toolbar], &[data-selected='true'] > [data-block-toolbar]"] as Record<string, unknown> | undefined;
    expect(hover?.opacity).toBe(1);
  });
});
