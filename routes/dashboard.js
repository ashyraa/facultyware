const express = require('express');
const router = express.Router();

// Panggil otak/controller yang sudah kita buat tadi
const dashboardController = require('../controllers/dashboardController');

// Pastikan hanya user yang sudah login yang bisa buka halaman ini
const { isAuthenticated } = require('../middlewares/auth');

/* GET dashboard page. */
router.get('/', isAuthenticated, dashboardController.index);

module.exports = router;