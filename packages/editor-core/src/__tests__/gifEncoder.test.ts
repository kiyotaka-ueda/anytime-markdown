import { extractFrameFromCanvas, GifRecorderState } from "../utils/gifEncoder";

// jsdom does not implement canvas getContext, so we mock it globally
const mockCtx = {
  fillStyle: "",
  fillRect: jest.fn(),
  getImageData: jest.fn().mockImplementation((x: number, y: number, w: number, h: number) => ({
    data: new Uint8ClampedArray(w * h * 4),
    width: w,
    height: h,
    colorSpace: "srgb" as PredefinedColorSpace,
  })),
  drawImage: jest.fn(),
};

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue(mockCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

describe("gifEncoder", () => {
  describe("GifRecorderState", () => {
    it("should initialize with idle state", () => {
      const state = new GifRecorderState();
      expect(state.status).toBe("idle");
      expect(state.frames).toHaveLength(0);
      expect(state.elapsed).toBe(0);
    });

    it("should track frames", () => {
      const state = new GifRecorderState();
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      state.addFrame(canvas);
      expect(state.frames).toHaveLength(1);
    });

    it("should enforce max duration", () => {
      const state = new GifRecorderState({ maxDuration: 30000, fps: 10 });
      expect(state.maxFrames).toBe(300);
    });

    it("should clear frames on reset", () => {
      const state = new GifRecorderState();
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      state.addFrame(canvas);
      state.reset();
      expect(state.frames).toHaveLength(0);
      expect(state.status).toBe("idle");
    });

    it("should reject frames when maxFrames reached", () => {
      const state = new GifRecorderState({ maxDuration: 1000, fps: 2 }); // max 2 frames
      const canvas = document.createElement("canvas");
      canvas.width = 10;
      canvas.height = 10;
      expect(state.addFrame(canvas)).toBe(true);
      expect(state.addFrame(canvas)).toBe(true);
      expect(state.addFrame(canvas)).toBe(false);
      expect(state.frames).toHaveLength(2);
    });
  });

  describe("extractFrameFromCanvas", () => {
    it("should crop rectangle from source canvas and resize", () => {
      const source = document.createElement("canvas");
      source.width = 200;
      source.height = 200;

      const rect = { x: 50, y: 50, width: 100, height: 100 };
      const result = extractFrameFromCanvas(source, rect, 80);
      expect(result.width).toBe(80);
      // 100:100 aspect ratio -> 80:80
      expect(result.height).toBe(80);
    });

    it("should maintain aspect ratio", () => {
      const source = document.createElement("canvas");
      source.width = 400;
      source.height = 300;

      const rect = { x: 0, y: 0, width: 400, height: 200 };
      const result = extractFrameFromCanvas(source, rect, 800);
      expect(result.width).toBe(800);
      expect(result.height).toBe(400); // 400:200 = 2:1, so 800:400
    });
  });
});
