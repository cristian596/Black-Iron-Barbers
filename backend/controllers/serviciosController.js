import { pool } from '../db/connection.js';

const TIPOS_VALIDOS = ['original', 'elite', 'vip'];
const COLUMNAS_ORDEN = { precio: 's.precio', duracion: 's.duracion_min', nombre: 's.nombre' };
const PARAMETROS_ADMITIDOS = ['categoria', 'tipo', 'q', 'ordenar', 'direccion', 'agrupar'];
const MAX_LONGITUD_Q = 100;
const ID_MAXIMO_INT = 2147483647;

const SELECT_SERVICIOS = `
  SELECT s.id, s.nombre, s.descripcion, s.precio, s.duracion_min, s.tipo,
         c.id AS categoria_id, c.nombre AS categoria_nombre, c.slug AS categoria_slug, c.orden AS categoria_orden
  FROM servicios s
  LEFT JOIN categorias c ON c.id = s.categoria_id`;

const aServicioPublico = (fila) => ({
  id: fila.id,
  nombre: fila.nombre,
  descripcion: fila.descripcion,
  precio: fila.precio,
  duracion_min: fila.duracion_min,
  tipo: fila.tipo,
  categoria: fila.categoria_id === null
    ? null
    : { id: fila.categoria_id, nombre: fila.categoria_nombre, slug: fila.categoria_slug },
});

const escaparLike = (texto) => texto.replace(/[\\%_]/g, '\\$&');

// Devuelve { error } si algún parámetro es inválido o { valores } con los parámetros normalizados.
// Un parámetro repetido (?tipo=a&tipo=b) llega como arreglo y se rechaza.
const leerParametros = (query) => {
  for (const [nombre, valor] of Object.entries(query)) {
    if (!PARAMETROS_ADMITIDOS.includes(nombre)) {
      return { error: `Parámetro desconocido '${nombre}'. Parámetros admitidos: ${PARAMETROS_ADMITIDOS.join(', ')}` };
    }
    if (typeof valor !== 'string') {
      return { error: `El parámetro '${nombre}' debe enviarse una sola vez y como texto` };
    }
  }

  const { categoria, tipo, q, ordenar, direccion, agrupar } = query;

  if (tipo !== undefined && !TIPOS_VALIDOS.includes(tipo)) {
    return { error: `El parámetro 'tipo' debe ser uno de: ${TIPOS_VALIDOS.join(', ')}` };
  }
  if (ordenar !== undefined && !(ordenar in COLUMNAS_ORDEN)) {
    return { error: `El parámetro 'ordenar' debe ser uno de: ${Object.keys(COLUMNAS_ORDEN).join(', ')}` };
  }
  if (direccion !== undefined && !['asc', 'desc'].includes(direccion)) {
    return { error: "El parámetro 'direccion' debe ser asc o desc" };
  }
  if (direccion !== undefined && ordenar === undefined) {
    return { error: "El parámetro 'direccion' requiere indicar también 'ordenar'" };
  }
  if (agrupar !== undefined && agrupar !== 'categoria') {
    return { error: "El parámetro 'agrupar' solo admite el valor categoria" };
  }
  if (categoria !== undefined && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(categoria)) {
    return { error: "El parámetro 'categoria' debe ser un slug válido (por ejemplo: cortes)" };
  }
  if (q !== undefined && q.trim().length > MAX_LONGITUD_Q) {
    return { error: `El parámetro 'q' no puede superar ${MAX_LONGITUD_Q} caracteres` };
  }

  return { valores: { categoria, tipo, q: q?.trim() || undefined, ordenar, direccion, agrupar } };
};

export const listarServicios = async (req, res, next) => {
  try {
    const { error, valores } = leerParametros(req.query);
    if (error) {
      return res.status(400).json({ error });
    }
    const { categoria, tipo, q, ordenar, direccion, agrupar } = valores;

    if (categoria) {
      const { rows } = await pool.query('SELECT 1 FROM categorias WHERE slug = $1', [categoria]);
      if (rows.length === 0) {
        return res.status(400).json({ error: `La categoría '${categoria}' no existe` });
      }
    }

    const condiciones = ['s.activo = true'];
    const parametros = [];

    if (categoria) {
      parametros.push(categoria);
      condiciones.push(`c.slug = $${parametros.length}`);
    }
    if (tipo) {
      parametros.push(tipo);
      condiciones.push(`s.tipo = $${parametros.length}`);
    }
    if (q) {
      parametros.push(`%${escaparLike(q)}%`);
      condiciones.push(`s.nombre ILIKE $${parametros.length} ESCAPE '\\'`);
    }

    // Por defecto: categorías en su orden, luego precio y nombre. Con ?ordenar se respeta la
    // categoría solo si se agrupa; de lo contrario el orden pedido manda sobre todo el listado.
    const orden = [];
    if (ordenar) {
      orden.push(`${COLUMNAS_ORDEN[ordenar]} ${direccion === 'desc' ? 'DESC' : 'ASC'}`, 's.nombre ASC');
    } else {
      orden.push('s.precio ASC', 's.nombre ASC');
    }
    orden.push('s.id ASC');
    const ordenSql = agrupar === 'categoria' || !ordenar
      ? `c.orden ASC NULLS LAST, ${orden.join(', ')}`
      : orden.join(', ');

    const { rows } = await pool.query(
      `${SELECT_SERVICIOS} WHERE ${condiciones.join(' AND ')} ORDER BY ${ordenSql}`,
      parametros
    );

    if (agrupar !== 'categoria') {
      return res.json(rows.map(aServicioPublico));
    }

    // Las filas ya vienen ordenadas por categoría, así que basta comparar con el último grupo.
    // Una categoría sin servicios activos (o filtrados) no aparece porque no tiene filas.
    const grupos = [];
    for (const fila of rows) {
      const servicio = aServicioPublico(fila);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && (ultimo.categoria?.id ?? null) === (servicio.categoria?.id ?? null)) {
        ultimo.servicios.push(servicio);
      } else {
        grupos.push({
          categoria: servicio.categoria ? { ...servicio.categoria, orden: fila.categoria_orden } : null,
          servicios: [servicio],
        });
      }
    }
    return res.json(grupos);
  } catch (err) {
    next(err);
  }
};

export const obtenerServicio = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ error: 'El id del servicio debe ser numérico' });
    }
    const servicioId = Number(id);
    if (servicioId > ID_MAXIMO_INT) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    const { rows } = await pool.query(`${SELECT_SERVICIOS} WHERE s.id = $1 AND s.activo = true`, [servicioId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    return res.json(aServicioPublico(rows[0]));
  } catch (err) {
    next(err);
  }
};
