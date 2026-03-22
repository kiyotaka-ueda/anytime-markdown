/**
 * WebFileSystemProvider.ts - 追加カバレッジテスト
 *
 * open, save, saveAs の各ブランチを検証する。
 */

import { WebFileSystemProvider } from "../lib/WebFileSystemProvider";

describe("WebFileSystemProvider", () => {
  let provider: WebFileSystemProvider;

  beforeEach(() => {
    provider = new WebFileSystemProvider();
  });

  describe("supportsDirectAccess", () => {
    it("showOpenFilePicker がない場合は false を返す", () => {
      expect(provider.supportsDirectAccess).toBe(false);
    });

    it("showOpenFilePicker がある場合は true を返す", () => {
      Object.defineProperty(globalThis, "showOpenFilePicker", {
        value: jest.fn(),
        writable: true,
        configurable: true,
      });
      const p = new WebFileSystemProvider();
      expect(p.supportsDirectAccess).toBe(true);
      delete (globalThis as any).showOpenFilePicker;
    });
  });

  describe("open", () => {
    it("supportsDirectAccess が false の場合は null を返す", async () => {
      const result = await provider.open();
      expect(result).toBeNull();
    });

    it("正常にファイルを開けた場合は FileOpenResult を返す", async () => {
      // jsdom の File には text() がないため、text() メソッドを持つオブジェクトを使用
      const mockFile = { name: "test.md", text: jest.fn().mockResolvedValue("# Hello") };
      const mockHandle = {
        name: "test.md",
        getFile: jest.fn().mockResolvedValue(mockFile),
      };
      const mockShowOpen = jest.fn().mockResolvedValue([mockHandle]);

      (window as any).showOpenFilePicker = mockShowOpen;
      (globalThis as any).showOpenFilePicker = mockShowOpen;

      const p = new WebFileSystemProvider();
      const result = await p.open();

      expect(mockShowOpen).toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result!.handle.name).toBe("test.md");
      expect(result!.content).toBe("# Hello");
      expect(result!.handle.nativeHandle).toBe(mockHandle);

      delete (window as any).showOpenFilePicker;
      delete (globalThis as any).showOpenFilePicker;
    });

    it("ユーザーがキャンセルした場合は null を返す", async () => {
      (globalThis as any).showOpenFilePicker = jest.fn().mockRejectedValue(new Error("User cancelled"));

      class TestProvider extends WebFileSystemProvider {
        get supportsDirectAccess() { return true; }
      }

      const p = new TestProvider();
      const result = await p.open();

      expect(result).toBeNull();

      delete (globalThis as any).showOpenFilePicker;
    });
  });

  describe("save", () => {
    it("handle.nativeHandle がない場合は何もしない", async () => {
      await provider.save({ name: "test.md" }, "content");
      // Should not throw
    });

    it("正常に保存できる", async () => {
      const mockWrite = jest.fn().mockResolvedValue(undefined);
      const mockClose = jest.fn().mockResolvedValue(undefined);
      const mockCreateWritable = jest.fn().mockResolvedValue({
        write: mockWrite,
        close: mockClose,
      });
      const nativeHandle = { createWritable: mockCreateWritable, name: "test.md" };

      await provider.save({ name: "test.md", nativeHandle }, "# Content");

      expect(mockCreateWritable).toHaveBeenCalled();
      expect(mockWrite).toHaveBeenCalledWith("# Content");
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe("saveAs", () => {
    it("supportsDirectAccess が false の場合は null を返す", async () => {
      const result = await provider.saveAs("content");
      expect(result).toBeNull();
    });

    it("正常に新しいファイルとして保存できる", async () => {
      const mockWrite = jest.fn().mockResolvedValue(undefined);
      const mockClose = jest.fn().mockResolvedValue(undefined);
      const mockHandle = {
        name: "document.md",
        createWritable: jest.fn().mockResolvedValue({
          write: mockWrite,
          close: mockClose,
        }),
      };
      (globalThis as any).showSaveFilePicker = jest.fn().mockResolvedValue(mockHandle);

      class TestProvider extends WebFileSystemProvider {
        get supportsDirectAccess() { return true; }
      }

      const p = new TestProvider();
      const result = await p.saveAs("# New Content");

      expect(result).not.toBeNull();
      expect(result!.name).toBe("document.md");
      expect(result!.nativeHandle).toBe(mockHandle);
      expect(mockWrite).toHaveBeenCalledWith("# New Content");

      delete (globalThis as any).showSaveFilePicker;
    });

    it("ユーザーがキャンセルした場合は null を返す", async () => {
      (globalThis as any).showSaveFilePicker = jest.fn().mockRejectedValue(new Error("Cancelled"));

      class TestProvider extends WebFileSystemProvider {
        get supportsDirectAccess() { return true; }
      }

      const p = new TestProvider();
      const result = await p.saveAs("content");

      expect(result).toBeNull();

      delete (globalThis as any).showSaveFilePicker;
    });
  });
});
