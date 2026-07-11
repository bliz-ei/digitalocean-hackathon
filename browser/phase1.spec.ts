import { chromium, expect, test } from "@playwright/test";
import path from "node:path";

test("explicit fixture action opens the canonical PWA verdict", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start fixture demo" }).click();

  await expect(page).toHaveURL(/\/claims\/hero-ev-lifecycle-2026$/);
  await expect(page.getByRole("heading", { name: "Misleading" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  await expect(page.locator("article li")).toHaveCount(3);
});

test("the production MV3 bundle loads as an unpacked extension", async ({}, testInfo) => {
  const extension = path.resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(testInfo.outputPath("profile"), {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });

  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    expect(worker.url()).toMatch(/^chrome-extension:\/\/.+\/worker\.js$/);
    const popup = await context.newPage();
    await popup.goto(new URL("popup.html", worker.url()).href);
    await expect(popup.getByRole("button", { name: "Start live listening" })).toBeVisible();
    await expect(popup.getByRole("button", { name: "Start fixture" })).toBeVisible();
  } finally {
    await context.close();
  }
});
