const db = require('../lib/db');

const getPermissions = (req) => req.session.permissions || [];

const index = async (req, res, next) => {
    try {
        
        const [pegawaiResult] = await db.query("SELECT COUNT(*) as total FROM employees");
        const totalPegawai = pegawaiResult[0].total;

        const [jabatanResult] = await db.query("SELECT COUNT(*) as total FROM structural_positions");
        const totalJabatan = jabatanResult[0].total;

        const [kosongResult] = await db.query(`
            SELECT COUNT(sp.id) as total 
            FROM structural_positions sp 
            LEFT JOIN structural_position_histories sph 
                ON sp.id = sph.structural_position_id AND sph.end_date IS NULL 
            WHERE sph.id IS NULL
        `);
        const jabatanKosong = kosongResult[0].total;

        const [mutasiResult] = await db.query(`
            SELECT COUNT(*) as total 
            FROM structural_position_histories 
            WHERE MONTH(start_date) = MONTH(CURRENT_DATE()) 
              AND YEAR(start_date) = YEAR(CURRENT_DATE())
        `);
        const mutasiBulanIni = mutasiResult[0].total;

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