const { test, expect } = require('@playwright/test');

/*
 * ============================================================================
 * Facultyware – E2E Tests with ACL (Access Control List) Integration
 * ============================================================================
 *
 * ROLES & PERMISSIONS:
 * 1. Admin: 
 *    - CAN: Export PDF (Struktur & Penempatan)
 *    - CANNOT: Tempatkan Jabatan Baru, Lihat Riwayat, Lihat Mutasi Bulan Ini
 * 2. Admin Kepegawaian:
 *    - CAN: Tempatkan Jabatan Baru, Lihat Riwayat, Lihat Mutasi Bulan Ini
 *    - CANNOT: Export PDF
 * ============================================================================
 */

const BASE_URL = 'http://localhost:3000';
const ADMIN = { username: 'admin', password: 'admin123' };
const ADMIN_KEP = { username: 'admin_kepegawaian', password: 'admin123' };

// ─── Helper: Fungsi Login Otomatis ──────────────────────────────────────────
async function loginAs(page, credentials) {
  await page.goto(`${BASE_URL}/login`);
  await page.locator('#username').fill(credentials.username);
  await page.locator('#password').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${BASE_URL}/dashboard`);
}

// ═════════════════════════════════════════════════════════════════════════════
//  1. FITUR UMUM (Bisa diakses kedua role - Kita tes pakai Admin)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Fitur Umum (Shared Features)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN);
  });

  test('Dashboard - render basic stat cards', async ({ page }) => {
    await expect(page.locator('h2:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('p:has-text("Total Pegawai")')).toBeVisible();
    await expect(page.locator('p:has-text("Total Jabatan")')).toBeVisible();
    await expect(page.locator('p:has-text("Jabatan Kosong")')).toBeVisible();
  });

  test('Sidebar - render navigation links', async ({ page }) => {
    await expect(page.locator('a[href="/dashboard"]')).toBeVisible();
    await expect(page.locator('a[href="/jabatan/struktur"]')).toBeVisible();
    await expect(page.locator('a[href="/jabatan/penempatan"]')).toBeVisible();
    await expect(page.locator('a[href="/logout"]')).toBeVisible();
  });

  test('Struktur Pegawai - render org chart', async ({ page }) => {
    await page.goto(`${BASE_URL}/jabatan/struktur`);
    await expect(page.locator('h2:has-text("Struktur Pegawai")')).toBeVisible();

    // Wait for Google Charts to load
    await page.waitForFunction(() => {
      const el = document.getElementById('chart_div');
      return el && el.innerHTML.trim().length > 0;
    }, { timeout: 15000 });
  });

  test('Penempatan Jabatan - table, search, and pagination', async ({ page }) => {
    await page.goto(`${BASE_URL}/jabatan/penempatan`);
    await expect(page.locator('h2:has-text("Penentuan Jabatan")')).toBeVisible();

    // Search function
    const searchInput = page.locator('input[name="search"]');
    await searchInput.fill('DataPalsuXYZ');
    await page.locator('form[action="/jabatan/penempatan"] button[type="submit"]').click();
    await expect(page.locator('td:has-text("Tidak ada data.")')).toBeVisible();
  });

  test('Header & Logout', async ({ page }) => {
    await expect(page.locator('header.sticky')).toBeVisible();
    await page.locator('a[href="/logout"]').click();
    await page.waitForURL(`${BASE_URL}/login`);
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });

  test('REST API /jabatan/api returns success', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/jabatan/api`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('success');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
//  2. ACL - ADMIN SAJA (Bisa Export, TIDAK BISA Create/Riwayat/Mutasi)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('ACL - Role Admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN);
  });

  test('Admin TIDAK BISA melihat kartu Mutasi Bulan Ini', async ({ page }) => {
    await expect(page.locator('p:has-text("Mutasi Bulan Ini")')).toHaveCount(0);
  });

  test('Admin TIDAK BISA melihat tombol Tempatkan Jabatan Baru & Riwayat', async ({ page }) => {
    await page.goto(`${BASE_URL}/jabatan/penempatan`);
    await expect(page.locator('a[href="/jabatan/penempatan/create"]')).toHaveCount(0);
    await expect(page.locator('a:has-text("Riwayat")')).toHaveCount(0);
  });

  test('Admin BISA menggunakan fitur Ekspor PDF Struktur', async ({ page }) => {
    await page.goto(`${BASE_URL}/jabatan/struktur`);
    const exportBtn = page.locator('#btn-export');
    await expect(exportBtn).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/jabatan/export-pdf') && resp.request().method() === 'POST'),
      exportBtn.click(),
    ]);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');
  });

  test('Admin BISA menggunakan fitur Ekspor PDF Penempatan', async ({ page }) => {
    await page.goto(`${BASE_URL}/jabatan/penempatan`);
    const exportBtn = page.locator('#btn-export');
    await expect(exportBtn).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/jabatan/export-pdf') && resp.request().method() === 'POST'),
      exportBtn.click(),
    ]);
    expect(response.status()).toBe(200);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
//  3. ACL - ADMIN KEPEGAWAIAN (BISA Create/Riwayat/Mutasi, TIDAK BISA Export)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('ACL - Role Admin Kepegawaian', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_KEP);
  });

  test('Admin Kepegawaian BISA melihat kartu Mutasi Bulan Ini', async ({ page }) => {
    await expect(page.locator('p:has-text("Mutasi Bulan Ini")')).toBeVisible();
  });

  test('Admin Kepegawaian TIDAK BISA melihat tombol Ekspor PDF', async ({ page }) => {
    // Cek di tabel Penempatan
    await page.goto(`${BASE_URL}/jabatan/penempatan`);
    await expect(page.locator('#btn-export')).toHaveCount(0);

    // Cek di Org Chart Struktur
    await page.goto(`${BASE_URL}/jabatan/struktur`);
    await expect(page.locator('#btn-export')).toHaveCount(0);
  });

  test('Admin Kepegawaian BISA melihat dan akses tabel Riwayat', async ({ page }) => {
    await page.goto(`${BASE_URL}/jabatan/penempatan`);
    const riwayatLink = page.locator('a:has-text("Riwayat")').first();

    // Asumsikan ada data di tabel untuk di klik
    if (await riwayatLink.count() > 0) {
      await riwayatLink.click();
      await expect(page.locator('h2:has-text("Log Riwayat Jabatan Pegawai")')).toBeVisible();
      await expect(page.locator('th:has-text("Jabatan Struktural")')).toBeVisible();
      await expect(page.locator('a:has-text("Kembali ke Daftar")')).toBeVisible();
    }
  });

  test('Admin Kepegawaian BISA melihat tombol Tempatkan Jabatan Baru', async ({ page }) => {
    await page.goto(`${BASE_URL}/jabatan/penempatan`);
    const createLink = page.locator('a[href="/jabatan/penempatan/create"]');
    await expect(createLink).toBeVisible();

    // Navigasi ke form
    await createLink.click();
    await expect(page.locator('h2:has-text("Form Penempatan Jabatan Baru")')).toBeVisible();
  });

  test('Admin Kepegawaian BISA merender Form Create Penempatan dengan lengkap', async ({ page }) => {
    await page.goto(`${BASE_URL}/jabatan/penempatan/create`);

    // Cek keberadaan dropdown dan input form
    await expect(page.locator('select[name="employee_id"]')).toBeVisible();
    await expect(page.locator('select[name="structural_position_id"]')).toBeVisible();
    await expect(page.locator('input[name="start_date"]')).toBeVisible();

    // Cek tombol submit & batal
    await expect(page.locator('button[type="submit"]:has-text("Simpan Penempatan")')).toBeVisible();
    await expect(page.locator('a[href="/jabatan/penempatan"]:has-text("Batal")')).toBeVisible();
  });

  test('Admin Kepegawaian BISA melakukan form submission (Validasi / Sukses)', async ({ page }) => {
    await page.goto(`${BASE_URL}/jabatan/penempatan/create`);

    // Pilih data dropdown pertama yang tersedia
    const empSelect = page.locator('select[name="employee_id"]');
    const empOptions = empSelect.locator('option:not([value=""])');
    if (await empOptions.count() > 0) {
      await empSelect.selectOption(await empOptions.first().getAttribute('value'));
    }

    const posSelect = page.locator('select[name="structural_position_id"]');
    const posOptions = posSelect.locator('option:not([value=""])');
    if (await posOptions.count() > 0) {
      await posSelect.selectOption(await posOptions.first().getAttribute('value'));
    }

    // Isi tanggal hari ini
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[name="start_date"]').fill(today);

    // Submit form
    await page.locator('button[type="submit"]:has-text("Simpan Penempatan")').click();

    // Pastikan diarahkan balik ke daftar ATAU muncul error jika jabatan kepenuhan
    const currentUrl = page.url();
    const isRedirected = currentUrl.includes('/jabatan/penempatan') && !currentUrl.includes('/create');
    const hasError = await page.locator('.bg-red-50').count() > 0;

    expect(isRedirected || hasError).toBe(true);
  });
});