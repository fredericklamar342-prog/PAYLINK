import { test, expect, type Page } from "@playwright/test";

async function createRequest(page: Page) {
  await page.goto("/create");
  await page.locator("#amount").fill("12.50");
  await page.locator("#token").selectOption("USDC");
  await page.locator("#recipient").fill("0x1234567890123456789012345678901234567890");
  await page.locator("#description").fill("Design work");
  await page.getByRole("button", { name: "Create Payment Link", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your link is ready." })).toBeFocused();
  await expect(page.getByLabel("Payment URL")).toBeVisible();
  return page.getByLabel("Payment URL").inputValue();
}

test("all extra expiry durations remain available through keyboard disclosure", async ({ page }) => {
  await page.goto("/create");
  const disclosure = page.locator(".expiry-more summary");
  await disclosure.focus();
  await page.keyboard.press("Enter");
  const extra = page.getByRole("group", { name: "More expiration durations" });
  for (const [label, description] of [["15 min", "15 minutes"], ["30 min", "30 minutes"], ["1 hour", "1 hour"], ["6 hours", "6 hours"], ["3 days", "3 days"], ["7 days", "7 days"]]) {
    const button = extra.getByRole("button", { name: label, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(`This payment link will expire in ${description}.`, { exact: true })).toBeVisible();
  }
  await disclosure.click();
  await expect(page.getByText("This payment link will expire in 7 days.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "No expiry", exact: true }).click();
  await expect(page.getByText("This payment link will not expire.", { exact: true })).toBeVisible();
});

test("mobile preview returns focus and sticky action leaves focused fields exposed", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/create");
  await page.getByRole("link", { name: "Preview your request" }).click();
  await expect(page.locator("#request-preview")).toBeFocused();
  await page.getByRole("link", { name: "Back to payment details" }).click();
  await expect(page.locator("#composer-heading")).toBeFocused();
  await page.locator("#amount").fill("5");
  await page.locator("#recipient").fill("0x1234567890123456789012345678901234567890");
  await page.locator("#description").fill("Design work");
  await expect(page.locator(".create-action")).toHaveAttribute("data-ready", "true");
  for (const id of ["amount", "token", "recipient", "recipientName", "description"]) {
    await page.locator(`#${id}`).focus();
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator(`#${id}`).evaluate(element => {
      const rect = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    })).toBe(true);
  }
});

test("completion copy and share fallback preserve the saved URL", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
  const url = await createRequest(page);
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  await page.getByRole("button", { name: "Share link", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Payment link copied. Paste it into a message." })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
});

test("native sharing uses the saved URL and reports completion", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "share", {
    value: async (data: ShareData) => { document.documentElement.dataset.sharedUrl = data.url; },
  }));
  const url = await createRequest(page);
  await page.getByRole("button", { name: "Share link", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-shared-url", url);
  await expect(page.getByText("Payment link shared.", { exact: true })).toBeVisible();
});

test("share cancellation stays quiet and refusal offers a recovery path", async ({ page }) => {
  await page.addInitScript(() => {
    let calls = 0;
    Object.defineProperty(navigator, "share", { value: async () => {
      throw new DOMException("Sharing stopped", calls++ === 0 ? "AbortError" : "NotAllowedError");
    } });
  });
  const url = await createRequest(page);
  const share = page.getByRole("button", { name: "Share link", exact: true });
  await share.click();
  await expect(share).toBeEnabled();
  await expect(page.getByText(/Sharing is unavailable/)).toHaveCount(0);
  await share.click();
  await expect(page.getByText("Sharing is unavailable. Use Copy link, or select and copy the payment URL.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Payment URL")).toHaveValue(url);
});
