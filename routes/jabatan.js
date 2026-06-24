const express = require('express');
const router = express.Router();
const jabatanController = require('../controllers/jabatanController');
const { isAuthenticated } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/acl'); 


router.get('/struktur', isAuthenticated, jabatanController.struktur);

router.get('/penempatan', isAuthenticated, jabatanController.penempatan);

router.get('/penempatan/create', isAuthenticated, checkPermission('tentukan_jabatan'), jabatanController.createPage);

router.post('/penempatan/create', isAuthenticated, checkPermission('tentukan_jabatan'), jabatanController.store);

router.get('/history/:employee_id', isAuthenticated, checkPermission('view_history'), jabatanController.history);

router.post('/export-pdf', isAuthenticated, checkPermission('export_pdf'), jabatanController.exportPdf);


router.get('/api', isAuthenticated, jabatanController.apiGetAll);
router.get('/api/:id', isAuthenticated, jabatanController.apiGetById);

module.exports = router;