// Manejo de errores sin filtrar nada interno: el detalle (mensaje de pg, TypeError, posición del parser JSON…) va al log
// del servidor y NUNCA al cliente. Al cliente solo llegan mensajes fijos.
const ERRORES_DE_CUERPO = {
  'entity.parse.failed': { status: 400, error: 'El cuerpo de la petición no es un JSON válido', codigo: 'JSON_INVALIDO' },
  'entity.too.large': { status: 413, error: 'El cuerpo de la petición es demasiado grande', codigo: 'CUERPO_DEMASIADO_GRANDE' },
  'encoding.unsupported': { status: 415, error: 'Codificación no soportada', codigo: 'CODIFICACION_NO_SOPORTADA' },
  'charset.unsupported': { status: 415, error: 'Codificación no soportada', codigo: 'CODIFICACION_NO_SOPORTADA' },
  'request.aborted': { status: 400, error: 'Petición abortada', codigo: 'PETICION_ABORTADA' },
  'request.size.invalid': { status: 400, error: 'Petición inválida', codigo: 'PETICION_INVALIDA' },
  'stream.encoding.set': { status: 400, error: 'Petición inválida', codigo: 'PETICION_INVALIDA' },
  'parameters.too.many': { status: 413, error: 'Demasiados parámetros', codigo: 'CUERPO_DEMASIADO_GRANDE' },
};

// eslint-disable-next-line no-unused-vars -- Express solo reconoce middleware de error con 4 parámetros
export const errorHandler = (err, req, res, next) => {
  console.error(err?.message);

  if (err?.code === '23505' || err?.code === '23P01' || err?.code === '40P01') {
    return res.status(409).json({ error: 'El recurso ya existe o entra en conflicto' });
  }

  const conocido = ERRORES_DE_CUERPO[err?.type];
  if (conocido) return res.status(conocido.status).json({ error: conocido.error, codigo: conocido.codigo });

  // Cualquier otro 4xx con `status` (poco frecuente: lo lanzan librerías) sale con un texto fijo; el resto es un 500.
  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'Petición inválida' });
  }
  res.status(500).json({ error: 'Error interno del servidor' });
};
