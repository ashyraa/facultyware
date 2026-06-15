const express = require('express');
const router = express.Router();
const jabatanController = require('../controllers/jabatanController');
const { isAuthenticated } = require('../middlewares/auth');
// Pastikan kamu punya file middleware ini untuk cek akses (ACL)
const { checkPermission } = require('../middlewares/acl'); 

// ==========================================
// ROUTE HALAMAN WEB (EJS)
// ==========================================

// 1. Menampilkan daftar jabatan aktif (Bisa dilihat Admin & Admin Kepegawaian)
router.get('/', isAuthenticated, jabatanController.index);

// 2. Menampilkan form penempatan jabatan baru (Dibatasi: Cuma Admin Kepegawaian)
router.get('/create', isAuthenticated, checkPermission('tentukan_jabatan'), jabatanController.createPage);

// 3. Memproses data dari form penempatan jabatan (Dibatasi: Cuma Admin Kepegawaian)
router.post('/create', isAuthenticated, checkPermission('tentukan_jabatan'), jabatanController.store);

// 4. Menampilkan riwayat jabatan (Bisa dilihat Admin & Admin Kepegawaian)
router.get('/history/:employee_id', isAuthenticated, jabatanController.history);

// 5. Export data laporan struktur jabatan ke PDF (Admin saja)
router.get('/export-pdf', isAuthenticated, jabatanController.exportPdf);


// ==========================================
// ROUTE REST API (JSON)
// ==========================================

// 6. REST API: Ambil semua data jabatan aktif
router.get('/api', isAuthenticated, jabatanController.apiGetAll);

// 7. REST API: Ambil data detail jabatan aktif berdasarkan ID Histori
router.get('/api/:id', isAuthenticated, jabatanController.apiGetById);

module.exports = router;