import { test, expect } from "@playwright/test";
import { openEmptyEditor } from "./helpers";

test.describe("Block Elements", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openEmptyEditor(page);
  });

  test("コードブロックの削除ボタンで削除", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    // スラッシュコマンドでコードブロックを挿入
    await page.keyboard.type("/codeblock");
    const menu = page.getByRole("menu", { name: "Type to filter..." });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: /Code Block/i }).click();
    await expect(editor.locator("pre")).toBeVisible();
    // 削除ボタンをクリック（ツールバーの削除アイコン）
    const deleteBtn = editor.locator('[aria-label="delete"]').first();
    await deleteBtn.click();
    // 確認ダイアログで OK をクリック
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "OK" }).click();
    // コードブロックが削除される
    await expect(editor.locator("pre")).toHaveCount(0);
  });

  test("Mermaid ブロックのダブルクリックで編集ダイアログが開く", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    // スラッシュコマンドで Mermaid を挿入
    await page.keyboard.type("/mermaid");
    const menu = page.getByRole("menu", { name: "Type to filter..." });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: /Mermaid/i }).click();
    // Mermaid プレビューエリアが表示されるまで待つ
    const preview = editor.locator(".mermaid-preview, svg").first();
    await expect(preview).toBeVisible({ timeout: 10000 });
    // ダブルクリックで編集ダイアログを開く
    await preview.dblclick();
    // フルスクリーンダイアログが開く
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  });
});
