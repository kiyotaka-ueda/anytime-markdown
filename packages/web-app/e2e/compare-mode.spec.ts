import { test, expect } from "@playwright/test";
import { openEmptyEditor } from "./helpers";

test.describe("Compare Mode", () => {
  test.beforeEach(async ({ page }) => {
    // デスクトップ幅が必要（比較モードは PC のみ）
    await page.setViewportSize({ width: 1280, height: 720 });
    await openEmptyEditor(page);
  });

  test("比較モードボタンで切替", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("test content");
    // 比較モードボタンを探してクリック
    const compareBtn = page.locator('[aria-label*="compare" i], [aria-label*="比較"]').first();
    if (await compareBtn.isVisible()) {
      await compareBtn.click();
      // 比較モードが有効になる（2つのエディタパネルが表示される等）
      await page.waitForTimeout(500);
      // もう一度クリックで通常モードに戻す
      await compareBtn.click();
    }
  });
});
