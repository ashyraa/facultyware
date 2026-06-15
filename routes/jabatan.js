const express = require('express');
const router = express.Router();
const jabatanController = require('../controllers/jabatanController');
const { isAuthenticated } = require('../middlewares/auth');

// ==========================================
// ROUTE HALAMAN WEB (EJS)
// ==========================================

// 1. Menampilkan daftar jabatan aktif (dengan search & pagination)
router.get('/', isAuthenticated, jabatanController.index);

// 2. Menampilkan form penempatan jabatan baru
router.get('/create', isAuthenticated, jabatanController.createPage);

// 3. Memproses data dari form penempatan jabatan (Form Handling & Validasi)
router.post('/create', isAuthenticated, jabatanController.store);

// 4. Menampilkan riwayat jabatan berdasarkan ID Pegawai
router.get('/history/:employee_id', isAuthenticated, jabatanController.history);

// 5. Export data laporan struktur jabatan ke PDF
router.get('/export-pdf', isAuthenticated, jabatanController.exportPdf);


// ==========================================
// ROUTE REST API (JSON)
// ==========================================

// 6. REST API: Ambil semua data jabatan aktif
router.get('/api', isAuthenticated, jabatanController.apiGetAll);

// 7. REST API: Ambil data detail jabatan aktif berdasarkan ID Histori
router.get('/api/:id', isAuthenticated, jabatanController.apiGetById);

module.exports = router;