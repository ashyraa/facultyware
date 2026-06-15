var express = require('express');
var router = express.Router();

// Memanggil controller jabatan karena kita meminjam fungsi tabel dan form dari sana
const jabatanController = require('../controllers/jabatanController');

/* GET penempatan page (Menampilkan tabel daftar jabatan) */
router.get('/', jabatanController.index); 

/* GET form tambah penempatan (Menampilkan form input) */
router.get('/create', jabatanController.createPage); 

/* POST simpan data penempatan baru (Memproses data ke database) */
router.post('/store', jabatanController.store); 

module.exports = router;