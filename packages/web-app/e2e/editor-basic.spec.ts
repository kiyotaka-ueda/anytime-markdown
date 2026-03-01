import { test, expect } from "@playwright/test";

test.describe("Editor Basic", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/markdown");
    // ウェルカムコンテンツの読み込みを待機
    await page.locator(".tiptap").waitFor({ state: "visible" });
  });

  test("page loads with editor and toolbar", async ({ page }) => {
    // ツールバーが表示される
    await expect(page.getByRole("toolbar", { name: /editor/i })).toBeVisible();
    // エディタ領域が表示される
    await expect(page.locator(".tiptap")).toBeVisible();
    // ステータスバーが表示される（文字数表示）
    await expect(page.getByText(/chars/i)).toBeVisible();
  });

  test("can type text in editor", async ({ page }) => {
    const editor = page.locator(".tiptap");
    // エディタをクリアしてテキスト入力
    await editor.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Hello Playwright");
    await expect(editor).toContainText("Hello Playwright");
  });

  test("can apply bold formatting via toolbar", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("bold text");
    // テキスト選択
    await page.keyboard.press("Control+a");
    // Bold ショートカット
    await page.keyboard.press("Control+b");
    // <strong> が適用されている
    await expect(editor.locator("strong")).toContainText("bold text");
  });
});
