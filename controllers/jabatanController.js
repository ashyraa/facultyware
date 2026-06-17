const db = require('../lib/db');

const getPermissions = (req) => req.session.permissions || [];

// Menampilkan daftar jabatan (Tabel) + Data Bagan (Hierarki) dalam satu halaman
const index = async (req, res, next) => {
    try {
        // --- 1. Logika untuk Tabel ---
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const offset = (page - 1) * limit;
        const searchWildcard = `%${search}%`;

        const [countRows] = await db.query(
            "SELECT COUNT(*) as total FROM structural_position_histories sph JOIN employees e ON sph.employee_id = e.id JOIN structural_positions sp ON sph.structural_position_id = sp.id WHERE sph.end_date IS NULL AND (e.name LIKE ? OR sp.title LIKE ?)",
            [searchWildcard, searchWildcard]
        );
        
        const totalPages = Math.ceil(countRows[0].total / limit);

        const [jabatanAktif] = await db.query(
            "SELECT sph.id AS history_id, e.id AS employee_id, e.name AS employee_name, sp.title AS position_title, ou.name AS unit_name, sph.start_date FROM structural_position_histories sph JOIN employees e ON sph.employee_id = e.id JOIN structural_positions sp ON sph.structural_position_id = sp.id JOIN organization_units ou ON sp.organization_unit_id = ou.id WHERE sph.end_date IS NULL AND (e.name LIKE ? OR sp.title LIKE ?) ORDER BY sph.start_date DESC LIMIT ? OFFSET ?",
            [searchWildcard, searchWildcard, limit, offset]
        );

        // --- 2. Logika untuk Bagan (Hierarki) ---
        const [dataBagan] = await db.query(`
            SELECT sp.id, sp.title, IFNULL(sp.parent_id, '') AS parent_id, e.name AS employee_name
            FROM structural_positions sp
            LEFT JOIN structural_position_histories sph ON sp.id = sph.structural_position_id AND sph.end_date IS NULL
            LEFT JOIN employees e ON sph.employee_id = e.id
            ORDER BY sp.parent_id ASC, sp.id ASC
        `);

        // --- 3. Render ke View ---
        res.render('jabatan/index', {
            // Ini bagian yang bikin judulnya otomatis berubah ngikutin URL!
            title: req.originalUrl && req.originalUrl.includes('penempatan') ? 'Penentuan Jabatan' : 'Struktur Pegawai',
            user: req.session.username,
            permissions: getPermissions(req),
            data: jabatanAktif,
            dataBaganJson: JSON.stringify(dataBagan || []),
            search,
            currentPage: page,
            totalPages
        });
    } catch (err) { next(err); }
};

const createPage = async (req, res, next) => {
    if (!getPermissions(req).includes('tentukan_jabatan')) return res.status(403).send("Akses Ditolak.");
    try {
        const [employees] = await db.query("SELECT id, name FROM employees ORDER BY name ASC");
        const [positions] = await db.query("SELECT sp.id, sp.title, ou.name as unit_name FROM structural_positions sp JOIN organization_units ou ON sp.organization_unit_id = ou.id ORDER BY sp.title ASC");
        res.render('jabatan/create', { title: 'Penempatan Jabatan Baru', user: req.session.username, permissions: getPermissions(req), employees, positions, error: null, oldData: {} });
    } catch (err) { next(err); }
};

const store = async (req, res, next) => {
    if (!getPermissions(req).includes('tentukan_jabatan')) return res.status(403).send("Akses Ditolak!");
    const { employee_id, structural_position_id, start_date } = req.body;
    try {
        if (!employee_id || !structural_position_id || !start_date) {
            const [employees] = await db.query("SELECT id, name FROM employees ORDER BY name ASC");
            const [positions] = await db.query("SELECT sp.id, sp.title, ou.name as unit_name FROM structural_positions sp JOIN organization_units ou ON sp.organization_unit_id = ou.id ORDER BY sp.title ASC");
            return res.render('jabatan/create', { title: 'Penempatan Jabatan Baru', user: req.session.username, permissions: getPermissions(req), employees, positions, error: 'Semua kolom wajib diisi!', oldData: req.body });
        }
        await db.query("UPDATE structural_position_histories SET end_date = ? WHERE employee_id = ? AND end_date IS NULL", [start_date, employee_id]);
        await db.query("INSERT INTO structural_position_histories (employee_id, structural_position_id, start_date) VALUES (?, ?, ?)", [employee_id, structural_position_id, start_date]);
        
        // Balikin ke halaman penempatan setelah sukses simpan
        res.redirect('/penempatan');
    } catch (err) { next(err); }
};

const history = async (req, res, next) => {
    if (!getPermissions(req).includes('view_history')) return res.status(403).send("Akses Ditolak.");
    try {
        const [employeeRows] = await db.query("SELECT name FROM employees WHERE id = ?", [req.params.employee_id]);
        if (!employeeRows.length) return res.status(404).send("Pegawai tidak ditemukan");
        const [historyRows] = await db.query("SELECT sph.id, sp.title AS position_title, ou.name AS unit_name, sph.start_date, sph.end_date FROM structural_position_histories sph JOIN structural_positions sp ON sph.structural_position_id = sp.id JOIN organization_units ou ON sp.organization_unit_id = ou.id WHERE sph.employee_id = ? ORDER BY sph.start_date DESC", [req.params.employee_id]);
        res.render('jabatan/history', { title: 'Riwayat Jabatan', user: req.session.username, permissions: getPermissions(req), employeeName: employeeRows[0].name, historyData: historyRows });
    } catch (err) { next(err); }
};

const apiGetAll = async (req, res, next) => {
    try {
        const [rows] = await db.query("SELECT sph.id, e.name, sp.title FROM structural_position_histories sph JOIN employees e ON sph.employee_id = e.id JOIN structural_positions sp ON sph.structural_position_id = sp.id WHERE sph.end_date IS NULL");
        res.status(200).json({ status: 'success', data: rows });
    } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
};

const apiGetById = async (req, res, next) => {
    try {
        const [rows] = await db.query("SELECT * FROM structural_position_histories WHERE id = ?", [req.params.id]);
        res.status(200).json({ status: 'success', data: rows[0] || null });
    } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
};

const exportPdf = async (req, res, next) => {
    if (!getPermissions(req).includes('export_pdf')) return res.status(403).send("Akses Ditolak.");
    try {
        const [laporanData] = await db.query("SELECT e.name, sp.title, ou.name AS unit_name, sph.start_date FROM structural_position_histories sph JOIN employees e ON sph.employee_id = e.id JOIN structural_positions sp ON sph.structural_position_id = sp.id JOIN organization_units ou ON sp.organization_unit_id = ou.id WHERE sph.end_date IS NULL");
        res.render('jabatan/export-pdf', { title: 'Laporan', permissions: getPermissions(req), data: laporanData });
    } catch (err) { next(err); }
};

module.exports = { index, createPage, store, history, exportPdf, apiGetAll, apiGetById };