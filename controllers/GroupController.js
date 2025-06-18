const GroupModel = require('../models/GroupModel');

class GroupController {
  // Halaman manajemen groups
  async groupsPage(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const search = req.query.search || '';
      
      let result;
      if (search) {
        result = await GroupModel.searchGroups(search, page, 10);
      } else {
        result = await GroupModel.getAllGroups(page, 10);
      }
      
      res.render('groups', {
        title: 'Group Management',
        user: req.session.user,
        groups: result.groups,
        pagination: {
          current: result.page,
          total: result.totalPages,
          hasNext: result.page < result.totalPages,
          hasPrev: result.page > 1
        },
        search,
        error: req.flash('error'),
        success: req.flash('success'),
        currentPage: 'groups'
      });
    } catch (error) {
      console.error('Error rendering groups page:', error);
      req.flash('error', 'Terjadi kesalahan saat memuat data groups');
      res.redirect('/dashboard');
    }
  }

  // Halaman tambah group
  async addGroupPage(req, res) {
    try {
      const attributes = GroupModel.getAvailableAttributes();
      const templates = GroupModel.getGroupTemplates();
      
      res.render('add-group', {
        title: 'Tambah Group',
        user: req.session.user,
        attributes,
        templates,
        error: req.flash('error'),
        success: req.flash('success'),
        currentPage: 'groups'
      });
    } catch (error) {
      console.error('Error rendering add group page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  // Proses tambah group
  async addGroup(req, res) {
    try {
      const { groupname, template } = req.body;
      let { checkAttributes, replyAttributes } = req.body;

      // Validasi input
      if (!groupname) {
        req.flash('error', 'Group name harus diisi');
        return res.redirect('/groups/add');
      }

      // Cek apakah group sudah ada
      const groupExists = await GroupModel.groupExists(groupname);
      if (groupExists) {
        req.flash('error', 'Group name sudah digunakan');
        return res.redirect('/groups/add');
      }

      // Parse attributes jika dalam format string (dari form dinamis)
      if (typeof checkAttributes === 'string') {
        try {
          checkAttributes = JSON.parse(checkAttributes);
        } catch (e) {
          checkAttributes = [];
        }
      }

      if (typeof replyAttributes === 'string') {
        try {
          replyAttributes = JSON.parse(replyAttributes);
        } catch (e) {
          replyAttributes = [];
        }
      }

      // Jika menggunakan template, ambil dari template
      if (template && template !== 'custom') {
        const templates = GroupModel.getGroupTemplates();
        if (templates[template]) {
          checkAttributes = templates[template].checkAttributes;
          replyAttributes = templates[template].replyAttributes;
        }
      }

      // Buat group baru
      const groupData = {
        groupname,
        checkAttributes: checkAttributes || [],
        replyAttributes: replyAttributes || []
      };

      await GroupModel.createGroup(groupData);

      req.flash('success', 'Group berhasil ditambahkan');
      res.redirect('/groups');
    } catch (error) {
      console.error('Error adding group:', error);
      req.flash('error', 'Terjadi kesalahan saat menambahkan group');
      res.redirect('/groups/add');
    }
  }

  // Halaman detail group
  async groupDetailPage(req, res) {
    try {
      const groupname = req.params.groupname;
      const groupData = await GroupModel.getGroupByName(groupname);
      
      if (!groupData) {
        req.flash('error', 'Group tidak ditemukan');
        return res.redirect('/groups');
      }

      res.render('group-detail', {
        title: `Group - ${groupname}`,
        user: req.session.user,
        group: groupData,
        error: req.flash('error'),
        success: req.flash('success'),
        currentPage: 'groups'
      });
    } catch (error) {
      console.error('Error rendering group detail page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  // Halaman edit group
  async editGroupPage(req, res) {
    try {
      const groupname = req.params.groupname;
      const groupData = await GroupModel.getGroupByName(groupname);
      const attributes = GroupModel.getAvailableAttributes();
      
      if (!groupData) {
        req.flash('error', 'Group tidak ditemukan');
        return res.redirect('/groups');
      }

      res.render('edit-group', {
        title: `Edit Group - ${groupname}`,
        user: req.session.user,
        group: groupData,
        attributes,
        error: req.flash('error'),
        success: req.flash('success'),
        currentPage: 'groups'
      });
    } catch (error) {
      console.error('Error rendering edit group page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  // Proses edit group
  async editGroup(req, res) {
    try {
      const groupname = req.params.groupname;
      let { checkAttributes, replyAttributes } = req.body;

      // Parse attributes jika dalam format string
      if (typeof checkAttributes === 'string') {
        try {
          checkAttributes = JSON.parse(checkAttributes);
        } catch (e) {
          checkAttributes = [];
        }
      }

      if (typeof replyAttributes === 'string') {
        try {
          replyAttributes = JSON.parse(replyAttributes);
        } catch (e) {
          replyAttributes = [];
        }
      }

      // Update group
      const groupData = {
        checkAttributes: checkAttributes || [],
        replyAttributes: replyAttributes || []
      };

      const updated = await GroupModel.updateGroup(groupname, groupData);
      if (updated) {
        req.flash('success', 'Group berhasil diperbarui');
      } else {
        req.flash('error', 'Group tidak ditemukan');
      }

      res.redirect('/groups');
    } catch (error) {
      console.error('Error updating group:', error);
      req.flash('error', 'Terjadi kesalahan saat memperbarui group');
      res.redirect(`/groups/${req.params.groupname}/edit`);
    }
  }

  // Hapus group
  async deleteGroup(req, res) {
    try {
      const groupname = req.params.groupname;
      
      const deleted = await GroupModel.deleteGroup(groupname);
      if (deleted) {
        req.flash('success', 'Group berhasil dihapus');
      } else {
        req.flash('error', 'Group tidak ditemukan');
      }
      
      res.redirect('/groups');
    } catch (error) {
      console.error('Error deleting group:', error);
      req.flash('error', 'Terjadi kesalahan saat menghapus group');
      res.redirect('/groups');
    }
  }

  // API endpoint untuk mendapatkan template
  async getTemplateApi(req, res) {
    try {
      const templateName = req.params.template;
      const templates = GroupModel.getGroupTemplates();
      
      if (!templates[templateName]) {
        return res.status(404).json({
          success: false,
          message: 'Template tidak ditemukan'
        });
      }

      res.json({
        success: true,
        data: templates[templateName]
      });
    } catch (error) {
      console.error('Error getting template API:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil template'
      });
    }
  }
}

module.exports = new GroupController();
