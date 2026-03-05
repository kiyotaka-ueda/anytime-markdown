import { test, expect } from "@playwright/test";

test.describe("Toolbar", () => {
  test.beforeEach(async ({ page }) => {
    // デスクトップ幅でツールバーボタンを表示
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/markdown");
    await page.locator(".tiptap").waitFor({ state: "visible" });
    // ウェルカムコンテンツをクリア
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Backspace");
  });

  test("insert heading via slash command", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("/h1");
    // スラッシュコマンドメニューが表示される
    const menu = page.getByRole("menu", { name: "Type to filter..." });
    await expect(menu).toBeVisible();
    // Heading 1 メニュー項目をクリック
    await menu.getByRole("menuitem", { name: /Heading 1/i }).click();
    // h1 要素が挿入される
    await expect(editor.locator("h1")).toBeVisible();
  });

  test("insert code block via slash command", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    // スラッシュコマンドでコードブロックを挿入
    await page.keyboard.type("/codeblock");
    const menu = page.getByRole("menu", { name: "Type to filter..." });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: /Code Block/i }).click();
    // pre > code 要素が挿入される
    await expect(editor.locator("pre code")).toBeVisible();
  });

  test("insert table via slash command", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    // スラッシュコマンドでテーブルを挿入
    await page.keyboard.type("/table");
    const menu = page.getByRole("menu", { name: "Type to filter..." });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Table", exact: true }).click();
    // table 要素が挿入される
    await expect(editor.locator("table")).toBeVisible();
  });

  test("insert horizontal rule via slash command", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    // スラッシュコマンドで区切り線を挿入
    await page.keyboard.type("/divider");
    const menu = page.getByRole("menu", { name: "Type to filter..." });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: /Divider/i }).click();
    // hr 要素が挿入される
    await expect(editor.locator("hr")).toBeVisible();
  });

  test("insert mermaid diagram via slash command", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    // スラッシュコマンドで Mermaid ダイアグラムを挿入
    await page.keyboard.type("/mermaid");
    const menu = page.getByRole("menu", { name: "Type to filter..." });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: /Mermaid/i }).click();
    // Mermaid コードブロックが挿入される（NodeView 内）
    await expect(editor.locator("pre")).toBeVisible();
  });
});
