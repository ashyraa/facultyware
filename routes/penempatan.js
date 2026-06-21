var express = require('express');
var router = express.Router();

const jabatanController = require('../controllers/jabatanController');

// Ubah 'index' menjadi 'penempatan'
router.get('/', jabatanController.penempatan); 

// Ubah 'createPage' menjadi 'createPage' (ini sudah benar)
router.get('/create', jabatanController.createPage); 

// Ubah 'store' menjadi 'store' (ini sudah benar)
router.post('/store', jabatanController.store); 

module.exports = router;