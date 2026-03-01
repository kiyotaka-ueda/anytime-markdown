import { test, expect } from "@playwright/test";

test.describe("Keyboard Shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator(".tiptap").waitFor({ state: "visible" });
    // ウェルカムコンテンツをクリアしてテスト準備
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Backspace");
  });

  test("Ctrl+B toggles bold", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("bold test");
    // テキストを全選択してBold適用
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Control+b");
    // <strong> 要素が存在することを確認
    await expect(editor.locator("strong")).toContainText("bold test");
    // もう一度 Ctrl+B で Bold 解除
    await page.keyboard.press("Control+b");
    // <strong> 要素が消えていることを確認
    await expect(editor.locator("strong")).toHaveCount(0);
    // テキスト自体は残っている
    await expect(editor).toContainText("bold test");
  });

  test("Ctrl+Z undoes and Ctrl+Y redoes", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("first");
    await page.keyboard.type(" second");
    await expect(editor).toContainText("first second");
    // Ctrl+Z で undo: 追加テキストが消える
    await page.keyboard.press("Control+z");
    await expect(editor).not.toContainText("second");
    // Ctrl+Y で redo: 追加テキストが戻る
    await page.keyboard.press("Control+y");
    await expect(editor).toContainText("first second");
  });

  test("Ctrl+S triggers save (no error)", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    // ページエラーを監視
    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));
    // Ctrl+S を押下
    await page.keyboard.press("Control+s");
    // 少し待機してエラーが発生しないことを確認
    await page.waitForTimeout(500);
    expect(errors).toHaveLength(0);
  });
});
