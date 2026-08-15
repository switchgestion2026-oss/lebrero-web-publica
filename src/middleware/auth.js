// Auth minima para rutas /admin. Compara contra ADMIN_TOKEN (env var).
// TODO: reemplazar por login real (usuario/password + sesion) cuando haya mas de un usuario admin.
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

module.exports = { requireAdmin };
