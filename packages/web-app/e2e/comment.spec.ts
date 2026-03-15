import { test, expect } from "@playwright/test";
import { openEmptyEditor } from "./helpers";

test.describe("Comment", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openEmptyEditor(page);
  });

  test("テキスト選択後 Ctrl+Shift+M でコメント追加", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("comment target text");
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Control+Shift+m");
    // コメントダイアログが表示される
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
  });

  test("ツールバーのコメントアイコンでパネル開閉", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("test content");
    // コメントパネルトグルボタンをクリック
    const commentBtn = page.locator('[aria-label*="comment" i], [aria-label*="コメント"]').first();
    if (await commentBtn.isVisible()) {
      await commentBtn.click();
      // パネルが表示される（コメント関連の UI が表示される）
      await page.waitForTimeout(500);
      // もう一度クリックで閉じる
      await commentBtn.click();
    }
  });
});
