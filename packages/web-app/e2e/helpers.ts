import type { Page } from "@playwright/test";

const STORAGE_KEY = "markdown-editor-content";

/**
 * エディタを空の状態で開く。
 * localStorage に空文字を設定してから遷移し、Edit モードに切り替える。
 * 注意: page.goto() の前に addInitScript が必要なため、この関数が goto も実行する。
 */
export async function openEmptyEditor(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "");
  }, STORAGE_KEY);
  await page.goto("/markdown");
  const editor = page.locator(".tiptap");
  await editor.waitFor({ state: "visible" });
  // Review モードの場合は Edit モードに切替
  const editBtn = page.getByRole("button", { name: /^edit$/i });
  if (await editBtn.isVisible()) {
    await editBtn.click();
  }
}
