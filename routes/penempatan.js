var express = require('express');
var router = express.Router();

const jabatanController = require('../controllers/jabatanController');

router.get('/', jabatanController.penempatan); 

router.get('/create', jabatanController.createPage); 

router.post('/store', jabatanController.store); 

module.exports = router;