export const requiereRol = (...rolesPermitidos) => (req, res, next) => {
  if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
    return res.status(403).json({ error: 'No tienes permisos para esta acción' });
  }
  next();
};
