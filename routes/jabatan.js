const express = require('express');
const router = express.Router();
const jabatanController = require('../controllers/jabatanController');
const { isAuthenticated } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/acl'); 

// ==========================================
// ROUTE HALAMAN WEB (EJS)
// ==========================================

// 1. Struktur Pegawai (Bagan Hierarki) - Akses: /jabatan/struktur
router.get('/struktur', isAuthenticated, jabatanController.struktur);

// 2. Penempatan Jabatan (Tabel Data) - Akses: /jabatan/penempatan
router.get('/penempatan', isAuthenticated, jabatanController.penempatan);

// 3. Form penempatan jabatan baru - Akses: /jabatan/penempatan/create
router.get('/penempatan/create', isAuthenticated, checkPermission('tentukan_jabatan'), jabatanController.createPage);

// 4. Memproses data dari form penempatan jabatan - Akses: /jabatan/penempatan/create
router.post('/penempatan/create', isAuthenticated, checkPermission('tentukan_jabatan'), jabatanController.store);

// 5. Menampilkan riwayat jabatan - Akses: /jabatan/history/:employee_id
router.get('/history/:employee_id', isAuthenticated, checkPermission('view_history'), jabatanController.history);

// 6. Export data laporan (Admin saja) - Akses: /jabatan/export-pdf
router.post('/export-pdf', isAuthenticated, checkPermission('export_pdf'), jabatanController.exportPdf);


// ==========================================
// ROUTE REST API (JSON)
// ==========================================

router.get('/api', isAuthenticated, jabatanController.apiGetAll);
router.get('/api/:id', isAuthenticated, jabatanController.apiGetById);

module.exports = router;