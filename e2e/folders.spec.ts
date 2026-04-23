import { expect, test, type Page } from "@playwright/test";

const TEST_PASSWORD = "test1234abc";

async function registerAndLogin(page: Page, prefix: string) {
  const email = `${prefix}-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel(/confirm/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /create account|sign up|register/i }).click();
  await page.waitForURL(/\/app/);
}

test.describe.configure({ mode: "serial" });

test.describe("F05 folders e2e", () => {
  test("sidebar_create_duplicate_and_filter_navigation", async ({ page }) => {
    await registerAndLogin(page, "folders");
    await expect(page.getByTestId("folder-sidebar")).toBeVisible();
    await expect(page.getByRole("link", { name: /All videos/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Unfiled/i })).toBeVisible();

    await page.getByRole("button", { name: /New folder/i }).click();
    await page.getByLabel("Folder name").fill("Courses");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("link", { name: /Courses/i })).toBeVisible();

    await page.getByRole("button", { name: /New folder/i }).click();
    await page.getByLabel("Folder name").fill("courses");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("A folder with this name already exists")).toBeVisible();

    await page.getByRole("link", { name: /Courses/i }).click();
    await expect(page).toHaveURL(/folder=c/);
    await expect(page.getByRole("link", { name: /Courses/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
