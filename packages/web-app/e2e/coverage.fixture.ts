import { test as base } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const V8_COV_DIR = join(import.meta.dirname, "..", ".v8-coverage");

export const test = base.extend<object>({
  page: async ({ page, browserName }, use, testInfo) => {
    const isChromium = browserName === "chromium";
    if (isChromium) {
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
    }
    await use(page);
    if (isChromium) {
      const coverage = await page.coverage.stopJSCoverage();
      if (coverage.length > 0) {
        await mkdir(V8_COV_DIR, { recursive: true });
        const fileName = `${testInfo.testId}.json`;
        await writeFile(
          join(V8_COV_DIR, fileName),
          JSON.stringify(coverage),
        );
      }
    }
  },
});

export { expect } from "@playwright/test";
