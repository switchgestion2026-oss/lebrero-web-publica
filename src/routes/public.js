const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const matchEngine = require('../services/matchEngine');

// GET /public/propiedades - listado publico (sin datos internos del CRM)
router.get('/propiedades', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, titulo, tipo, operacion, barrio AS zona, localidad, precio, moneda, ambientes, dormitorios, banos, descripcion, fotos, destacada, garage, garage_cant, balcon, apto_credito, sup_cubierta_m2, sup_terreno_m2
       FROM properties WHERE publicada = true AND activo_match = true ORDER BY id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener propiedades' });
  }
});

// POST /public/leads - form "Contanos que buscas" (log crudo, ya existia)
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

// POST /api/public/search - busqueda con match real, solo contra properties activas
// Body esperado: { tipo_propiedad:[], operacion, localidad, todas_localidades, zonas:[], solo_por_valor,
//                   presupuesto_min, presupuesto_max, moneda, dormitorios_min, banos_min, garage, patio }
router.post('/search', async (req, res) => {
  const filtroReq = { ...req.body, estado: 'ACTIVO' };
  try {
    const propsRes = await pool.query('SELECT * FROM properties WHERE activo_match = true AND publicada = true');
    const tipoFiltro = (filtroReq.tipo_propiedad || []).filter((t) => t && t !== 'Cualquiera');
    const propsFiltradas = tipoFiltro.length
      ? propsRes.rows.filter((prop) => tipoFiltro.includes(prop.tipo))
      : propsRes.rows;
    const propsPorLocalidad = (!filtroReq.todas_localidades && filtroReq.localidad)
      ? propsFiltradas.filter((prop) => (prop.localidad || '').trim().toLowerCase() === filtroReq.localidad.trim().toLowerCase())
      : propsFiltradas;
    const zonasFiltro = filtroReq.zonas || [];
    const propsPorZona = zonasFiltro.length
      ? propsPorLocalidad.filter((prop) => zonasFiltro.includes(prop.barrio))
      : propsPorLocalidad;
    const propsPorPrecio = (filtroReq.presupuesto_min > 0 || filtroReq.presupuesto_max > 0)
      ? propsPorZona.filter((prop) => {
          const mismaMoneda = !prop.moneda || !filtroReq.moneda || prop.moneda === filtroReq.moneda;
          if (!mismaMoneda) return true;
          const precio = Number(prop.precio);
          if (filtroReq.presupuesto_min > 0 && precio < filtroReq.presupuesto_min) return false;
          if (filtroReq.presupuesto_max > 0 && precio > filtroReq.presupuesto_max) return false;
          return true;
        })
      : propsPorZona;
    const results = propsPorPrecio
      .map((prop) => {
        const s = matchEngine.calcScore(prop, filtroReq);
        return { property: prop, score: s.total };
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score);
    res.json(results);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al buscar' });
  }
});

// POST /api/public/property-request - propietario ofrece su propiedad
router.post('/property-request', async (req, res) => {
  const b = req.body;
  if (!b.nombre || !b.whatsapp) {
    return res.status(400).json({ error: 'Nombre y whatsapp son obligatorios' });
  }
  try {
    const r = await pool.query(
      `INSERT INTO property_requests
        (nombre, whatsapp, email, tipo_propiedad, localidad, barrio, direccion, dormitorios, banos, superficie, operacion, precio_estimado, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [b.nombre, b.whatsapp, b.email || null, b.tipo_propiedad, b.localidad, b.barrio, b.direccion,
       b.dormitorios || null, b.banos || null, b.superficie || null, b.operacion, b.precio_estimado || null, b.observaciones || null]
    );
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al guardar la solicitud' });
  }
});

module.exports = router;
