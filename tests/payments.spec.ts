import { test, expect } from "@playwright/test";
import {
  createPayment,
  decodePayment,
  validateDraft,
  paymentReference,
} from "../lib/payments";

const draft = {
  amount: "0.25",
  recipient: "0x1234567890123456789012345678901234567890",
  recipientName: "Ada Studio",
  description: "Brand identity",
  expiry: "",
};
test("portable requests preserve Unicode and exact decimal amounts", () => {
  const payment = createPayment({
    ...draft,
    amount: "0.000000000000000001",
    description: "Design — مرحبا",
  });
  expect(decodePayment(payment.id)).toEqual(payment);
  expect(decodePayment("broken-link")).toBeNull();
  expect(decodePayment("a".repeat(1801))).toBeNull();
  expect(paymentReference(payment.id)).not.toEqual(
    paymentReference(createPayment(draft).id),
  );
});
test("validation rejects unsafe amounts, missing recipients and past expiry", () => {
  for (const amount of [
    "0",
    "-1",
    "1e3",
    "NaN",
    "0.0000000000000000001",
    "1000000000",
    "1.",
  ])
    expect(validateDraft({ ...draft, amount }).amount).toBeTruthy();
  expect(
    validateDraft({
      ...draft,
      recipient: "0x0000000000000000000000000000000000000000",
    }).recipient,
  ).toBeTruthy();
  expect(
    validateDraft({ ...draft, expiry: "2020-01-01T12:00" }).expiry,
  ).toBeTruthy();
  const payload = JSON.parse(
    Buffer.from(createPayment(draft).id, "base64url").toString(),
  );
  payload.c = 1;
  expect(
    decodePayment(Buffer.from(JSON.stringify(payload)).toString("base64url")),
  ).toBeNull();
});
test("landing, form, shareable request and empty receipt work without browser errors", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Payment links, without the crypto friction.",
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Create a Payment Link" })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Create Payment Link", exact: true })
    .click();
  await expect(
    page.getByText("Enter an amount greater than zero", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("#amount")).toBeFocused();
  await page.getByLabel("Amount", { exact: false }).fill(draft.amount);
  await page
    .getByLabel("Recipient wallet", { exact: false })
    .fill(draft.recipient);
  await page
    .getByLabel("Recipient name", { exact: false })
    .fill(draft.recipientName);
  await page
    .getByLabel("What’s the payment for?", { exact: false })
    .fill(draft.description);
  await expect(page.getByRole("article")).toContainText(draft.recipientName);
  await page
    .getByRole("button", { name: "Create Payment Link", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your link is ready." }),
  ).toBeVisible();
  const url = await page.getByLabel("Payment URL").inputValue();
  expect(url).toContain("/pay/");
  await expect(page.locator(".qr-code svg")).toBeVisible();
  const fresh = await context.browser()!.newContext();
  const payer = await fresh.newPage();
  await payer.goto(url);
  await expect(
    payer.getByRole("heading", { name: draft.recipientName }),
  ).toBeVisible();
  await expect(
    payer.getByText("Awaiting payment", { exact: true }),
  ).toBeVisible();
  await payer.getByRole("button", { name: "Connect Wallet" }).last().click();
  await payer
    .getByRole("button", { name: "Browser wallet", exact: true })
    .click();
  await expect(payer.getByRole("dialog").getByRole("alert")).toContainText(
    "No browser wallet found",
  );
  await payer.keyboard.press("Escape");
  await expect(payer.getByRole("dialog")).not.toBeVisible();
  await fresh.close();
  await page.goto("/pay/invalid-id");
  await expect(
    page.getByRole("heading", { name: "This payment link isn’t valid." }),
  ).toBeVisible();
  await page.goto("/success");
  await expect(
    page.getByRole("heading", { name: "A receipt starts with a payment." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile and tablet layouts fit the viewport", async ({ page }) => {
  for (const width of [375, 667, 820, 1440]) {
    await page.setViewportSize({ width, height: width === 667 ? 375 : 900 });
    for (const path of [
      "/",
      "/create",
      `/pay/${createPayment(draft).id}`,
      "/success",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/landing-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
    path: "test-results/landing-mobile.png",
    fullPage: true,
  });
});
test("expired request blocks payment", async ({ page }) => {
  const payment = createPayment({
    ...draft,
    expiry: new Date(Date.now() + 2000).toISOString(),
  });
  await page.goto(`/pay/${payment.id}`);
  await expect(page.getByText("Request expired", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    page.getByRole("article").getByRole("button", { name: "Connect Wallet" }),
  ).toHaveCount(0);
});
