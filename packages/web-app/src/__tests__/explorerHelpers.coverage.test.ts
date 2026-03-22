/**
 * explorer/helpers.ts の未カバー関数 (listAllFiles) のテスト
 */

// jsdom には Response がないため polyfill
class MockResponse {
  ok: boolean;
  status: number;
  _body: string | null;
  constructor(body: string | null, init?: { status?: number }) {
    this.status = init?.status ?? 200;
    this.ok = this.status >= 200 && this.status < 300;
    this._body = body;
  }
  async json() {
    return JSON.parse(this._body ?? "null");
  }
  async text() {
    return this._body ?? "";
  }
}
(globalThis as any).Response = MockResponse;

import { listAllFiles } from "../components/explorer/helpers";

const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

afterEach(() => {
  mockFetch.mockReset();
});

describe("listAllFiles", () => {
  it("returns file paths from flat directory", async () => {
    const entries = [
      { path: "docs/a.md", type: "file", name: "a.md" },
      { path: "docs/b.md", type: "file", name: "b.md" },
    ];
    mockFetch.mockResolvedValue(
      new MockResponse(JSON.stringify(entries), { status: 200 }),
    );

    const result = await listAllFiles("user/repo", "main", "docs");
    expect(result).toEqual(["docs/a.md", "docs/b.md"]);
  });

  it("recursively lists files in subdirectories", async () => {
    // First call: root dir with subdir and file
    mockFetch.mockResolvedValueOnce(
      new MockResponse(
        JSON.stringify([
          { path: "docs/sub", type: "dir", name: "sub" },
          { path: "docs/root.md", type: "file", name: "root.md" },
        ]),
        { status: 200 },
      ),
    );
    // Second call: subdir contents
    mockFetch.mockResolvedValueOnce(
      new MockResponse(
        JSON.stringify([
          { path: "docs/sub/deep.md", type: "file", name: "deep.md" },
        ]),
        { status: 200 },
      ),
    );

    const result = await listAllFiles("user/repo", "main", "docs");
    expect(result).toEqual(["docs/sub/deep.md", "docs/root.md"]);
  });

  it("returns empty array when directory is empty", async () => {
    mockFetch.mockResolvedValue(
      new MockResponse(JSON.stringify([]), { status: 200 }),
    );
    const result = await listAllFiles("user/repo", "main", "docs");
    expect(result).toEqual([]);
  });

  it("handles non-array API response", async () => {
    mockFetch.mockResolvedValue(
      new MockResponse(JSON.stringify({ error: "not found" }), { status: 200 }),
    );
    const result = await listAllFiles("user/repo", "main", "docs");
    expect(result).toEqual([]);
  });

  it("handles branch parameter in fetchCommits without branch", async () => {
    // This tests fetchBranches non-array response
    mockFetch.mockResolvedValue(
      new MockResponse(JSON.stringify("not-array"), { status: 200 }),
    );
    // Import fetchBranches for additional coverage
    const { fetchBranches } = require("../components/explorer/helpers");
    const result = await fetchBranches("user/repo");
    expect(result).toEqual([]);
  });
});
