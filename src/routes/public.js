const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /public/propiedades - listado publico (sin datos internos del CRM)
router.get('/propiedades', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, titulo, tipo, zona, precio, ambientes, fotos, descripcion
       FROM propiedades WHERE publicada = true ORDER BY creado_en DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener propiedades' });
  }
});

// POST /public/leads - form "Contanos que buscas"
router.post('/leads', async (req, res) => {
  const { nombre, telefono, email, tipo_buscado, zona, presupuesto } = req.body;
  if (!nombre || !telefono) {
    return res.status(400).json({ error: 'Nombre y telefono son obligatorios' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO leads (nombre, telefono, email, tipo_buscado, zona, presupuesto)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [nombre, telefono, email || null, tipo_buscado || null, zona || null, presupuesto || null]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar el lead' });
  }
});

module.exports = router;
