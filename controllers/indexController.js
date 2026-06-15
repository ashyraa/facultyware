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
  // Pengecekan kalau udah login, biar nggak bisa buka halaman login lagi
  if (req.session.userId) {
    if (req.session.role === 'admin') return res.redirect('/jabatan');
    
    // Admin kepegawaian sekarang juga diarahkan ke /jabatan untuk melihat struktur
    if (req.session.role === 'admin_kepegawaian') return res.redirect('/jabatan');
    
    return res.redirect("/home"); 
  }
  
  res.render("login", { 
      title: "Login", 
      error: null, 
      layout: false 
  });
};

// 2. Proses Login (ACL untuk 2 Aktor)
const login = async (req, res, next) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);

    // Jika username tidak ditemukan
    if (rows.length === 0) {
      return res.render("login", {
        title: "Login",
        error: "Invalid username or password",
        layout: false 
      });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    // Jika password salah
    if (!isMatch) {
      return res.render("login", {
        title: "Login",
        error: "Invalid username or password",
        layout: false 
      });
    }

    // Set session dasar
    req.session.userId = user.id;
    req.session.username = user.username;
    
    // Proteksi tambahan: pastikan format username huruf kecil dan tanpa spasi
    const targetUsername = user.username.trim().toLowerCase();

    // ===================================================================
    // IMPLEMENTASI ACL: PEMBAGIAN PERMISSIONS
    // ===================================================================
    if (targetUsername === 'admin') {
        req.session.role = 'admin'; 
        // Admin: Hanya bisa export PDF
        req.session.permissions = ['export_pdf']; 
        return res.redirect('/jabatan'); 

    } else if (targetUsername === 'admin_kepegawaian') {
        req.session.role = 'admin_kepegawaian'; 
        // Admin Kepegawaian: Bisa nambah/tempatkan jabatan & lihat history
        req.session.permissions = ['tentukan_jabatan', 'view_history']; 
        return res.redirect('/jabatan'); 

    } else {
        req.session.role = 'user'; 
        req.session.permissions = []; 
        return res.redirect('/home'); 
    }
    
  } catch (err) {
    next(err);
  }
};

// 3. Fungsi Logout
const logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
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