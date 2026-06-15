// controllers/jabatanController.js
const db = require('../lib/db');

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
    
    const [jabatanAktif] = await db.query(dataQuery, [
      searchWildcard, 
      searchWildcard, 
      limit, 
      offset
    ]);

    res.render('jabatan/index', {
      title: 'Daftar Jabatan Aktif',
      user: req.session.username,
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
      employees: employees,
      positions: positions,
      error: null, 
      oldData: {}  
    });
  } catch (err) {
    next(err);
  }
};

// 3. Memproses input form penempatan jabatan + Validasi Server-side
const store = async (req, res, next) => {
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
        employees: employees,
        positions: positions,
        error: 'Semua kolom formulir wajib diisi!',
        oldData: req.body
      });
    }

    const updateOldPositionQuery = `
      UPDATE structural_position_histories 
      SET end_date = ? 
      WHERE employee_id = ? AND end_date IS NULL
    `;
    await db.query(updateOldPositionQuery, [start_date, employee_id]);

    const insertNewPositionQuery = `
      INSERT INTO structural_position_histories (employee_id, structural_position_id, start_date, end_date) 
      VALUES (?, ?, ?, NULL)
    `;
    await db.query(insertNewPositionQuery, [employee_id, structural_position_id, start_date]);

    res.redirect('/jabatan');

  } catch (err) {
    next(err);
  }
};

// 4. Menampilkan Log Riwayat Jabatan Pegawai
const history = async (req, res, next) => {
  const employeeId = req.params.employee_id;

  try {
    const [employeeRows] = await db.query("SELECT name FROM employees WHERE id = ?", [employeeId]);
    
    if (employeeRows.length === 0) {
      return res.status(404).send("Pegawai tidak ditemukan");
    }
    const employeeName = employeeRows[0].name;

    const historyQuery = `
      SELECT 
        sph.id,
        sp.title AS position_title,
        ou.name AS unit_name,
        sph.start_date,
        sph.end_date
      FROM structural_position_histories sph
      JOIN structural_positions sp ON sph.structural_position_id = sp.id
      JOIN organization_units ou ON sp.organization_unit_id = ou.id
      WHERE sph.employee_id = ?
      ORDER BY sph.start_date DESC
    `;
    const [historyRows] = await db.query(historyQuery, [employeeId]);

    res.render('jabatan/history', {
      title: `Riwayat Jabatan - ${employeeName}`,
      user: req.session.username,
      employeeName: employeeName,
      historyData: historyRows
    });

  } catch (err) {
    next(err);
  }
};

// 5. REST API: Mengambil semua data jabatan aktif
const apiGetAll = async (req, res, next) => {
  try {
    const query = `
      SELECT sph.id AS history_id, e.id AS employee_id, e.name AS employee_name,
             sp.title AS position_title, ou.name AS unit_name, sph.start_date
      FROM structural_position_histories sph
      JOIN employees e ON sph.employee_id = e.id
      JOIN structural_positions sp ON sph.structural_position_id = sp.id
      JOIN organization_units ou ON sp.organization_unit_id = ou.id
      WHERE sph.end_date IS NULL ORDER BY e.name ASC
    `;
    const [rows] = await db.query(query);
    res.status(200).json({ status: 'success', data: rows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// 6. REST API: Mengambil detail jabatan aktif berdasarkan ID histori
const apiGetById = async (req, res, next) => {
  const historyId = req.params.id;
  try {
    const query = `
      SELECT sph.id AS history_id, e.id AS employee_id, e.name AS employee_name,
             sp.title AS position_title, ou.name AS unit_name, sph.start_date
      FROM structural_position_histories sph
      JOIN employees e ON sph.employee_id = e.id
      JOIN structural_positions sp ON sph.structural_position_id = sp.id
      JOIN organization_units ou ON sp.organization_unit_id = ou.id
      WHERE sph.id = ?
    `;
    const [rows] = await db.query(query, [historyId]);
    if (rows.length === 0) return res.status(404).json({ status: 'fail', message: 'Tidak ditemukan' });
    res.status(200).json({ status: 'success', data: rows[0] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// =========================================================================
// TAHAP 7: IMPLEMENTASI EXPORT LAPORAN STRUKTUR JABATAN (PRINT TO PDF)
// =========================================================================
const exportPdf = async (req, res, next) => {
  try {
    // Ambil SEMUA data jabatan struktural aktif saat ini untuk laporan formal
    const query = `
      SELECT 
        e.name AS employee_name,
        sp.title AS position_title,
        ou.name AS unit_name,
        sph.start_date
      FROM structural_position_histories sph
      JOIN employees e ON sph.employee_id = e.id
      JOIN structural_positions sp ON sph.structural_position_id = sp.id
      JOIN organization_units ou ON sp.organization_unit_id = ou.id
      WHERE sph.end_date IS NULL
      ORDER BY ou.name ASC, sp.title ASC
    `;
    const [laporanData] = await db.query(query);

    // Render halaman cetak formal
    res.render('jabatan/export-pdf', {
      title: 'Laporan Struktur Jabatan Pegawai Aktif',
      data: laporanData
    });

  } catch (err) {
    next(err);
  }
};

module.exports = {
  index,
  createPage,
  store,
  history,
  exportPdf,
  apiGetAll,
  apiGetById
};