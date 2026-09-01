const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const matchEngine = require('../services/matchEngine');

router.use(requireAdmin);

/* ── PROPERTIES ── */
router.get('/properties', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM properties ORDER BY id DESC');
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener propiedades' }); }
});

router.post('/properties', async (req, res) => {
  const b = req.body;
  const titulo = b.titulo || `${b.tipo || 'Propiedad'} - ${b.direccion || b.localidad || 'S/D'}`;
  try {
    const r = await pool.query(
      `INSERT INTO properties
        (titulo, tipo, operacion, localidad, barrio, direccion, precio, ambientes, dormitorios, banos,
         garage, patio, lavadero, pileta, quincho, parrilla, amoblado, ascensor, balcon, esquina, agua, alambrado,
         descripcion, publicada, estado_comercial, activo_match, propietario_id,
         zona, fotos, moneda, apto_credito, exclusividad, inmobiliaria, contacto_operativo,
         garage_cant, tipo_patio, sup_terreno_m2, sup_cubierta_m2, frente, fondo, estado_general,
         servicios, ocupada, disponible_desde, perfil_ideal, entre_calles, piso, depto,
         impuesto, servicio, partida, acepta_permutas, instagram, destacada)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,
               $28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54)
       RETURNING *`,
      [titulo, b.tipo, b.operacion, b.localidad, b.barrio, b.direccion, b.precio, b.ambientes, b.dormitorios, b.banos,
       !!b.garage, !!b.patio, !!b.lavadero, !!b.pileta, !!b.quincho, !!b.parrilla, !!b.amoblado, !!b.ascensor, !!b.balcon, !!b.esquina, !!b.agua, !!b.alambrado,
       b.descripcion, !!b.publicada, b.estado_comercial || 'Disponible', b.activo_match !== false, b.propietario_id || null,
       b.zona || b.barrio || null, b.fotos || [], b.moneda || 'USD', !!b.apto_credito, !!b.exclusividad, b.inmobiliaria || null, b.contacto_operativo || null,
       b.garage_cant || null, b.tipo_patio || null, b.sup_terreno_m2 || null, b.sup_cubierta_m2 || null, b.frente || null, b.fondo || null, b.estado_general || null,
       b.servicios || null, !!b.ocupada, b.disponible_desde || null, b.perfil_ideal || null, b.entre_calles || null, b.piso || null, b.depto || null,
       !!b.impuesto, !!b.servicio, b.partida || null, !!b.acepta_permutas, b.instagram || null, !!b.destacada]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al crear propiedad' }); }
});

router.put('/properties/:id', async (req, res) => {
  const fields = Object.keys(req.body);
  if (!fields.length) return res.status(400).json({ error: 'Sin campos para actualizar' });
  const sets = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map((f) => req.body[f]);
  try {
    const r = await pool.query(
      `UPDATE properties SET ${sets}, updated_at = now() WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al actualizar propiedad' }); }
});

router.delete('/properties/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM matches WHERE propiedad_id = $1', [req.params.id]);
    const r = await client.query('DELETE FROM properties WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'No encontrada' }); }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e); res.status(500).json({ error: 'Error al eliminar propiedad' });
  } finally { client.release(); }
});
router.get('/barrios', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT b.id, b.nombre, b.localidad_id, l.nombre AS localidad, b.zona_id, z.nombre AS zona
       FROM barrios b JOIN localidades l ON l.id = b.localidad_id
       LEFT JOIN zonas z ON z.id = b.zona_id ORDER BY l.nombre, b.nombre`
    );
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener barrios' }); }
});
/* ── CLIENTS ── */
router.get('/clients', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM clients ORDER BY id DESC');
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener clientes' }); }
});

router.get('/clients/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener cliente' }); }
});

router.post('/clients', async (req, res) => {
  const b = req.body;
  if (!b.nombre) return res.status(400).json({ error: 'Falta nombre' });
  try {
    const r = await pool.query(
      `INSERT INTO clients (nombre, whatsapp, email, tipo) VALUES ($1,$2,$3,$4) RETURNING *`,
      [b.nombre, b.whatsapp || null, b.email || null, b.tipo || 'propietario']
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al crear cliente' }); }
});

/* ── REQUIREMENTS ── */
router.get('/requirements', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM requirements ORDER BY id DESC');
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener requerimientos' }); }
});

router.post('/requirements', async (req, res) => {
  const b = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO requirements
        (cliente_id, operacion, tipo_propiedad, localidad, todas_localidades, zonas, solo_por_valor,
         presupuesto_min, presupuesto_max, moneda, dormitorios_min, banos_min, garage, patio,
         apto_credito, flexibilidad_zona, observaciones, estado, prioridad,
         lavadero, pileta, quincho, parrilla, amoblado, escritorio, esquina, ascensor, alambrado, agua,
         superficie_min, frente, fondo, expensas, hectareas, piso, aptitud)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
               $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36)
       RETURNING *`,
      [b.cliente_id || null, b.operacion, JSON.stringify(b.tipo_propiedad || []), b.localidad, !!b.todas_localidades,
       JSON.stringify(b.zonas || []), !!b.solo_por_valor, b.presupuesto_min, b.presupuesto_max, b.moneda || 'USD',
       b.dormitorios_min || 0, b.banos_min || 0, !!b.garage, !!b.patio, !!b.apto_credito, b.flexibilidad_zona,
       b.observaciones, b.estado || 'ACTIVO', b.prioridad,
       !!b.lavadero, !!b.pileta, !!b.quincho, !!b.parrilla, !!b.amoblado, !!b.escritorio, !!b.esquina, !!b.ascensor, !!b.alambrado, !!b.agua,
       b.superficie_min || null, b.frente || null, b.fondo || null, b.expensas || null, b.hectareas || null, b.piso || null, b.aptitud || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al crear requerimiento' }); }
});

router.put('/requirements/:id', async (req, res) => {
  const fields = Object.keys(req.body);
  if (!fields.length) return res.status(400).json({ error: 'Sin campos para actualizar' });
  const sets = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map((f) => (typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]));
  try {
    const r = await pool.query(
      `UPDATE requirements SET ${sets} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al actualizar requerimiento' }); }
});

/* ── MATCHES ── */
router.get('/matches/requirement/:id', async (req, res) => {
  try {
    const results = await matchEngine.matchForRequirement(req.params.id);
    res.json(results);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al calcular match' }); }
});

router.get('/matches/property/:id', async (req, res) => {
  try {
    const results = await matchEngine.matchForProperty(req.params.id);
    res.json(results);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al calcular match' }); }
});

router.post('/matches/recalculate', async (req, res) => {
  const { requirement_id } = req.body;
  if (!requirement_id) return res.status(400).json({ error: 'Falta requirement_id' });
  try {
    const results = await matchEngine.recalculateAndSave(requirement_id);
    res.json(results);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al recalcular' }); }
});

router.post('/matches/:id/contact', async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE matches SET estado = 'CONTACTADO' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Match no encontrado' });
    await pool.query(
      `INSERT INTO match_activities (match_id, canal, estado, notas) VALUES ($1,$2,$3,$4)`,
      [req.params.id, req.body.canal || 'whatsapp', 'CONTACTADO', req.body.notas || null]
    );
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al registrar contacto' }); }
});

/* ── DASHBOARD ── */
router.get('/dashboard', async (req, res) => {
  try {
    const [props, reqs, leads] = await Promise.all([
      pool.query("SELECT estado_comercial, count(*) FROM properties GROUP BY estado_comercial"),
      pool.query("SELECT estado, count(*) FROM requirements GROUP BY estado"),
      pool.query("SELECT count(*) FROM leads"),
    ]);
    res.json({ properties_por_estado: props.rows, requirements_por_estado: reqs.rows, total_leads: leads.rows[0].count });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener dashboard' }); }
});

/* ── PROPERTY REQUESTS (propietarios que ofrecen desde la web) ── */
router.get('/property-requests', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM property_requests ORDER BY id DESC');
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener solicitudes' }); }
});

router.post('/property-requests/:id/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pr = (await client.query('SELECT * FROM property_requests WHERE id = $1', [req.params.id])).rows[0];
    if (!pr) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'No encontrada' }); }

    const prop = await client.query(
      `INSERT INTO properties (titulo, tipo, operacion, localidad, barrio, direccion, precio, dormitorios, banos, activo_match, estado_comercial)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,'Disponible') RETURNING id`,
      [pr.tipo_propiedad + ' - ' + pr.direccion, pr.tipo_propiedad, pr.operacion, pr.localidad, pr.barrio, pr.direccion, pr.precio_estimado, pr.dormitorios, pr.banos]
    );
    await client.query(
      `UPDATE property_requests SET estado = 'ACEPTADA', property_id = $1 WHERE id = $2`,
      [prop.rows[0].id, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ ok: true, property_id: prop.rows[0].id });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e); res.status(500).json({ error: 'Error al aprobar solicitud' });
  } finally { client.release(); }
});

router.post('/property-requests/:id/reject', async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE property_requests SET estado = 'RECHAZADA' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al rechazar' }); }
});

/* ── LEADS (ya existia) ── */
router.get('/leads', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM leads ORDER BY id DESC');
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener leads' }); }
});

module.exports = router;
