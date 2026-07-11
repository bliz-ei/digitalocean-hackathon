import { chromium, expect, test } from "@playwright/test";
import path from "node:path";

type OverlaySnapshot = {
  connection?: string;
  claim?: { public_id: string; state: string; verdict?: { label: string; citation_ids: string[] } };
  error?: string;
};

test("the packed extension runs the fixture demo to a verdict and the PWA shows the same claim", async ({}, testInfo) => {
  const extension = path.resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(testInfo.outputPath("profile"), {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });

  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    const popup = await context.newPage();
    await popup.goto(new URL("popup.html", worker.url()).href);
    await popup.getByRole("button", { name: "Run disclosed fixture demo" }).click();

    const overlay = async (): Promise<OverlaySnapshot> => worker.evaluate(async () => {
      const { overlayState } = await chrome.storage.session.get("overlayState");
      return overlayState ?? {};
    });

    await expect
      .poll(async () => (await overlay()).claim?.state ?? (await overlay()).error ?? "PENDING", { timeout: 20_000 })
      .toBe("COMPLETE");

    const state = await overlay();
    expect(state.claim?.verdict?.label).toBe("Misleading");
    expect(state.claim?.verdict?.citation_ids).toHaveLength(3);

    // The paired-phone view of the very same claim: the public PWA page.
    const phone = await context.newPage();
    await phone.goto(`http://127.0.0.1:5173/claims/${state.claim!.public_id}`);
    await expect(phone.getByText("Misleading")).toBeVisible();
    await expect(phone.locator(".vy-citation")).toHaveCount(3);
  } finally {
    await context.close();
  }
});

test("the PWA fixture demo, phone pairing, and notification enablement survive a full user journey", async ({ page, request, context }) => {
  // Presenter starts a session and pairs the "phone" exactly as in the demo script.
  const sessionResponse = await request.post("http://127.0.0.1:8000/v1/sessions", {
    data: { idempotency_key: `golden-journey-${Date.now()}` },
  });
  const session = await sessionResponse.json();
  const pairing = await (await request.post("http://127.0.0.1:8000/v1/pairings", {
    data: { session_id: session.id },
  })).json();

  await page.goto("/");
  await page.getByLabel("Pairing code").fill(pairing.code);
  await page.getByRole("button", { name: "Pair device" }).click();
  await expect(page.getByRole("button", { name: "Enable notifications" })).toBeVisible();

  // The paired phone opens the canonical claim produced by the fixture pipeline.
  const claim = await (await request.post(`http://127.0.0.1:8000/v1/sessions/${session.id}/claims`)).json();
  expect(claim.state).toBe("COMPLETE");
  await page.goto(`/claims/${claim.public_id}`);
  await expect(page.getByText("Misleading")).toBeVisible();
  await expect(page.locator(".vy-citation")).toHaveCount(3);
});
