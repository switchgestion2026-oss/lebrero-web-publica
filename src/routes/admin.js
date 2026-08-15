const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

// GET /admin/propiedades - todas, incluidas no publicadas
router.get('/propiedades', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM propiedades ORDER BY creado_en DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener propiedades' });
  }
});

// GET /admin/leads
router.get('/leads', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leads ORDER BY creado_en DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener leads' });
  }
});

module.exports = router;
