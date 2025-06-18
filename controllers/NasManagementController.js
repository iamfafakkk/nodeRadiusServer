const NasModel = require('../models/NasModel');

class NasManagementController {
  // Halaman manajemen NAS
  async nasPage(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const search = req.query.search || '';
      
      let result;
      if (search) {
        result = await NasModel.searchNas(search, page, 10);
      } else {
        result = await NasModel.getAllNas(page, 10);
      }
      
      res.render('nas-management', {
        title: 'NAS Management',
        user: req.session.user,
        nasList: result.nas,
        pagination: {
          current: result.page,
          total: result.totalPages,
          hasNext: result.page < result.totalPages,
          hasPrev: result.page > 1
        },
        search,
        error: req.flash('error'),
        success: req.flash('success'),
        currentPage: 'nas'
      });
    } catch (error) {
      console.error('Error rendering NAS page:', error);
      req.flash('error', 'Terjadi kesalahan saat memuat data NAS');
      res.redirect('/dashboard');
    }
  }

  // Halaman tambah NAS
  async addNasPage(req, res) {
    try {
      const nasTypes = NasModel.getNasTypes();
      
      res.render('add-nas', {
        title: 'Tambah NAS',
        user: req.session.user,
        nasTypes,
        error: req.flash('error'),
        success: req.flash('success'),
        currentPage: 'nas'
      });
    } catch (error) {
      console.error('Error rendering add NAS page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  // Proses tambah NAS
  async addNas(req, res) {
    try {
      const { nasname, shortname, type, ports, secret, server, community, description } = req.body;

      // Validasi input
      if (!nasname || !secret) {
        req.flash('error', 'NAS Name dan Secret harus diisi');
        return res.redirect('/nas/add');
      }

      // Cek apakah nasname sudah ada
      const nasExists = await NasModel.nasNameExists(nasname);
      if (nasExists) {
        req.flash('error', 'NAS Name sudah digunakan');
        return res.redirect('/nas/add');
      }

      // Buat NAS baru
      const nasData = {
        nasname,
        shortname: shortname || nasname,
        type: type || 'other',
        ports: ports ? parseInt(ports) : null,
        secret,
        server,
        community,
        description: description || 'RADIUS Client'
      };

      await NasModel.createNas(nasData);

      req.flash('success', 'NAS berhasil ditambahkan');
      res.redirect('/nas');
    } catch (error) {
      console.error('Error adding NAS:', error);
      req.flash('error', 'Terjadi kesalahan saat menambahkan NAS');
      res.redirect('/nas/add');
    }
  }

  // Halaman edit NAS
  async editNasPage(req, res) {
    try {
      const nasId = req.params.id;
      const nasData = await NasModel.getNasById(nasId);
      const nasTypes = NasModel.getNasTypes();
      
      if (!nasData) {
        req.flash('error', 'NAS tidak ditemukan');
        return res.redirect('/nas');
      }

      res.render('edit-nas', {
        title: 'Edit NAS',
        user: req.session.user,
        nasData,
        nasTypes,
        error: req.flash('error'),
        success: req.flash('success'),
        currentPage: 'nas'
      });
    } catch (error) {
      console.error('Error rendering edit NAS page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  // Proses edit NAS
  async editNas(req, res) {
    try {
      const nasId = req.params.id;
      const { nasname, shortname, type, ports, secret, server, community, description } = req.body;

      // Validasi input
      if (!nasname || !secret) {
        req.flash('error', 'NAS Name dan Secret harus diisi');
        return res.redirect(`/nas/${nasId}/edit`);
      }

      // Cek apakah nasname sudah ada (kecuali untuk NAS yang sedang diedit)
      const nasExists = await NasModel.nasNameExists(nasname, nasId);
      if (nasExists) {
        req.flash('error', 'NAS Name sudah digunakan');
        return res.redirect(`/nas/${nasId}/edit`);
      }

      // Update NAS
      const nasData = {
        nasname,
        shortname: shortname || nasname,
        type: type || 'other',
        ports: ports ? parseInt(ports) : null,
        secret,
        server,
        community,
        description: description || 'RADIUS Client'
      };

      const updated = await NasModel.updateNas(nasId, nasData);
      if (updated) {
        req.flash('success', 'NAS berhasil diperbarui');
      } else {
        req.flash('error', 'NAS tidak ditemukan');
      }

      res.redirect('/nas');
    } catch (error) {
      console.error('Error updating NAS:', error);
      req.flash('error', 'Terjadi kesalahan saat memperbarui NAS');
      res.redirect(`/nas/${req.params.id}/edit`);
    }
  }

  // Hapus NAS
  async deleteNas(req, res) {
    try {
      const nasId = req.params.id;
      
      const deleted = await NasModel.deleteNas(nasId);
      if (deleted) {
        req.flash('success', 'NAS berhasil dihapus');
      } else {
        req.flash('error', 'NAS tidak ditemukan');
      }
      
      res.redirect('/nas');
    } catch (error) {
      console.error('Error deleting NAS:', error);
      req.flash('error', 'Terjadi kesalahan saat menghapus NAS');
      res.redirect('/nas');
    }
  }

  // API endpoint untuk NAS statistics
  async getNasStatisticsApi(req, res) {
    try {
      const stats = await NasModel.getNasStatistics();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting NAS statistics API:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil statistik NAS'
      });
    }
  }
}

module.exports = new NasManagementController();
