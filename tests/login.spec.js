const { test, expect } = require('@playwright/test');

/*
 * ============================================================================
 * Facultyware – Login Flow E2E Tests
 * ============================================================================
 *
 * Prerequisites:
 * 1. The app server must be running: `npm run dev` or `npm start` (default http://localhost:3000)
 * 2. The MySQL database `facultyware` must be seeded with:
 * - An admin user    (role = 'admin')
 * - An admin kepegawaian (role = 'admin_kepegawaian')
 * Passwords must be bcrypt-hashed in the `users` table.
 * 3. Install Playwright:  npm install -D @playwright/test
 * Then run:            npx playwright test tests/login.spec.js
 *
 * Adjust the credentials below to match YOUR seeded database.
 * ============================================================================
 */

// ─── Test Credentials (edit these to match your DB seed) ─────────────────────
const BASE_URL = 'http://localhost:3000';

const ADMIN_USER = {
  username: 'admin',
  password: 'admin123',
};

const ADMIN_KEPEGAWAIAN_USER = {
  username: 'admin_kepegawaian',
  password: 'admin123',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Navigate to the login page and verify it rendered correctly.
 */
async function goToLoginPage(page) {
  await page.goto(`${BASE_URL}/login`);
  await expect(page).toHaveTitle('Login - HR System');
  await expect(page.locator('h1')).toHaveText('Welcome back');
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

test.describe('Login Page – Rendering', () => {
  test('should display the login form with all expected elements', async ({ page }) => {
    await goToLoginPage(page);

    // Form exists and points to POST /login
    const form = page.locator('form[action="/login"][method="POST"]');
    await expect(form).toBeVisible();

    // Username field
    const usernameInput = page.locator('#username');
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveAttribute('name', 'username');
    await expect(usernameInput).toHaveAttribute('type', 'text');
    await expect(usernameInput).toHaveAttribute('placeholder', 'admin');
    await expect(usernameInput).toHaveAttribute('required', '');

    // Username label
    const usernameLabel = page.locator('label[for="username"]');
    await expect(usernameLabel).toHaveText('Username');

    // Password field
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('name', 'password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('required', '');

    // Password label
    const passwordLabel = page.locator('label[for="password"]');
    await expect(passwordLabel).toHaveText('Password');

    // Submit button
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toHaveText('Login');

    // "Forgot your password?" link
    await expect(page.locator('a:has-text("Forgot your password?")')).toBeVisible();

    // "Sign up" link
    await expect(page.locator('a:has-text("Sign up")')).toBeVisible();

    // No error message on first load
    const errorBanner = page.locator('.bg-destructive\\/15');
    await expect(errorBanner).toHaveCount(0);
  });
});

test.describe('Login – Invalid Credentials', () => {
  test('should show error for wrong username', async ({ page }) => {
    await goToLoginPage(page);

    await page.locator('#username').fill('nonexistent_user_xyz');
    await page.locator('#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // Should stay on login page and display the error banner
    await expect(page).toHaveURL(`${BASE_URL}/login`);
    const errorBanner = page.locator('.bg-destructive\\/15');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toHaveText('Username atau password salah!');
  });

  test('should show error for correct username but wrong password', async ({ page }) => {
    await goToLoginPage(page);

    await page.locator('#username').fill(ADMIN_USER.username);
    await page.locator('#password').fill('absolutely_wrong_password');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(`${BASE_URL}/login`);
    const errorBanner = page.locator('.bg-destructive\\/15');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toHaveText('Username atau password salah!');
  });
});

test.describe('Login – HTML5 Validation (Empty Fields)', () => {
  test('should not submit when username is empty', async ({ page }) => {
    await goToLoginPage(page);

    // Leave username empty, fill password
    await page.locator('#password').fill('somepassword');
    await page.locator('button[type="submit"]').click();

    // Browser should block submission (HTML5 required). URL stays the same.
    await expect(page).toHaveURL(`${BASE_URL}/login`);

    // Verify the username input triggers validity error
    const isInvalid = await page.locator('#username').evaluate(
      (el) => !el.checkValidity()
    );
    expect(isInvalid).toBe(true);
  });

  test('should not submit when password is empty', async ({ page }) => {
    await goToLoginPage(page);

    // Fill username, leave password empty
    await page.locator('#username').fill(ADMIN_USER.username);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(`${BASE_URL}/login`);

    const isInvalid = await page.locator('#password').evaluate(
      (el) => !el.checkValidity()
    );
    expect(isInvalid).toBe(true);
  });
});

test.describe('Login – Successful Admin Login', () => {
  test('should redirect admin to /dashboard and display dashboard content', async ({ page }) => {
    await goToLoginPage(page);

    await page.locator('#username').fill(ADMIN_USER.username);
    await page.locator('#password').fill(ADMIN_USER.password);
    await page.locator('button[type="submit"]').click();

    // Admin roles redirect to /dashboard
    await page.waitForURL(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`);

    // Dashboard heading
    await expect(page.locator('h2:has-text("Dashboard")')).toBeVisible();

    // Welcome message includes the username
    await expect(
      page.locator(`p:has-text("Selamat datang, ${ADMIN_USER.username}")`)
    ).toBeVisible();

    // Stat cards are rendered
    await expect(page.locator('text=Total Pegawai')).toBeVisible();
    await expect(page.locator('text=Total Jabatan')).toBeVisible();
    await expect(page.locator('text=Jabatan Kosong')).toBeVisible();

    // Sidebar is present with navigation links
    await expect(page.locator('aside h1:has-text("HR System")')).toBeVisible();
    await expect(page.locator('a[href="/dashboard"]')).toBeVisible();
    await expect(page.locator('a[href="/jabatan/struktur"]')).toBeVisible();
    await expect(page.locator('a[href="/jabatan/penempatan"]')).toBeVisible();

    // Logout link is present
    await expect(page.locator('a[href="/logout"]')).toBeVisible();
  });
});

test.describe('Login – Successful Admin Kepegawaian Login', () => {
  test('should redirect admin_kepegawaian to /dashboard and display dashboard content', async ({ page }) => {
    await goToLoginPage(page);

    await page.locator('#username').fill(ADMIN_KEPEGAWAIAN_USER.username);
    await page.locator('#password').fill(ADMIN_KEPEGAWAIAN_USER.password);
    await page.locator('button[type="submit"]').click();

    // Admin_kepegawaian roles also redirect to /dashboard
    await page.waitForURL(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`);

    // Dashboard heading
    await expect(page.locator('h2:has-text("Dashboard")')).toBeVisible();

    // Welcome message includes the username
    await expect(
      page.locator(`p:has-text("Selamat datang, ${ADMIN_KEPEGAWAIAN_USER.username}")`)
    ).toBeVisible();

    // Stat cards are rendered
    await expect(page.locator('text=Total Pegawai')).toBeVisible();
    await expect(page.locator('text=Total Jabatan')).toBeVisible();
    await expect(page.locator('text=Jabatan Kosong')).toBeVisible();

    // Sidebar is present with navigation links
    await expect(page.locator('aside h1:has-text("HR System")')).toBeVisible();
    await expect(page.locator('a[href="/dashboard"]')).toBeVisible();
    await expect(page.locator('a[href="/jabatan/struktur"]')).toBeVisible();
    await expect(page.locator('a[href="/jabatan/penempatan"]')).toBeVisible();

    // Logout link is present
    await expect(page.locator('a[href="/logout"]')).toBeVisible();
  });
});

test.describe('Login – Already Authenticated Redirect', () => {
  test('admin visiting /login when already logged in should redirect to /dashboard', async ({ page }) => {
    // First, log in as admin
    await goToLoginPage(page);
    await page.locator('#username').fill(ADMIN_USER.username);
    await page.locator('#password').fill(ADMIN_USER.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`${BASE_URL}/dashboard`);

    // Now try to visit /login again
    await page.goto(`${BASE_URL}/login`);

    // Should be bounced back to /dashboard (not shown the login form)
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`);
  });
});

test.describe('Logout Flow', () => {
  test('should destroy session and redirect to /login', async ({ page }) => {
    // Log in first
    await goToLoginPage(page);
    await page.locator('#username').fill(ADMIN_USER.username);
    await page.locator('#password').fill(ADMIN_USER.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`${BASE_URL}/dashboard`);

    // Click the logout link in the sidebar
    await page.locator('a[href="/logout"]').click();

    // Should redirect to login page
    await page.waitForURL(`${BASE_URL}/login`);
    await expect(page).toHaveURL(`${BASE_URL}/login`);
    await expect(page.locator('h1')).toHaveText('Welcome back');

    // After logout, accessing a protected page should bounce back to /login
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });
});

test.describe('Auth Guard – Unauthenticated Access', () => {
  test('visiting /dashboard without login should redirect to /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });

  test('visiting / should redirect to /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });
});