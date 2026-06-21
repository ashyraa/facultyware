const db = require('../lib/db');
const PDFDocument = require('pdfkit-table');

const getPermissions = (req) => req.session.permissions || [];

// 1. Menampilkan Bagan Hierarki
const struktur = async (req, res, next) => {
    try {
        const [dataBagan] = await db.query(`
            SELECT sp.id, sp.title, IFNULL(sp.parent_id, '') AS parent_id, e.name AS employee_name
            FROM structural_positions sp
            LEFT JOIN structural_position_histories sph ON sp.id = sph.structural_position_id AND sph.end_date IS NULL
            LEFT JOIN employees e ON sph.employee_id = e.id
            ORDER BY sp.parent_id ASC, sp.id ASC
        `);

        res.render('jabatan/struktur', {
            title: 'Struktur Pegawai',
            user: req.session.username,
            permissions: getPermissions(req),
            dataBaganJson: JSON.stringify(dataBagan || [])
        });
    } catch (err) { next(err); }
};

// 2. Menampilkan Tabel Penempatan
const penempatan = async (req, res, next) => {
    try {
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const offset = (page - 1) * limit;
        const searchWildcard = `%${search}%`;

        const [countRows] = await db.query(
            "SELECT COUNT(e.id) as total FROM employees e LEFT JOIN structural_position_histories sph ON e.id = sph.employee_id AND sph.end_date IS NULL LEFT JOIN structural_positions sp ON sph.structural_position_id = sp.id WHERE (e.name LIKE ? OR sp.title LIKE ?)",
            [searchWildcard, searchWildcard]
        );
        
        const totalPages = Math.ceil(countRows[0].total / limit);

        const [jabatanAktif] = await db.query(
            "SELECT sph.id AS history_id, e.id AS employee_id, e.name AS employee_name, sp.title AS position_title, ou.name AS unit_name, sph.start_date FROM employees e LEFT JOIN structural_position_histories sph ON e.id = sph.employee_id AND sph.end_date IS NULL LEFT JOIN structural_positions sp ON sph.structural_position_id = sp.id LEFT JOIN organization_units ou ON sp.organization_unit_id = ou.id WHERE (e.name LIKE ? OR sp.title LIKE ?) ORDER BY e.name ASC LIMIT ? OFFSET ?",
            [searchWildcard, searchWildcard, limit, offset]
        );

        res.render('jabatan/penempatan', {
            title: 'Penentuan Jabatan',
            user: req.session.username,
            permissions: getPermissions(req),
            data: jabatanAktif,
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

// 3. STORE DENGAN ALGORITMA CEK KETERSEDIAAN
const store = async (req, res, next) => {
    if (!getPermissions(req).includes('tentukan_jabatan')) return res.status(403).send("Akses Ditolak!");
    const { employee_id, structural_position_id, start_date } = req.body;
    
    try {
        if (!employee_id || !structural_position_id || !start_date) {
            const [employees] = await db.query("SELECT id, name FROM employees ORDER BY name ASC");
            const [positions] = await db.query("SELECT sp.id, sp.title, ou.name as unit_name FROM structural_positions sp JOIN organization_units ou ON sp.organization_unit_id = ou.id ORDER BY sp.title ASC");
            return res.render('jabatan/create', { title: 'Penempatan Jabatan Baru', user: req.session.username, permissions: getPermissions(req), employees, positions, error: 'Semua kolom wajib diisi!', oldData: req.body });
        }

        // --- ALGORITMA CEK KETERSEDIAAN ---
        // Cek apakah posisi ini sedang diisi oleh pegawai lain
        const [isOccupied] = await db.query(
            "SELECT id FROM structural_position_histories WHERE structural_position_id = ? AND end_date IS NULL", 
            [structural_position_id]
        );

        if (isOccupied.length > 0) {
            const [employees] = await db.query("SELECT id, name FROM employees ORDER BY name ASC");
            const [positions] = await db.query("SELECT sp.id, sp.title, ou.name as unit_name FROM structural_positions sp JOIN organization_units ou ON sp.organization_unit_id = ou.id ORDER BY sp.title ASC");
            return res.render('jabatan/create', { 
                title: 'Penempatan Jabatan Baru', 
                user: req.session.username, 
                permissions: getPermissions(req), 
                employees, 
                positions, 
                error: 'Gagal: Jabatan ini sudah ada yang menjabat. Harap lakukan mutasi atau lepaskan jabatan lama terlebih dahulu.', 
                oldData: req.body 
            });
        }
        // --- AKHIR ALGORITMA ---

        // Proses jika jabatan tersedia
        await db.query("UPDATE structural_position_histories SET end_date = ? WHERE employee_id = ? AND end_date IS NULL", [start_date, employee_id]);
        await db.query("INSERT INTO structural_position_histories (employee_id, structural_position_id, start_date) VALUES (?, ?, ?)", [employee_id, structural_position_id, start_date]);
        res.redirect('/jabatan/penempatan');
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

const exportPdf = async (req, res, next) => {
    try {
        if (!getPermissions(req).includes('export_pdf')) {
            return res.status(403).json({ error: "Akses Ditolak." });
        }
        const { type, image } = req.body;
        if (!type) throw new Error("Tipe laporan tidak ditentukan");

        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan_${type}.pdf`);
        doc.pipe(res);

        if (type === 'penempatan') {
            const [data] = await db.query(`SELECT e.name, sp.title, ou.name as unit FROM structural_position_histories sph JOIN employees e ON e.id = sph.employee_id JOIN structural_positions sp ON sp.id = sph.structural_position_id JOIN organization_units ou ON ou.id = sp.organization_unit_id WHERE sph.end_date IS NULL`);
            doc.fontSize(18).text("Laporan Penempatan Jabatan", { align: 'center' });
            doc.moveDown();
            const table = {
                headers: ["No", "Nama", "Jabatan", "Unit"],
                rows: data.map((item, i) => [ (i+1).toString(), item.name, item.title, item.unit ])
            };
            await doc.table(table, { prepareRow: () => doc.font("Helvetica").fontSize(10) });
        } else if (type === 'struktur' && image) {
            const buffer = Buffer.from(image.replace(/^data:image\/png;base64,/, ""), 'base64');
            doc.image(buffer, { fit: [500, 400], align: 'center' });
        }
        doc.end();
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
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

module.exports = { struktur, penempatan, createPage, store, history, exportPdf, apiGetAll, apiGetById };