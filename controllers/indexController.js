const bcrypt = require("bcryptjs");
const db = require("../lib/db");

const index = (req, res) => {
  res.redirect("/login"); 
};

const home = (req, res) => {
  res.render("home", { title: "Home", user: req.session.username });
};

// 1. Perbaikan Halaman Login
const loginPage = (req, res) => {
  if (req.session.userId) {
    if (req.session.role === 'admin' || req.session.role === 'admin_kepegawaian') {
        return res.redirect('/dashboard'); 
    }
    return res.redirect("/home"); 
  }
  
  res.render("login", { 
      title: "Login", 
      error: null, 
      layout: false 
  });
};

// 2. Proses Login (Dinamis membaca Database ACL dengan Filter Keamanan)
const login = async (req, res, next) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [username]);

    if (rows.length === 0) {
      return res.render("login", { title: "Login", error: "Username atau password salah!", layout: false });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.render("login", { title: "Login", error: "Username atau password salah!", layout: false });
    }

    // Cari nama Role user ini
    const [roleRows] = await db.query(`
        SELECT r.name 
        FROM roles r 
        JOIN user_has_roles uhr ON r.id = uhr.role_id 
        WHERE uhr.user_id = ?
    `, [user.id]);
    const roleName = roleRows.length > 0 ? roleRows[0].name : 'user';

    // Cari daftar Hak Akses (Permissions) user ini
    const [permRows] = await db.query(`
        SELECT p.name 
        FROM permissions p 
        JOIN role_has_permissions rhp ON p.id = rhp.permission_id 
        JOIN user_has_roles uhr ON rhp.role_id = uhr.role_id 
        WHERE uhr.user_id = ?
    `, [user.id]);
    
    let userPermissions = permRows.map(row => row.name);

    // ===================================================================
    // FILTER KEAMANAN PAKSA: Jika Admin, buang permission view_history
    // ===================================================================
    if (roleName === 'admin') {
        userPermissions = userPermissions.filter(p => p !== 'view_history');
    }

    // Simpan ke Session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = roleName;
    req.session.permissions = userPermissions; 
    
    if (roleName === 'admin' || roleName === 'admin_kepegawaian') {
        return res.redirect('/dashboard'); 
    } else {
        return res.redirect('/home'); 
    }
    
  } catch (err) {
    next(err);
  }
};

const logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.redirect("/login");
  });
};

module.exports = {
  index,
  home,
  loginPage,
  login,
  logout
};