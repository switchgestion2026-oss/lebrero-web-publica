// Motor de match. Portado 1:1 de calcScore() (Code.gs / index.html del CRM interno).
// NO modificar los pesos sin aprobacion explicita.
const pool = require('../config/db');

let _barrioMap = null;
async function getBarrioMap() {
  if (_barrioMap) return _barrioMap;
  const r = await pool.query(
    `SELECT b.id, b.zona_id, b.localidad_id, l.partido
     FROM barrios b JOIN localidades l ON l.id = b.localidad_id`
  );
  _barrioMap = new Map(r.rows.map(row => [row.id, row]));
  return _barrioMap;
}

function locationLevelScore(propBarrioId, reqBarrioIds, barrioMap) {
  const prop = barrioMap.get(propBarrioId);
  if (!prop || !reqBarrioIds || !reqBarrioIds.length) return null;
  if (reqBarrioIds.includes(propBarrioId)) return 100;
  let mismaZona = false, mismaLocalidad = false, mismoPartido = false;
  for (const rid of reqBarrioIds) {
    const req = barrioMap.get(rid);
    if (!req) continue;
    if (req.zona_id && req.zona_id === prop.zona_id) mismaZona = true;
    if (req.localidad_id === prop.localidad_id) mismaLocalidad = true;
    if (req.partido === prop.partido) mismoPartido = true;
  }
  if (mismaZona) return 75;
  if (mismaLocalidad) return 50;
  if (mismoPartido) return 25;
  return 0;
}

const MATCH_W = { tipo: 20, op: 10, precio: 20, zona: 15, localidad: 10, dormitorios: 10, banos: 5, garage: 5, patio: 5 };
const BONUS_W = { pileta: 2, quincho: 2, lavadero: 2, parrilla: 2, amoblado: 2, ascensor: 1, balcon: 1, esquina: 1, agua: 1, alambrado: 1 };

// zoneLevel: exact / group / no. zones = tabla `zones` (nombre, localidad) usada como agrupador simple.
// TODO: si se necesitan grupos de zona (ej "Norte CABA" con varios barrios), agregar columna `grupo` a zones.
function zoneLevel(barrio, reqZonas) {
  if (!barrio) return 'no';
  if (reqZonas.includes(barrio)) return 'exact';
  return 'no';
}

function calcScore(prop, req, barrioMap = _barrioMap) {
  const c = {}, max = {}, w = MATCH_W;

  const tipoBuscado = req.tipo_propiedad || [];
  c.tipo = (tipoBuscado.includes('Cualquiera') || tipoBuscado.includes(prop.tipo)) ? w.tipo : 0;
  max.tipo = w.tipo;

  c.op = (req.operacion === 'Ambos' || prop.operacion === req.operacion) ? w.op : 0;
  max.op = w.op;

  const pw = req.solo_por_valor ? 35 : w.precio;
  const mismaMoneda = !prop.moneda || !req.moneda || prop.moneda === req.moneda;
  const pct = (mismaMoneda && req.presupuesto_max > 0) ? prop.precio / req.presupuesto_max : null;
  if (pct != null) {
    c.precio = pct >= 0.7 && pct <= 1 ? pw
      : pct > 1 && pct <= 1.10 ? Math.round(pw * 0.7)
      : pct > 1.10 && pct <= 1.25 ? Math.round(pw * 0.4)
      : pct >= 0.5 && pct < 0.7 ? Math.round(pw * 0.5)
      : 0;
    max.precio = pw;
  } else { c.precio = 0; max.precio = 0; }

  const ubicW = w.zona + w.localidad;
  if (req.solo_por_valor) {
    c.zona = 0; max.zona = 0; c.localidad = 0; max.localidad = 0;
  } else if (req.barrio_ids && req.barrio_ids.length) {
    const lvl = locationLevelScore(prop.barrio_id, req.barrio_ids, barrioMap || new Map());
    c.zona = lvl == null ? 0 : Math.round(ubicW * (lvl / 100));
    max.zona = ubicW; c.localidad = 0; max.localidad = 0;
  } else if (!req.todas_localidades && req.localidad) {
    // fallback: requerimientos sin barrio cargado todavía, comparan por localidad como antes
    const pl = (prop.localidad || '').trim().toLowerCase();
    const rl = req.localidad.trim().toLowerCase();
    c.zona = pl === rl ? ubicW : 0;
    max.zona = ubicW; c.localidad = 0; max.localidad = 0;
  } else { c.zona = 0; max.zona = 0; c.localidad = 0; max.localidad = 0; }

  if (req.dormitorios_min > 0) {
    const diff = prop.dormitorios - req.dormitorios_min;
    c.dormitorios = diff >= 0 ? w.dormitorios : diff === -1 ? Math.round(w.dormitorios * 0.5) : 0;
    max.dormitorios = w.dormitorios;
  } else { c.dormitorios = 0; max.dormitorios = 0; }

  if (req.banos_min > 0) {
    const diffB = prop.banos - req.banos_min;
    c.banos = diffB >= 0 ? w.banos : diffB === -1 ? Math.round(w.banos * 0.5) : 0;
    max.banos = w.banos;
  } else { c.banos = 0; max.banos = 0; }

  c.garage = req.garage ? (prop.garage ? w.garage : 0) : 0; max.garage = req.garage ? w.garage : 0;
  c.patio = req.patio ? (prop.patio ? w.patio : 0) : 0; max.patio = req.patio ? w.patio : 0;

  const maxTotal = Object.values(max).reduce((a, v) => a + v, 0);
  const earned = Object.values(c).reduce((a, v) => a + v, 0);

  let bonus = 0;
  Object.keys(BONUS_W).forEach((k) => { if (req[k] && prop[k]) bonus += BONUS_W[k]; });

  const total = maxTotal > 0 ? Math.round(((earned + bonus) / maxTotal) * 100) : 0;

  return { total: Math.min(total, 100), c, max, pct };
}

// requerimiento -> properties, solo contra activo_match = true
async function matchForRequirement(requirementId) {
  const barrioMap = await getBarrioMap();
  const reqRes = await pool.query(
    `SELECT r.*, COALESCE(array_agg(rb.barrio_id) FILTER (WHERE rb.barrio_id IS NOT NULL), '{}') AS barrio_ids
     FROM requirements r LEFT JOIN requirement_barrios rb ON rb.requerimiento_id = r.id
     WHERE r.id = $1 GROUP BY r.id`, [requirementId]);
  const req = reqRes.rows[0];
  if (!req) return [];

  const propsRes = await pool.query('SELECT * FROM properties WHERE activo_match = true');
  const results = propsRes.rows
    .map((prop) => {
      const s = calcScore(prop, req, barrioMap);
      return { property: prop, score: s.total, criteria: s.c, max: s.max };
    })
    .filter((m) => m.criteria.tipo > 0)
    .sort((a, b) => b.score - a.score);

  return results;
}

// property -> requirements (direccion inversa), solo si la property esta activa
async function matchForProperty(propertyId) {
  const barrioMap = await getBarrioMap();
  const propRes = await pool.query('SELECT * FROM properties WHERE id = $1 AND activo_match = true', [propertyId]);
  const prop = propRes.rows[0];
  if (!prop) return [];

  const reqsRes = await pool.query(
    `SELECT r.*, COALESCE(array_agg(rb.barrio_id) FILTER (WHERE rb.barrio_id IS NOT NULL), '{}') AS barrio_ids
     FROM requirements r LEFT JOIN requirement_barrios rb ON rb.requerimiento_id = r.id
     WHERE r.estado = 'ACTIVO' GROUP BY r.id`);
  const results = reqsRes.rows
    .map((req) => {
      const s = calcScore(prop, req, barrioMap);
      return { requirement: req, score: s.total, criteria: s.c, max: s.max };
    })
    .filter((m) => m.criteria.tipo > 0)
    .sort((a, b) => b.score - a.score);

  return results;
}

// Recalcula y persiste en `matches` (upsert por par propiedad/requerimiento)
async function recalculateAndSave(requirementId) {
  const results = await matchForRequirement(requirementId);
  for (const r of results) {
    await pool.query(
      `INSERT INTO matches (propiedad_id, requerimiento_id, score, fecha_calculo)
       VALUES ($1,$2,$3, now())
       ON CONFLICT (propiedad_id, requerimiento_id)
       DO UPDATE SET score = EXCLUDED.score, fecha_calculo = now()`,
      [r.property.id, requirementId, r.score]
    );
  }
  return results;
}

module.exports = { calcScore, matchForRequirement, matchForProperty, recalculateAndSave, MATCH_W };
