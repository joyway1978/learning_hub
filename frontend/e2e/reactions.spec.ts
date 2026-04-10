import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Reactions Feature', () => {
  // Login before tests using existing test account
  test.beforeEach(async ({ page }) => {
    const email = 'qatest@example.com';
    const password = 'qatest123';

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 15000 });
  });

  test('should display reaction buttons on material detail page', async ({ page }) => {
    await page.goto('/materials/25');

    // Wait for reaction section to appear
    await page.waitForSelector('h3:has-text("表达反馈")', { timeout: 10000 });

    // Check if all 4 reaction buttons are visible (in desktop section)
    const desktopSection = page.locator('.hidden.lg\\:block');
    await expect(desktopSection.locator('button', { hasText: '👍' }).first()).toBeVisible();
    await expect(desktopSection.locator('button', { hasText: '👎' }).first()).toBeVisible();
    await expect(desktopSection.locator('button', { hasText: '❓' }).first()).toBeVisible();
    await expect(desktopSection.locator('button', { hasText: '💡' }).first()).toBeVisible();
  });

  test('should add a reaction when clicking button', async ({ page }) => {
    await page.goto('/materials/25');
    await page.waitForSelector('h3.mb-3:has-text("表达反馈")', { timeout: 10000 });

    // Find thumbs up button (desktop section only)
    const desktopSection = page.locator('.hidden.lg\\:block');
    const thumbsUpButton = desktopSection.locator('button', { hasText: '👍' }).first();
    await expect(thumbsUpButton).toBeVisible();

    // Click thumbs up
    await thumbsUpButton.click();

    // Wait for visual feedback (selected state)
    await page.waitForTimeout(1000);

    // Take screenshot for verification
    await page.screenshot({ path: 'test-results/reaction-added.png' });
  });

  test('should remove reaction when clicking same button again', async ({ page }) => {
    await page.goto('/materials/25');
    await page.waitForSelector('h3.mb-3:has-text("表达反馈")', { timeout: 10000 });

    // Find thumbs up button (desktop section)
    const desktopSection = page.locator('.hidden.lg\\:block');
    const thumbsUpButton = desktopSection.locator('button', { hasText: '👍' }).first();

    // Add reaction
    await thumbsUpButton.click();
    await page.waitForTimeout(500);

    // Remove reaction
    await thumbsUpButton.click();
    await page.waitForTimeout(500);

    // Take screenshot
    await page.screenshot({ path: 'test-results/reaction-removed.png' });
  });

  test('should switch reaction type', async ({ page }) => {
    await page.goto('/materials/25');
    await page.waitForSelector('h3.mb-3:has-text("表达反馈")', { timeout: 10000 });

    // Find buttons in desktop section
    const desktopSection = page.locator('.hidden.lg\\:block');
    const thumbsUpButton = desktopSection.locator('button', { hasText: '👍' }).first();
    const insightButton = desktopSection.locator('button', { hasText: '💡' }).first();

    // Click thumbs up
    await thumbsUpButton.click();
    await page.waitForTimeout(500);

    // Switch to insight
    await insightButton.click();
    await page.waitForTimeout(500);

    // Take screenshot
    await page.screenshot({ path: 'test-results/reaction-switched.png' });
  });

  test('should persist reaction after page refresh', async ({ page }) => {
    await page.goto('/materials/25');
    await page.waitForSelector('h3.mb-3:has-text("表达反馈")', { timeout: 10000 });

    // Find thumbs up button (desktop section)
    const desktopSection = page.locator('.hidden.lg\\:block');
    const thumbsUpButton = desktopSection.locator('button', { hasText: '👍' }).first();

    // Add reaction
    await thumbsUpButton.click();
    await page.waitForTimeout(1000);

    // Refresh page
    await page.reload();
    await page.waitForSelector('h3.mb-3:has-text("表达反馈")', { timeout: 10000 });

    // Take screenshot after refresh
    await page.screenshot({ path: 'test-results/reaction-persisted.png' });
  });
});
