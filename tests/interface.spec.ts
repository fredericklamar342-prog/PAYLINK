import { test, expect } from "@playwright/test";
import { createPayment } from "../lib/payments";

const draft = {
  amount: "0.25",
  recipient: "0x1234567890123456789012345678901234567890",
  recipientName: "Ada Studio",
  description: "Brand identity",
  expiry: "",
};

test("homepage examples switch by keyboard and lead to a blank real request", async ({ page }) => {
  await page.goto("/");
  const examples = page.getByRole("group", { name: "Payment examples" });
  const split = examples.getByRole("button", { name: "Split a bill" });
  await split.focus();
  await page.keyboard.press("Enter");
  await expect(split).toHaveAttribute("aria-pressed", "true");
  await expect(examples.getByRole("button", { name: "Freelance work" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#demo-ticket .ticket-amount")).toHaveText("12.50 USDC");
  await expect(page.locator("#demo-ticket")).toContainText("Your share of dinner");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Make your own payment link" }).click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.locator("#amount")).toHaveValue("");
  await expect(page.locator("#recipient")).toHaveValue("");
});

test("required-details checklist tracks valid input and returns focus to fields", async ({ page }) => {
  await page.goto("/create");
  const progress = page.getByRole("progressbar", { name: "Required details completed" });
  await expect(progress).toHaveAttribute("value", "0");
  await page.locator("#amount").fill("0");
  await expect(progress).toHaveAttribute("value", "0");
  await page.locator("#amount").fill(draft.amount);
  await expect(progress).toHaveAttribute("value", "1");
  await page.getByRole("link", { name: "Recipient address", exact: true }).click();
  await expect(page.locator("#recipient")).toBeFocused();
  await page.locator("#recipient").fill(draft.recipient);
  await page.locator("#description").fill(draft.description);
  await expect(progress).toHaveAttribute("value", "3");
  await page.locator("#amount").fill("");
  await expect(progress).toHaveAttribute("value", "2");
  await page.getByRole("button", { name: "Create Payment Link", exact: true }).click();
  await expect(page.locator("#amount")).toBeFocused();
  await expect(page.locator("#amount")).toHaveAttribute("aria-invalid", "true");
});

test("mobile navigation stays available and marks the current page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  for (const name of ["How it works", "Security", "Create a link"])
    await expect(navigation.getByRole("link", { name })).toBeVisible();
  await navigation.getByRole("link", { name: "Create a link" }).click();
  await expect(
    navigation.getByRole("link", { name: "Create a link" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#amount")).toHaveCSS("font-size", "16px");
  await navigation.getByRole("link", { name: "Security" }).click();
  await expect(page).toHaveURL(/\/#security$/);
  await expect(page.locator("#security")).toBeInViewport();
});

test("both wallet dialogs have correct names and return keyboard focus", async ({
  page,
}) => {
  await page.goto(`/pay/${createPayment(draft).id}`);
  const triggers = page.getByRole("button", { name: "Connect Wallet" });
  await expect(triggers).toHaveCount(2);
  const ids = await page
    .locator("dialog")
    .evaluateAll((elements) =>
      elements.map((e) => e.getAttribute("aria-labelledby")),
    );
  expect(new Set(ids).size).toBe(2);
  for (let i = 0; i < 2; i++) {
    const trigger = triggers.nth(i);
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Connect your wallet" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
});

test("copy feedback is accurate, stable in width, and resets", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/pay/${createPayment(draft).id}`);
  const button = page.getByRole("button", {
    name: "Copy address",
    exact: true,
  });
  const before = await button.boundingBox();
  await button.click();
  const copied = page.getByRole("button", { name: "Copied", exact: true });
  await expect(copied).toBeVisible();
  expect((await copied.boundingBox())!.width).toBeCloseTo(before!.width, 0);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    draft.recipient,
  );
  await expect(button).toBeVisible({ timeout: 5000 });
});

test("clipboard refusal has a readable recovery message", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      value: () =>
        Promise.reject(new DOMException("Denied", "NotAllowedError")),
    });
  });
  await page.goto(`/pay/${createPayment(draft).id}`);
  await page.getByRole("button", { name: "Copy address", exact: true }).click();
  await expect(
    page.getByText("Copy unavailable. Select and copy the text.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("long payment content wraps and full review precedes approval", async ({
  page,
}) => {
  const payment = createPayment({
    ...draft,
    amount: "123456789.123456789123456789",
    recipientName: "Alexandria International Design & Development",
    description:
      "A detailed payment request for an international design project, including research, responsive layouts, and implementation.",
  });
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto(`/pay/${payment.id}`);
  const summary = await page.locator(".payment-summary").boundingBox();
  const approval = await page.locator(".payment-actions").boundingBox();
  expect(summary!.y + summary!.height).toBeLessThanOrEqual(approval!.y);
  await expect(page.locator(".ticket-amount")).toContainText(payment.amount);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.screenshot({
    path: "test-results/payment-long-mobile.png",
    fullPage: true,
  });
});

test("reduced motion disables movement and public content works without JavaScript", async ({
  page,
  browser,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Connect Wallet" }).click();
  await expect(page.getByRole("dialog")).toHaveCSS("transform", "none");
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe("auto");
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  const staticPage = await context.newPage();
  await staticPage.goto(new URL("/", page.url()).href);
  await expect(
    staticPage.getByRole("heading", {
      name: "Get Paid in Crypto. Just Share a Link.",
    }),
  ).toBeVisible();
  await expect(
    staticPage.getByRole("navigation").getByRole("link", { name: "Security" }),
  ).toBeVisible();
  await expect(
    staticPage.getByRole("article", { name: "Payment ticket preview" }),
  ).toBeVisible();
  await context.close();
});

test("expiration presets explain local time and custom expiry validates inline", async ({ page }) => {
  await page.goto("/create");
  const group = page.getByRole("group", { name: "Payment link expiration" });
  const day = group.getByRole("button", { name: "24 hours", exact: true });
  await day.click();
  await expect(day).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("This payment link will expire in 24 hours.", { exact: true })).toBeVisible();
  await expect(page.getByText(/Expires .+ in your local timezone\./)).toBeVisible();

  await group.getByRole("button", { name: "Custom", exact: true }).click();
  const custom = page.locator("#expiry");
  await expect(custom).toBeVisible();
  await custom.fill("2020-01-01T12:00");
  await page.locator("#amount").fill(draft.amount);
  await page.locator("#recipient").fill(draft.recipient);
  await page.locator("#description").fill(draft.description);
  await page.getByRole("button", { name: "Create Payment Link", exact: true }).click();
  await expect(custom).toBeFocused();
  await expect(page.getByText("Choose an expiry in the future.", { exact: true })).toBeVisible();
});

test("form errors are described before focus and results restore focus", async ({ page }) => {
  await page.goto("/create");
  const amount = page.getByLabel("Amount", { exact: false });
  await expect(amount).not.toHaveAttribute("aria-invalid");
  await page.getByRole("button", { name: "Create Payment Link", exact: true }).click();
  await expect(amount).toBeFocused();
  await expect(amount).toHaveAttribute("aria-invalid", "true");
  await expect(amount).toHaveAccessibleDescription(/Enter an amount greater than zero/);
  await amount.fill(draft.amount);
  await expect(amount).not.toHaveAttribute("aria-invalid");
  await page.getByRole("button", { name: "Create Payment Link", exact: true }).click();
  const recipient = page.getByLabel("Recipient wallet", { exact: false });
  await expect(recipient).toBeFocused();
  await expect(recipient).toHaveAccessibleDescription(/Enter a valid recipient wallet address/);
  await recipient.fill(draft.recipient);
  await page.locator("#description").fill(draft.description);
  await page.getByRole("button", { name: "Create Payment Link", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your link is ready." })).toBeFocused();
  await page.getByRole("button", { name: "Create another link" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
});

test("wallet error announcements stay mounted in the accessibility tree", async ({ page }) => {
  await page.goto("/create");
  const trigger = page.getByRole("button", { name: "Connect Wallet" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Connect your wallet" });
  const alert = dialog.getByRole("alert");
  await expect(alert).toHaveCount(1);
  await expect(alert).toHaveText("");
  await expect(alert).not.toHaveCSS("display", "none");
  await page.getByRole("button", { name: "Browser wallet", exact: true }).click();
  await expect(alert).toContainText("No browser wallet found");
  await page.getByRole("button", { name: "Close wallet dialog" }).click();
  await expect(trigger).toBeFocused();
});
