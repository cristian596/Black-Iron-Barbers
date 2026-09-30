// eslint-disable-next-line no-unused-vars -- Express solo reconoce middleware de error con 4 parámetros
export const errorHandler = (err, req, res, next) => {
  console.error(err.message);

  if (err.code === '23505') {
    return res.status(409).json({ error: 'El recurso ya existe o entra en conflicto' });
  }

  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
};
