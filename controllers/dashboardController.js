const db = require('../lib/db');

// Helper untuk mengambil permissions dari session
const getPermissions = (req) => req.session.permissions || [];

const index = async (req, res, next) => {
    try {
        // 1. Hitung Total Pegawai
        const [pegawaiResult] = await db.query("SELECT COUNT(*) as total FROM employees");
        const totalPegawai = pegawaiResult[0].total;

        // 2. Hitung Total Jabatan Struktural
        const [jabatanResult] = await db.query("SELECT COUNT(*) as total FROM structural_positions");
        const totalJabatan = jabatanResult[0].total;

        // 3. Hitung Jabatan Kosong
        // Logika: Cari posisi struktural yang TIDAK memiliki riwayat jabatan yang masih aktif (end_date IS NULL)
        const [kosongResult] = await db.query(`
            SELECT COUNT(sp.id) as total 
            FROM structural_positions sp 
            LEFT JOIN structural_position_histories sph 
                ON sp.id = sph.structural_position_id AND sph.end_date IS NULL 
            WHERE sph.id IS NULL
        `);
        const jabatanKosong = kosongResult[0].total;

        // 4. Hitung Mutasi/Penempatan Bulan Ini
        // Logika: Hitung riwayat yang tanggal mulainya ada di bulan dan tahun saat ini
        const [mutasiResult] = await db.query(`
            SELECT COUNT(*) as total 
            FROM structural_position_histories 
            WHERE MONTH(start_date) = MONTH(CURRENT_DATE()) 
              AND YEAR(start_date) = YEAR(CURRENT_DATE())
        `);
        const mutasiBulanIni = mutasiResult[0].total;

        // Render ke view dashboard/index dan kirim semua datanya
        res.render('dashboard/index', {
            title: 'Dashboard',
            user: req.session.username,
            permissions: getPermissions(req),
            stats: {
                totalPegawai,
                totalJabatan,
                jabatanKosong,
                mutasiBulanIni
            }
        });
    } catch (err) { 
        next(err); 
    }
};

module.exports = { index };