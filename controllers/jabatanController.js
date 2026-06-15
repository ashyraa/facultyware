// controllers/jabatanController.js
const db = require('../lib/db');

// Helper untuk mengambil permissions dari session
const getPermissions = (req) => req.session.permissions || [];

// 1. Menampilkan daftar jabatan aktif dengan searching dan pagination
const index = async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 5; 
    const offset = (page - 1) * limit;

    const searchWildcard = `%${search}%`;

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM structural_position_histories sph
      JOIN employees e ON sph.employee_id = e.id
      JOIN structural_positions sp ON sph.structural_position_id = sp.id
      WHERE sph.end_date IS NULL AND (e.name LIKE ? OR sp.title LIKE ?)
    `;
    const [countRows] = await db.query(countQuery, [searchWildcard, searchWildcard]);
    const totalData = countRows[0].total;
    const totalPages = Math.ceil(totalData / limit);

    const dataQuery = `
      SELECT 
        sph.id AS history_id,
        e.id AS employee_id,
        e.name AS employee_name,
        sp.title AS position_title,
        ou.name AS unit_name,
        sph.start_date
      FROM structural_position_histories sph
      JOIN employees e ON sph.employee_id = e.id
      JOIN structural_positions sp ON sph.structural_position_id = sp.id
      JOIN organization_units ou ON sp.organization_unit_id = ou.id
      WHERE sph.end_date IS NULL AND (e.name LIKE ? OR sp.title LIKE ?)
      ORDER BY sph.start_date DESC
      LIMIT ? OFFSET ?
    `;
    
    const [jabatanAktif] = await db.query(dataQuery, [searchWildcard, searchWildcard, limit, offset]);

    res.render('jabatan/index', {
      title: 'Daftar Jabatan Aktif',
      user: req.session.username,
      permissions: getPermissions(req),
      data: jabatanAktif,
      search: search,
      currentPage: page,
      totalPages: totalPages
    });

  } catch (err) {
    next(err);
  }
};

// 2. Menampilkan form penempatan jabatan baru
const createPage = async (req, res, next) => {
  // BLOKIR JIKA BUKAN ADMIN KEPEGAWAIAN
  if (!getPermissions(req).includes('tentukan_jabatan')) {
      return res.status(403).send("Akses Ditolak: Kamu tidak memiliki izin untuk menempatkan jabatan.");
  }

  try {
    const [employees] = await db.query("SELECT id, name FROM employees ORDER BY name ASC");
    const [positions] = await db.query(`
      SELECT sp.id, sp.title, ou.name as unit_name 
      FROM structural_positions sp
      JOIN organization_units ou ON sp.organization_unit_id = ou.id
      ORDER BY sp.title ASC
    `);

    res.render('jabatan/create', {
      title: 'Penempatan Jabatan Baru',
      user: req.session.username,
      permissions: getPermissions(req),
      employees: employees,
      positions: positions,
      error: null, 
      oldData: {}  
    });
  } catch (err) {
    next(err);
  }
};

// 3. Memproses input form penempatan jabatan
const store = async (req, res, next) => {
  // BLOKIR JIKA BUKAN ADMIN KEPEGAWAIAN
  if (!getPermissions(req).includes('tentukan_jabatan')) {
      return res.status(403).send("Akses Ditolak: Kamu tidak memiliki izin untuk memproses data ini.");
  }

  const { employee_id, structural_position_id, start_date } = req.body;

  try {
    if (!employee_id || !structural_position_id || !start_date) {
      const [employees] = await db.query("SELECT id, name FROM employees ORDER BY name ASC");
      const [positions] = await db.query(`
        SELECT sp.id, sp.title, ou.name as unit_name FROM structural_positions sp 
        JOIN organization_units ou ON sp.organization_unit_id = ou.id ORDER BY sp.title ASC
      `);

      return res.render('jabatan/create', {
        title: 'Penempatan Jabatan Baru',
        user: req.session.username,
        permissions: getPermissions(req),
        employees: employees,
        positions: positions,
        error: 'Semua kolom formulir wajib diisi!',
        oldData: req.body
      });
    }

    await db.query("UPDATE structural_position_histories SET end_date = ? WHERE employee_id = ? AND end_date IS NULL", [start_date, employee_id]);
    await db.query("INSERT INTO structural_position_histories (employee_id, structural_position_id, start_date, end_date) VALUES (?, ?, ?, NULL)", [employee_id, structural_position_id, start_date]);

    res.redirect('/penempatan');
  } catch (err) {
    next(err);
  }
};

// 4. MENGAMBIL DATA HIERARKI UNTUK BAGAN STRUKTUR ORGANISASI
const strukturOrganisasi = async (req, res, next) => {
  try {
    const queryBagan = `
      SELECT 
        sp.id, 
        sp.title, 
        sp.parent_id, 
        e.name AS employee_name
      FROM structural_positions sp
      LEFT JOIN structural_position_histories sph 
        ON sp.id = sph.structural_position_id AND sph.end_date IS NULL
      LEFT JOIN employees e 
        ON sph.employee_id = e.id
      ORDER BY sp.parent_id ASC, sp.id ASC
    `;
    const [dataBagan] = await db.query(queryBagan);

    res.render('jabatan/struktur', {
      title: 'Struktur Organisasi',
      user: req.session.username,
      permissions: getPermissions(req),
      dataBaganJson: JSON.stringify(dataBagan) 
    });

  } catch (err) {
    next(err);
  }
};

// 5. Menampilkan Log Riwayat Jabatan Pegawai
const history = async (req, res, next) => {
  // BLOKIR JIKA BUKAN ADMIN KEPEGAWAIAN
  if (!getPermissions(req).includes('view_history')) {
      return res.status(403).send("Akses Ditolak: Hanya Admin Kepegawaian yang dapat melihat riwayat.");
  }

  const employeeId = req.params.employee_id;
  try {
    const [employeeRows] = await db.query("SELECT name FROM employees WHERE id = ?", [employeeId]);
    if (employeeRows.length === 0) return res.status(404).send("Pegawai tidak ditemukan");
    
    const [historyRows] = await db.query(`
      SELECT sph.id, sp.title AS position_title, ou.name AS unit_name, sph.start_date, sph.end_date
      FROM structural_position_histories sph
      JOIN structural_positions sp ON sph.structural_position_id = sp.id
      JOIN organization_units ou ON sp.organization_unit_id = ou.id
      WHERE sph.employee_id = ? ORDER BY sph.start_date DESC
    `, [employeeId]);

    res.render('jabatan/history', {
      title: 'Riwayat Jabatan',
      user: req.session.username,
      permissions: getPermissions(req),
      employeeName: employeeRows[0].name,
      historyData: historyRows
    });
  } catch (err) {
    next(err);
  }
};

// 6 & 7. API
const apiGetAll = async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT sph.id AS history_id, e.name AS employee_name, sp.title AS position_title FROM structural_position_histories sph JOIN employees e ON sph.employee_id = e.id JOIN structural_positions sp ON sph.structural_position_id = sp.id WHERE sph.end_date IS NULL`);
    res.status(200).json({ status: 'success', data: rows });
  } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
};

const apiGetById = async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM structural_position_histories WHERE id = ?`, [req.params.id]);
    res.status(200).json({ status: 'success', data: rows[0] });
  } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
};

// 8. Export PDF
const exportPdf = async (req, res, next) => {
  // BLOKIR JIKA BUKAN ADMIN
  if (!getPermissions(req).includes('export_pdf')) {
      return res.status(403).send("Akses Ditolak: Fitur Export PDF hanya untuk Admin.");
  }

  try {
    const [laporanData] = await db.query(`SELECT e.name AS employee_name, sp.title AS position_title, ou.name AS unit_name, sph.start_date FROM structural_position_histories sph JOIN employees e ON sph.employee_id = e.id JOIN structural_positions sp ON sph.structural_position_id = sp.id JOIN organization_units ou ON sp.organization_unit_id = ou.id WHERE sph.end_date IS NULL`);
    res.render('jabatan/export-pdf', {
      title: 'Laporan Struktur Jabatan',
      permissions: getPermissions(req),
      data: laporanData
    });
  } catch (err) { next(err); }
};

module.exports = { index, createPage, store, strukturOrganisasi, history, exportPdf, apiGetAll, apiGetById }; 