import { test, expect } from "@playwright/test";
import { openEmptyEditor } from "./helpers";

test.describe("Math Rendering", () => {
  test.beforeEach(async ({ page }) => {
    await openEmptyEditor(page);
  });

  test("math code block renders KaTeX", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    // Insert math block via slash command
    await page.keyboard.type("/");
    await page.waitForTimeout(300);
    await page.keyboard.type("math");
    await page.waitForTimeout(200);
    await page.getByRole("menuitem").first().click();
    // Fullscreen edit dialog opens automatically — type formula in textarea
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });
    const textarea = dialog.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await textarea.fill("E = mc^2");
    // Close dialog
    await dialog.getByRole("button", { name: /close/i }).click();
    await expect(dialog).not.toBeVisible();
    // Verify KaTeX rendered (look for .katex class in the rendered output)
    await expect(editor.locator(".katex")).toBeVisible({ timeout: 5000 });
  });
});
