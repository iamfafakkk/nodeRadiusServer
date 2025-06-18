const RadiusUserModel = require('../models/RadiusUserModel');

class RadiusUserController {
  // Halaman manajemen RADIUS users
  async radiusUsersPage(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const search = req.query.search || '';
      
      let result;
      if (search) {
        result = await RadiusUserModel.searchUsers(search, page, 10);
      } else {
        result = await RadiusUserModel.getAllUsers(page, 10);
      }
      
      res.render('radius-users', {
        title: 'RADIUS Users',
        user: req.session.user,
        users: result.users,
        pagination: {
          current: result.page,
          total: result.totalPages,
          hasNext: result.page < result.totalPages,
          hasPrev: result.page > 1
        },
        search,
        error: req.flash('error'),
        success: req.flash('success'),
        currentPage: 'radius-users'
      });
    } catch (error) {
      console.error('Error rendering RADIUS users page:', error);
      req.flash('error', 'Terjadi kesalahan saat memuat data users');
      res.redirect('/dashboard');
    }
  }

  // Halaman tambah RADIUS user
  async addRadiusUserPage(req, res) {
    try {
      const groups = await RadiusUserModel.getUserGroups();
      
      res.render('add-radius-user', {
        title: 'Tambah RADIUS User',
        user: req.session.user,
        groups,
        error: req.flash('error'),
        success: req.flash('success'),
        currentPage: 'radius-users'
      });
    } catch (error) {
      console.error('Error rendering add RADIUS user page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  // Proses tambah RADIUS user
  async addRadiusUser(req, res) {
    try {
      const { username, password, confirmPassword, groupname } = req.body;

      // Validasi input
      if (!username || !password || !confirmPassword) {
        req.flash('error', 'Username dan password harus diisi');
        return res.redirect('/radius-users/add');
      }

      if (password !== confirmPassword) {
        req.flash('error', 'Password dan konfirmasi password tidak cocok');
        return res.redirect('/radius-users/add');
      }

      if (password.length < 4) {
        req.flash('error', 'Password minimal 4 karakter');
        return res.redirect('/radius-users/add');
      }

      // Cek apakah username sudah ada
      const userExists = await RadiusUserModel.userExists(username);
      if (userExists) {
        req.flash('error', 'Username sudah digunakan');
        return res.redirect('/radius-users/add');
      }

      // Buat user baru
      const userData = {
        username,
        password,
        groupname: groupname || 'default'
      };

      await RadiusUserModel.createUser(userData);

      req.flash('success', 'RADIUS user berhasil ditambahkan');
      res.redirect('/radius-users');
    } catch (error) {
      console.error('Error adding RADIUS user:', error);
      req.flash('error', 'Terjadi kesalahan saat menambahkan user');
      res.redirect('/radius-users/add');
    }
  }

  // Halaman edit RADIUS user
  async editRadiusUserPage(req, res) {
    try {
      const username = req.params.username;
      const userData = await RadiusUserModel.getUserByUsername(username);
      const groups = await RadiusUserModel.getUserGroups();
      
      if (!userData || userData.length === 0) {
        req.flash('error', 'User tidak ditemukan');
        return res.redirect('/radius-users');
      }

      // Extract password from radcheck data
      const passwordEntry = userData.find(entry => entry.attribute === 'Cleartext-Password');
      
      res.render('edit-radius-user', {
        title: 'Edit RADIUS User',
        user: req.session.user,
        radiusUser: {
          username,
          password: passwordEntry ? passwordEntry.value : ''
        },
        groups,
        error: req.flash('error'),
        success: req.flash('success'),
        currentPage: 'radius-users'
      });
    } catch (error) {
      console.error('Error rendering edit RADIUS user page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  // Proses edit RADIUS user
  async editRadiusUser(req, res) {
    try {
      const username = req.params.username;
      const { password, confirmPassword } = req.body;

      // Validasi input jika password diubah
      if (password) {
        if (password !== confirmPassword) {
          req.flash('error', 'Password dan konfirmasi password tidak cocok');
          return res.redirect(`/radius-users/${username}/edit`);
        }

        if (password.length < 4) {
          req.flash('error', 'Password minimal 4 karakter');
          return res.redirect(`/radius-users/${username}/edit`);
        }

        // Update password
        await RadiusUserModel.updateUser(username, { password });
      }

      req.flash('success', 'RADIUS user berhasil diperbarui');
      res.redirect('/radius-users');
    } catch (error) {
      console.error('Error updating RADIUS user:', error);
      req.flash('error', 'Terjadi kesalahan saat memperbarui user');
      res.redirect(`/radius-users/${req.params.username}/edit`);
    }
  }

  // Hapus RADIUS user
  async deleteRadiusUser(req, res) {
    try {
      const username = req.params.username;
      
      const deleted = await RadiusUserModel.deleteUser(username);
      if (deleted) {
        req.flash('success', 'RADIUS user berhasil dihapus');
      } else {
        req.flash('error', 'User tidak ditemukan');
      }
      
      res.redirect('/radius-users');
    } catch (error) {
      console.error('Error deleting RADIUS user:', error);
      req.flash('error', 'Terjadi kesalahan saat menghapus user');
      res.redirect('/radius-users');
    }
  }
}

module.exports = new RadiusUserController();
