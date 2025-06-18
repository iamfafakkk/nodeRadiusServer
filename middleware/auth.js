const AdminModel = require('../models/AdminModel');

// Middleware untuk memastikan user sudah login
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  } else {
    req.flash('error', 'Silakan login terlebih dahulu');
    return res.redirect('/login');
  }
};

// Middleware untuk redirect jika sudah login
const redirectIfAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  } else {
    return next();
  }
};

// Middleware untuk mengecek apakah sudah ada admin user
const checkAdminExists = async (req, res, next) => {
  try {
    const userCount = await AdminModel.countUsers();
    if (userCount === 0) {
      // Jika belum ada admin, redirect ke setup page
      return res.redirect('/setup');
    }
    next();
  } catch (error) {
    console.error('Error checking admin exists:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Middleware untuk redirect jika sudah ada admin (untuk setup page)
const redirectIfAdminExists = async (req, res, next) => {
  try {
    const userCount = await AdminModel.countUsers();
    if (userCount > 0) {
      // Jika sudah ada admin, redirect ke login
      return res.redirect('/login');
    }
    next();
  } catch (error) {
    console.error('Error checking admin exists:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Middleware untuk mengecek apakah user adalah super admin
const requireSuperAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.is_super_admin) {
    return next();
  } else {
    req.flash('error', 'Akses ditolak. Anda bukan super admin.');
    return res.redirect('/dashboard');
  }
};

module.exports = {
  requireAuth,
  redirectIfAuth,
  checkAdminExists,
  redirectIfAdminExists,
  requireSuperAdmin
};
