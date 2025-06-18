const AdminModel = require('../models/AdminModel');
const RadiusModel = require('../models/RadiusModel');

class AdminController {
  // Halaman setup admin pertama
  async setupPage(req, res) {
    try {
      res.render('setup', {
        title: 'Setup Admin Pertama',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      console.error('Error rendering setup page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  // Proses setup admin pertama
  async setupAdmin(req, res) {
    try {
      const { username, email, password, confirmPassword } = req.body;

      // Validasi input
      if (!username || !email || !password || !confirmPassword) {
        req.flash('error', 'Semua field harus diisi');
        return res.redirect('/setup');
      }

      if (password !== confirmPassword) {
        req.flash('error', 'Password dan konfirmasi password tidak cocok');
        return res.redirect('/setup');
      }

      if (password.length < 6) {
        req.flash('error', 'Password minimal 6 karakter');
        return res.redirect('/setup');
      }

      // Cek apakah username atau email sudah ada
      const existingUser = await AdminModel.findByUsername(username);
      const existingEmail = await AdminModel.findByEmail(email);

      if (existingUser) {
        req.flash('error', 'Username sudah digunakan');
        return res.redirect('/setup');
      }

      if (existingEmail) {
        req.flash('error', 'Email sudah digunakan');
        return res.redirect('/setup');
      }

      // Buat admin pertama (super admin)
      await AdminModel.createUser({
        username,
        email,
        password,
        is_super_admin: 1
      });

      req.flash('success', 'Admin berhasil dibuat. Silakan login.');
      res.redirect('/login');
    } catch (error) {
      console.error('Error setting up admin:', error);
      req.flash('error', 'Terjadi kesalahan saat membuat admin');
      res.redirect('/setup');
    }
  }

  // Halaman login
  async loginPage(req, res) {
    try {
      res.render('login', {
        title: 'Login Admin',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      console.error('Error rendering login page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  // Proses login
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        req.flash('error', 'Username dan password harus diisi');
        return res.redirect('/login');
      }

      // Cari user berdasarkan username
      const user = await AdminModel.findByUsername(username);
      if (!user) {
        req.flash('error', 'Username atau password salah');
        return res.redirect('/login');
      }

      // Validasi password
      const isValidPassword = await AdminModel.validatePassword(password, user.password);
      if (!isValidPassword) {
        req.flash('error', 'Username atau password salah');
        return res.redirect('/login');
      }

      // Simpan session
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        is_super_admin: user.is_super_admin
      };

      req.flash('success', 'Login berhasil');
      res.redirect('/dashboard');
    } catch (error) {
      console.error('Error during login:', error);
      req.flash('error', 'Terjadi kesalahan saat login');
      res.redirect('/login');
    }
  }

  // Logout
  async logout(req, res) {
    try {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
        res.redirect('/login');
      });
    } catch (error) {
      console.error('Error during logout:', error);
      res.redirect('/login');
    }
  }

  // Dashboard
  async dashboard(req, res) {
    try {
      // Ambil statistik
      const userCount = await AdminModel.countUsers();
      
      res.render('dashboard', {
        title: 'Dashboard Admin',
        user: req.session.user,
        stats: {
          userCount
        },
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      console.error('Error rendering dashboard:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  // Halaman manajemen user
  async usersPage(req, res) {
    try {
      const users = await AdminModel.getAllUsers();
      
      res.render('users', {
        title: 'Manajemen Users',
        user: req.session.user,
        users,
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      console.error('Error rendering users page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  // Halaman tambah user
  async addUserPage(req, res) {
    try {
      res.render('add-user', {
        title: 'Tambah User',
        user: req.session.user,
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      console.error('Error rendering add user page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  // Proses tambah user
  async addUser(req, res) {
    try {
      const { username, email, password, confirmPassword } = req.body;

      // Validasi input
      if (!username || !email || !password || !confirmPassword) {
        req.flash('error', 'Semua field harus diisi');
        return res.redirect('/users/add');
      }

      if (password !== confirmPassword) {
        req.flash('error', 'Password dan konfirmasi password tidak cocok');
        return res.redirect('/users/add');
      }

      if (password.length < 6) {
        req.flash('error', 'Password minimal 6 karakter');
        return res.redirect('/users/add');
      }

      // Cek apakah username atau email sudah ada
      const existingUser = await AdminModel.findByUsername(username);
      const existingEmail = await AdminModel.findByEmail(email);

      if (existingUser) {
        req.flash('error', 'Username sudah digunakan');
        return res.redirect('/users/add');
      }

      if (existingEmail) {
        req.flash('error', 'Email sudah digunakan');
        return res.redirect('/users/add');
      }

      // Buat user baru
      await AdminModel.createUser({
        username,
        email,
        password,
        is_super_admin: 0
      });

      req.flash('success', 'User berhasil ditambahkan');
      res.redirect('/users');
    } catch (error) {
      console.error('Error adding user:', error);
      req.flash('error', 'Terjadi kesalahan saat menambahkan user');
      res.redirect('/users/add');
    }
  }

  // Hapus user
  async deleteUser(req, res) {
    try {
      const userId = req.params.id;
      
      // Tidak bisa hapus diri sendiri
      if (parseInt(userId) === req.session.user.id) {
        req.flash('error', 'Anda tidak bisa menghapus akun sendiri');
        return res.redirect('/users');
      }

      const deleted = await AdminModel.deleteUser(userId);
      if (deleted) {
        req.flash('success', 'User berhasil dihapus');
      } else {
        req.flash('error', 'User tidak ditemukan');
      }
      
      res.redirect('/users');
    } catch (error) {
      console.error('Error deleting user:', error);
      req.flash('error', 'Terjadi kesalahan saat menghapus user');
      res.redirect('/users');
    }
  }

  // Halaman edit user
  async editUserPage(req, res) {
    try {
      const userId = req.params.id;
      const user = await AdminModel.findById(userId);
      
      if (!user) {
        req.flash('error', 'User tidak ditemukan');
        return res.redirect('/users');
      }

      res.render('edit-user', {
        title: 'Edit User',
        user: user,
        currentUser: req.session.user,
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      console.error('Error rendering edit user page:', error);
      req.flash('error', 'Terjadi kesalahan saat mengambil data user');
      res.redirect('/users');
    }
  }

  // Proses edit user
  async editUser(req, res) {
    try {
      const userId = req.params.id;
      const { username, email, fullname, role, password, confirm_password, is_active, description } = req.body;

      // Validasi input
      if (!username || !email) {
        req.flash('error', 'Username dan email harus diisi');
        return res.redirect(`/users/${userId}/edit`);
      }

      // Jika password diisi, validasi password
      if (password) {
        if (password !== confirm_password) {
          req.flash('error', 'Password dan konfirmasi password tidak cocok');
          return res.redirect(`/users/${userId}/edit`);
        }

        if (password.length < 6) {
          req.flash('error', 'Password minimal 6 karakter');
          return res.redirect(`/users/${userId}/edit`);
        }
      }

      // Cek apakah username atau email sudah digunakan oleh user lain
      const existingUser = await AdminModel.findByUsername(username);
      if (existingUser && existingUser.id !== parseInt(userId)) {
        req.flash('error', 'Username sudah digunakan oleh user lain');
        return res.redirect(`/users/${userId}/edit`);
      }

      const existingEmail = await AdminModel.findByEmail(email);
      if (existingEmail && existingEmail.id !== parseInt(userId)) {
        req.flash('error', 'Email sudah digunakan oleh user lain');
        return res.redirect(`/users/${userId}/edit`);
      }

      // Update user
      const updateData = {
        username,
        email,
        fullname,
        role,
        is_active: is_active ? 1 : 0,
        description
      };

      // Jika password diisi, tambahkan ke update data
      if (password) {
        updateData.password = password;
      }

      const updated = await AdminModel.updateUser(userId, updateData);
      if (updated) {
        req.flash('success', 'User berhasil diupdate');
      } else {
        req.flash('error', 'User tidak ditemukan');
      }
      
      res.redirect('/users');
    } catch (error) {
      console.error('Error updating user:', error);
      req.flash('error', 'Terjadi kesalahan saat mengupdate user');
      res.redirect(`/users/${req.params.id}/edit`);
    }
  }

  // Generate API Key
  async generateApiKey(req, res) {
    try {
      const userId = req.params.id;
      
      // Check if user exists
      const user = await AdminModel.findById(userId);
      if (!user) {
        req.flash('error', 'User tidak ditemukan');
        return res.redirect('/users');
      }

      // Generate API key
      const apiKey = await AdminModel.generateApiKey(userId);
      if (apiKey) {
        req.flash('success', `API Key berhasil dibuat: ${apiKey}`);
      } else {
        req.flash('error', 'Gagal membuat API Key');
      }
      
      res.redirect('/users');
    } catch (error) {
      console.error('Error generating API key:', error);
      req.flash('error', 'Terjadi kesalahan saat membuat API Key');
      res.redirect('/users');
    }
  }

  // Revoke API Key
  async revokeApiKey(req, res) {
    try {
      const userId = req.params.id;
      
      // Check if user exists
      const user = await AdminModel.findById(userId);
      if (!user) {
        req.flash('error', 'User tidak ditemukan');
        return res.redirect('/users');
      }

      // Revoke API key
      const revoked = await AdminModel.revokeApiKey(userId);
      if (revoked) {
        req.flash('success', 'API Key berhasil dihapus');
      } else {
        req.flash('error', 'Gagal menghapus API Key');
      }
      
      res.redirect('/users');
    } catch (error) {
      console.error('Error revoking API key:', error);
      req.flash('error', 'Terjadi kesalahan saat menghapus API Key');
      res.redirect('/users');
    }
  }
}

module.exports = new AdminController();
