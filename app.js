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
var penempatanRouter = require('./routes/penempatan'); // <-- Tambahan rute penempatan

const { notFoundHandler, errorHandler } = require('./middlewares/error');

var app = express();

// 1. View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 2. Setup Layouts (Harus sebelum rute)
app.use(expressLayouts);
app.set('layout', 'layout'); 

// 3. Middlewares bawaan
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 4. Session configuration
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

app.use(session({
  key: 'session_cookie_name',
  secret: process.env.SESSION_SECRET || 'secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// 5. Routes (Layouts sekarang sudah siap membungkus ini)
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/jabatan', jabatanRouter);
app.use('/penempatan', penempatanRouter); // <-- Pintu masuk halaman penentuan jabatan

// 6. Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;