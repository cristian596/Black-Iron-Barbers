// Gestión del catálogo desde el panel del admin: servicios y categorías. Sin DELETE a propósito: los servicios y las
// categorías se activan o desactivan para conservar el historial de citas.
// Todas las respuestas de error llevan un `codigo` estable (DATOS_INVALIDOS, NOMBRE_DUPLICADO,
// CATEGORIA_CON_SERVICIOS…) para que el front decida qué mostrar sin depender del texto.
import { pool } from '../db/connection.js';
import { validarParametros, escaparLike } from '../utils/parametrosQuery.js';
import { generarSlug } from '../utils/slug.js';
import { AREAS, AREA_BARBERIA, esAreaValida, esAsesoriaGratis } from '../utils/areas.js';

const ID_MAXIMO_INT = 2147483647;
const TIPOS_VALIDOS = ['original', 'elite', 'vip'];
const MAX_LONGITUD_Q = 100;
const MAX_NOMBRE_SERVICIO = 150;
const MAX_NOMBRE_CATEGORIA = 100;
const MAX_DESCRIPCION = 500;
const MAX_DURACION_MIN = 600;
const MAX_ORDEN = 100000;

const fallo = (res, estado, codigo, error, extra = {}) => res.status(estado).json({ error, codigo, ...extra });
const datoInvalido = (res, campo, mensaje) => fallo(res, 400, 'DATOS_INVALIDOS', mensaje, { campo });

const esObjetoPlano = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const esEntero = (valor, minimo, maximo) => Number.isInteger(valor) && valor >= minimo && valor <= maximo;

// Valida cada campo presente en `cuerpo` y devuelve { datos } normalizados o { campo, mensaje } con el primer error.
const REGLAS_SERVICIO = {
  nombre: (v) =>
    typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= MAX_NOMBRE_SERVICIO
      ? { valor: v.trim() }
      : { mensaje: `El nombre es obligatorio y debe tener entre 1 y ${MAX_NOMBRE_SERVICIO} caracteres` },
  precio: (v) =>
    esEntero(v, 0, ID_MAXIMO_INT) ? { valor: v } : { mensaje: 'El precio debe ser un número entero mayor o igual a 0' },
  duracion_min: (v) =>
    esEntero(v, 1, MAX_DURACION_MIN)
      ? { valor: v }
      : { mensaje: `La duración debe ser un número entero de minutos entre 1 y ${MAX_DURACION_MIN}` },
  tipo: (v) =>
    TIPOS_VALIDOS.includes(v) ? { valor: v } : { mensaje: `El tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}` },
  categoria_id: (v) =>
    esEntero(v, 1, ID_MAXIMO_INT) ? { valor: v } : { mensaje: 'La categoría debe ser un id numérico' },
  descripcion: (v) =>
    typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= MAX_DESCRIPCION
      ? { valor: v.trim() }
      : { mensaje: `La descripción es obligatoria y no puede superar ${MAX_DESCRIPCION} caracteres` },
  activo: (v) => (typeof v === 'boolean' ? { valor: v } : { mensaje: 'El campo activo debe ser verdadero o falso' }),
  area: (v) => (esAreaValida(v) ? { valor: v } : { mensaje: `El área debe ser una de: ${AREAS.join(', ')}` }),
};
const CAMPOS_SERVICIO = Object.keys(REGLAS_SERVICIO);
const OBLIGATORIOS_ALTA = ['nombre', 'precio', 'duracion_min', 'tipo', 'categoria_id', 'descripcion'];

const REGLAS_CATEGORIA = {
  nombre: (v) =>
    typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= MAX_NOMBRE_CATEGORIA
      ? { valor: v.trim() }
      : { mensaje: `El nombre es obligatorio y debe tener entre 1 y ${MAX_NOMBRE_CATEGORIA} caracteres` },
  orden: (v) =>
    esEntero(v, 0, MAX_ORDEN) ? { valor: v } : { mensaje: `El orden debe ser un número entero entre 0 y ${MAX_ORDEN}` },
  activo: REGLAS_SERVICIO.activo,
};

const leerCampos = (cuerpo, reglas) => {
  const datos = {};
  for (const campo of Object.keys(cuerpo)) {
    if (!(campo in reglas)) {
      return { campo, mensaje: `Campo desconocido '${campo}'. Campos admitidos: ${Object.keys(reglas).join(', ')}` };
    }
    const resultado = reglas[campo](cuerpo[campo]);
    if (!('valor' in resultado)) return { campo, mensaje: resultado.mensaje };
    datos[campo] = resultado.valor;
  }
  return { datos };
};

// Devuelve el id numérico o responde y devuelve null.
const leerId = (req, res, codigoNoEncontrado, mensajeNoEncontrado) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) {
    fallo(res, 400, 'ID_INVALIDO', 'El id debe ser numérico');
    return null;
  }
  const numero = Number(id);
  if (numero > ID_MAXIMO_INT) {
    fallo(res, 404, codigoNoEncontrado, mensajeNoEncontrado);
    return null;
  }
  return numero;
};

// Un nombre "ya existe" sin distinguir mayúsculas ni importar tildes de mayúsculas (lower de Postgres).
// Solo se consulta al crear o al CAMBIAR el nombre: las filas existentes que ya se parecen (p. ej. "Exfoliación
// Facial" y "Exfoliación facial") no se tocan ni impiden editar sus otros campos.
const nombreOcupado = async (tabla, nombre, idExcluido = null) => {
  const { rows } = await pool.query(
    `SELECT 1 FROM ${tabla} WHERE lower(nombre) = lower($1) AND ($2::int IS NULL OR id <> $2) LIMIT 1`,
    [nombre, idExcluido]
  );
  return rows.length > 0;
};

// ---------------------------------------------------------------------------------------------------- servicios

const SELECT_SERVICIOS = `
  SELECT s.id, s.nombre, s.descripcion, s.precio, s.duracion_min, s.tipo, s.activo, s.categoria_id, s.area, s.clave_seed,
         c.area AS categoria_area, c.nombre AS categoria_nombre, c.slug AS categoria_slug, c.activo AS categoria_activo, c.orden AS categoria_orden
  FROM servicios s
  LEFT JOIN categorias c ON c.id = s.categoria_id`;

const aServicioAdmin = (f) => ({
  id: f.id,
  nombre: f.nombre,
  descripcion: f.descripcion,
  precio: f.precio,
  duracion_min: f.duracion_min,
  tipo: f.tipo,
  activo: f.activo,
  area: f.area,
  // La asesoría gratis sembrada debe costar siempre 0: el front deshabilita su precio (el back-end lo exige igual).
  precio_fijo: esAsesoriaGratis(f),
  categoria:
    f.categoria_id === null
      ? null
      : { id: f.categoria_id, nombre: f.categoria_nombre, slug: f.categoria_slug, activo: f.categoria_activo, area: f.categoria_area },
});

const buscarServicio = async (id) => {
  const { rows } = await pool.query(`${SELECT_SERVICIOS} WHERE s.id = $1`, [id]);
  return rows[0] ?? null;
};

const buscarCategoriaPorId = async (id) => {
  const { rows } = await pool.query('SELECT id, activo, area FROM categorias WHERE id = $1', [id]);
  return rows[0] ?? null;
};

// GET /api/admin/servicios?activo=&categoria=&q=  (incluye inactivos)
export const listarServiciosAdmin = async (req, res, next) => {
  try {
    const errorParametros = validarParametros(req.query, ['activo', 'categoria', 'q', 'area']);
    if (errorParametros) return fallo(res, 400, 'PARAMETRO_INVALIDO', errorParametros);

    const { activo, categoria, q, area } = req.query;
    if (area !== undefined && !esAreaValida(area)) {
      return fallo(res, 400, 'PARAMETRO_INVALIDO', `El parámetro 'area' debe ser uno de: ${AREAS.join(', ')}`);
    }
    if (activo !== undefined && !['true', 'false'].includes(activo)) {
      return fallo(res, 400, 'PARAMETRO_INVALIDO', "El parámetro 'activo' debe ser true o false");
    }
    if (categoria !== undefined && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(categoria)) {
      return fallo(res, 400, 'PARAMETRO_INVALIDO', "El parámetro 'categoria' debe ser un slug válido (por ejemplo: cortes)");
    }
    if (q !== undefined && q.trim().length > MAX_LONGITUD_Q) {
      return fallo(res, 400, 'PARAMETRO_INVALIDO', `El parámetro 'q' no puede superar ${MAX_LONGITUD_Q} caracteres`);
    }

    const condiciones = [];
    const valores = [];
    if (categoria) {
      const { rows } = await pool.query('SELECT 1 FROM categorias WHERE slug = $1', [categoria]);
      if (rows.length === 0) return fallo(res, 400, 'CATEGORIA_NO_ENCONTRADA', `La categoría '${categoria}' no existe`);
      valores.push(categoria);
      condiciones.push(`c.slug = $${valores.length}`);
    }
    if (area !== undefined) {
      valores.push(area);
      condiciones.push(`s.area = $${valores.length}`);
    }
    if (activo !== undefined) {
      valores.push(activo === 'true');
      condiciones.push(`s.activo = $${valores.length}`);
    }
    if (q?.trim()) {
      valores.push(`%${escaparLike(q.trim())}%`);
      condiciones.push(`s.nombre ILIKE $${valores.length} ESCAPE '\\'`);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `${SELECT_SERVICIOS} ${where} ORDER BY c.orden ASC NULLS LAST, s.precio ASC, s.nombre ASC, s.id ASC`,
      valores
    );
    res.json(rows.map(aServicioAdmin));
  } catch (err) {
    next(err);
  }
};

// Comprueba que la categoría exista, esté activa y sea del MISMO área que el servicio; responde y devuelve false si no.
const categoriaUtilizable = async (res, categoriaId, area) => {
  const categoria = await buscarCategoriaPorId(categoriaId);
  if (!categoria || !categoria.activo) {
    fallo(res, 400, 'CATEGORIA_NO_DISPONIBLE', 'La categoría no existe o está inactiva', { campo: 'categoria_id' });
    return false;
  }
  if (categoria.area !== area) {
    fallo(res, 400, 'CATEGORIA_AREA_INCOMPATIBLE', 'La categoría es de otra área: elige una categoría del mismo área que el servicio', {
      campo: 'categoria_id',
    });
    return false;
  }
  return true;
};

// POST /api/admin/servicios
export const crearServicio = async (req, res, next) => {
  try {
    const cuerpo = req.body ?? {};
    if (!esObjetoPlano(cuerpo)) return fallo(res, 400, 'DATOS_INVALIDOS', 'El cuerpo debe ser un objeto JSON');

    const { datos, campo, mensaje } = leerCampos(cuerpo, REGLAS_SERVICIO);
    if (!datos) return datoInvalido(res, campo, mensaje);
    const falta = OBLIGATORIOS_ALTA.find((c) => !(c in datos));
    if (falta) return datoInvalido(res, falta, `El campo '${falta}' es obligatorio`);

    const area = datos.area ?? AREA_BARBERIA;
    if (!(await categoriaUtilizable(res, datos.categoria_id, area))) return undefined;
    if (await nombreOcupado('servicios', datos.nombre)) {
      return fallo(res, 409, 'NOMBRE_DUPLICADO', 'Ya existe un servicio con ese nombre', { campo: 'nombre' });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO servicios (nombre, descripcion, precio, duracion_min, tipo, categoria_id, activo, area)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [datos.nombre, datos.descripcion, datos.precio, datos.duracion_min, datos.tipo, datos.categoria_id, datos.activo ?? true, area]
      );
      return res.status(201).json(aServicioAdmin(await buscarServicio(rows[0].id)));
    } catch (err) {
      if (err.code === '23505' && err.constraint === 'servicios_nombre_key') {
        return fallo(res, 409, 'NOMBRE_DUPLICADO', 'Ya existe un servicio con ese nombre', { campo: 'nombre' });
      }
      throw err;
    }
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/admin/servicios/:id  (cualquier campo editable y activo). No toca las citas ya creadas: guardan su
// propio precio y duración (snapshot).
export const actualizarServicio = async (req, res, next) => {
  try {
    const id = leerId(req, res, 'SERVICIO_NO_ENCONTRADO', 'Servicio no encontrado');
    if (id === null) return undefined;

    const cuerpo = req.body ?? {};
    if (!esObjetoPlano(cuerpo)) return fallo(res, 400, 'DATOS_INVALIDOS', 'El cuerpo debe ser un objeto JSON');
    if (Object.keys(cuerpo).length === 0) {
      return fallo(res, 400, 'DATOS_INVALIDOS', `Debes enviar al menos un campo: ${CAMPOS_SERVICIO.join(', ')}`);
    }
    const { datos, campo, mensaje } = leerCampos(cuerpo, REGLAS_SERVICIO);
    if (!datos) return datoInvalido(res, campo, mensaje);

    const actual = await buscarServicio(id);
    if (!actual) return fallo(res, 404, 'SERVICIO_NO_ENCONTRADO', 'Servicio no encontrado');

    // La asesoría gratis sembrada es gratis por definición (la promoción de «una por persona»): su precio no se toca
    // (desactivarla sí se puede). Mandar el mismo precio (0) es inocuo.
    if (esAsesoriaGratis(actual) && datos.precio !== undefined && datos.precio !== actual.precio) {
      return fallo(res, 409, 'PRECIO_FIJO', 'La asesoría gratuita debe costar siempre 0. Puedes desactivarla, pero no cambiarle el precio.', {
        campo: 'precio',
      });
    }

    // El área de un servicio con historial (líneas en cita_servicios) no cambia: las citas y las estadísticas ya la usan.
    const areaResultante = datos.area ?? actual.area;
    if (datos.area !== undefined && datos.area !== actual.area) {
      const { rows: historial } = await pool.query('SELECT 1 FROM cita_servicios WHERE servicio_id = $1 LIMIT 1', [id]);
      if (historial.length > 0) {
        return fallo(res, 409, 'SERVICIO_CON_HISTORIAL', 'Este servicio ya tiene citas: no se puede cambiar su área. Desactívalo y crea uno nuevo.', {
          campo: 'area',
        });
      }
    }

    // La categoría (la nueva o la actual, si cambia el área) debe ser del área resultante.
    if (datos.categoria_id !== undefined) {
      if (!(await categoriaUtilizable(res, datos.categoria_id, areaResultante))) return undefined;
    } else if (datos.area !== undefined && datos.area !== actual.area && actual.categoria_id !== null && actual.categoria_area !== areaResultante) {
      return fallo(res, 400, 'CATEGORIA_AREA_INCOMPATIBLE', 'La categoría actual es de otra área: elige también una categoría del nuevo área', {
        campo: 'categoria_id',
      });
    }
    if (datos.nombre !== undefined && datos.nombre !== actual.nombre && (await nombreOcupado('servicios', datos.nombre, id))) {
      return fallo(res, 409, 'NOMBRE_DUPLICADO', 'Ya existe un servicio con ese nombre', { campo: 'nombre' });
    }

    // Un servicio activo siempre tiene categoría (activa), tipo y descripción (los servicios del catálogo anterior
    // no los tienen: hay que completarlos al reactivarlos).
    const resultante = { ...actual, ...datos };
    if (resultante.activo) {
      const incompleto = ['categoria_id', 'tipo', 'descripcion'].find((c) => resultante[c] === null);
      if (incompleto) {
        return fallo(res, 400, 'SERVICIO_INCOMPLETO', `Para activar el servicio falta completar '${incompleto}'`, { campo: incompleto });
      }
      if (datos.categoria_id === undefined && actual.categoria_activo === false) {
        return fallo(res, 400, 'CATEGORIA_NO_DISPONIBLE', 'La categoría del servicio está inactiva: actívala o elige otra', {
          campo: 'categoria_id',
        });
      }
    }

    const columnas = Object.keys(datos);
    const asignaciones = columnas.map((c, i) => `${c} = $${i + 1}`).join(', '); // los nombres salen de REGLAS_SERVICIO
    try {
      await pool.query(`UPDATE servicios SET ${asignaciones} WHERE id = $${columnas.length + 1}`, [
        ...columnas.map((c) => datos[c]),
        id,
      ]);
    } catch (err) {
      if (err.code === '23505' && err.constraint === 'servicios_nombre_key') {
        return fallo(res, 409, 'NOMBRE_DUPLICADO', 'Ya existe un servicio con ese nombre', { campo: 'nombre' });
      }
      throw err;
    }
    return res.json(aServicioAdmin(await buscarServicio(id)));
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------------------------------- categorías

const SELECT_CATEGORIAS = `
  SELECT c.id, c.nombre, c.slug, c.orden, c.activo, c.area,
         COUNT(s.id) FILTER (WHERE s.activo)::int AS total_servicios,
         COUNT(s.id) FILTER (WHERE NOT s.activo)::int AS total_inactivos
  FROM categorias c
  LEFT JOIN servicios s ON s.categoria_id = c.id`;

const buscarCategoriaAdmin = async (id) => {
  const { rows } = await pool.query(`${SELECT_CATEGORIAS} WHERE c.id = $1 GROUP BY c.id`, [id]);
  return rows[0] ?? null;
};

// GET /api/admin/categorias  (incluye inactivas)
export const listarCategoriasAdmin = async (req, res, next) => {
  try {
    const errorParametros = validarParametros(req.query, []);
    if (errorParametros) return fallo(res, 400, 'PARAMETRO_INVALIDO', errorParametros);

    const { rows } = await pool.query(`${SELECT_CATEGORIAS} GROUP BY c.id ORDER BY c.orden ASC, c.id ASC`);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
};

// El slug se genera del nombre al crear (con sufijo -2, -3… si ya existe) y no se puede editar.
const slugLibre = async (nombre) => {
  const base = generarSlug(nombre);
  for (let n = 1; n <= 200; n += 1) {
    const candidato = n === 1 ? base : `${base}-${n}`;
    const { rows } = await pool.query('SELECT 1 FROM categorias WHERE slug = $1', [candidato]);
    if (rows.length === 0) return candidato;
  }
  throw new Error('No se pudo generar un slug libre para la categoría');
};

// POST /api/admin/categorias
export const crearCategoria = async (req, res, next) => {
  try {
    const cuerpo = req.body ?? {};
    if (!esObjetoPlano(cuerpo)) return fallo(res, 400, 'DATOS_INVALIDOS', 'El cuerpo debe ser un objeto JSON');
    if ('slug' in cuerpo) return fallo(res, 400, 'SLUG_NO_EDITABLE', 'El slug se genera del nombre y no se puede indicar', { campo: 'slug' });

    const { datos, campo, mensaje } = leerCampos(cuerpo, REGLAS_CATEGORIA);
    if (!datos) return datoInvalido(res, campo, mensaje);
    if (!('nombre' in datos)) return datoInvalido(res, 'nombre', "El campo 'nombre' es obligatorio");

    if (await nombreOcupado('categorias', datos.nombre)) {
      return fallo(res, 409, 'NOMBRE_DUPLICADO', 'Ya existe una categoría con ese nombre', { campo: 'nombre' });
    }

    let orden = datos.orden;
    if (orden === undefined) {
      const { rows } = await pool.query('SELECT COALESCE(MAX(orden), 0)::int + 1 AS siguiente FROM categorias');
      orden = Math.min(rows[0].siguiente, MAX_ORDEN);
    }

    for (let intento = 0; intento < 5; intento += 1) {
      try {
        const slug = await slugLibre(datos.nombre);
        const { rows } = await pool.query(
          'INSERT INTO categorias (nombre, slug, orden, activo) VALUES ($1, $2, $3, $4) RETURNING id',
          [datos.nombre, slug, orden, datos.activo ?? true]
        );
        return res.status(201).json(await buscarCategoriaAdmin(rows[0].id));
      } catch (err) {
        if (err.code !== '23505') throw err;
        // Choque de nombre o de slug por una creación simultánea: se revisa el nombre y se reintenta el slug.
        if (await nombreOcupado('categorias', datos.nombre)) {
          return fallo(res, 409, 'NOMBRE_DUPLICADO', 'Ya existe una categoría con ese nombre', { campo: 'nombre' });
        }
      }
    }
    return fallo(res, 409, 'SLUG_NO_DISPONIBLE', 'No se pudo generar un identificador único; intenta de nuevo');
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/admin/categorias/:id  (nombre, orden, activo)
export const actualizarCategoria = async (req, res, next) => {
  try {
    const id = leerId(req, res, 'CATEGORIA_NO_ENCONTRADA', 'Categoría no encontrada');
    if (id === null) return undefined;

    const cuerpo = req.body ?? {};
    if (!esObjetoPlano(cuerpo)) return fallo(res, 400, 'DATOS_INVALIDOS', 'El cuerpo debe ser un objeto JSON');
    if ('slug' in cuerpo) return fallo(res, 400, 'SLUG_NO_EDITABLE', 'El slug no se puede editar', { campo: 'slug' });
    if (Object.keys(cuerpo).length === 0) {
      return fallo(res, 400, 'DATOS_INVALIDOS', `Debes enviar al menos un campo: ${Object.keys(REGLAS_CATEGORIA).join(', ')}`);
    }
    const { datos, campo, mensaje } = leerCampos(cuerpo, REGLAS_CATEGORIA);
    if (!datos) return datoInvalido(res, campo, mensaje);

    const actual = await buscarCategoriaAdmin(id);
    if (!actual) return fallo(res, 404, 'CATEGORIA_NO_ENCONTRADA', 'Categoría no encontrada');

    if (datos.activo === false && actual.total_servicios > 0) {
      return fallo(
        res,
        409,
        'CATEGORIA_CON_SERVICIOS',
        `No se puede desactivar: tiene ${actual.total_servicios} servicio(s) activo(s). Desactívalos o muévelos primero.`,
        { total_servicios: actual.total_servicios }
      );
    }
    if (datos.nombre !== undefined && datos.nombre !== actual.nombre && (await nombreOcupado('categorias', datos.nombre, id))) {
      return fallo(res, 409, 'NOMBRE_DUPLICADO', 'Ya existe una categoría con ese nombre', { campo: 'nombre' });
    }

    const columnas = Object.keys(datos);
    const asignaciones = columnas.map((c, i) => `${c} = $${i + 1}`).join(', '); // los nombres salen de REGLAS_CATEGORIA
    try {
      await pool.query(`UPDATE categorias SET ${asignaciones} WHERE id = $${columnas.length + 1}`, [
        ...columnas.map((c) => datos[c]),
        id,
      ]);
    } catch (err) {
      if (err.code === '23505' && err.constraint === 'categorias_nombre_key') {
        return fallo(res, 409, 'NOMBRE_DUPLICADO', 'Ya existe una categoría con ese nombre', { campo: 'nombre' });
      }
      throw err;
    }
    return res.json(await buscarCategoriaAdmin(id));
  } catch (err) {
    return next(err);
  }
};
