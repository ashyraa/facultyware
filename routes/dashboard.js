const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboardController');

const { isAuthenticated } = require('../middlewares/auth');

router.get('/', isAuthenticated, dashboardController.index);

module.exports = router;