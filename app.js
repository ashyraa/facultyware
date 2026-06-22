require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var expressLayouts = require('express-ejs-layouts');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var jabatanRouter = require('./routes/jabatan');
var dashboardRouter = require('./routes/dashboard');

const { notFoundHandler, errorHandler } = require('./middlewares/error');

var app = express();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Setup Layouts
app.use(expressLayouts);
app.set('layout', 'layout'); 

// Middlewares
app.use(logger('dev'));

// PENTING: Penambahan limit agar bisa menerima data gambar Base64 dari html2canvas
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT, // <--- INI PERBAIKANNYA (TAMBAH PORT)
  user: process.env.DB_USER,
  // PASTIKAN SAMA DENGAN DI RAILWAY (DB_PASSWORD atau DB_PASS)
  password: process.env.DB_PASSWORD || process.env.DB_PASS, 
  database: process.env.DB_NAME,
});

// ==== TAMBAHAN BARU UNTUK RAILWAY ====
app.set('trust proxy', 1);
// =====================================

app.use(session({
  key: 'session_cookie_name',
  secret: process.env.SESSION_SECRET || 'secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 1000 * 60 * 60 * 24,
    secure: process.env.NODE_ENV === 'production' // otomatis true kalau di railway
  }
}));

// Routes
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/jabatan', jabatanRouter);
app.use('/dashboard', dashboardRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;