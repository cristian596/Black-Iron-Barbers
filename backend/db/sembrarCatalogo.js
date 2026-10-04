import categoriasYServicios from './data/servicios.js';
import descripciones from './data/descripciones.js';
import { aplicarMigracionesCatalogo, NOMBRES_SERVICIOS_LEGADOS } from './migracionesCatalogo.js';

export const TIPOS_VALIDOS = ['original', 'elite', 'vip'];
export { NOMBRES_SERVICIOS_LEGADOS };

const duplicados = (valores) => valores.filter((valor, i) => valores.indexOf(valor) !== i);
const claveInvalida = (clave) => typeof clave !== 'string' || clave.trim().length === 0;

// Devuelve la lista de problemas encontrados (vacía si el catálogo es coherente).
export const validarCatalogo = (catalogo, listaDescripciones) => {
  const problemas = [];
  const servicios = catalogo.flatMap((categoria) => categoria.servicios);
  const ids = servicios.map((s) => s.id);
  const idsDescripcion = listaDescripciones.map((d) => d.id);

  const idsRepetidos = [...new Set(duplicados(ids))];
  if (idsRepetidos.length > 0) problemas.push(`ids de servicio repetidos: ${idsRepetidos.join(', ')}`);

  const descripcionesRepetidas = [...new Set(duplicados(idsDescripcion))];
  if (descripcionesRepetidas.length > 0) problemas.push(`ids de descripción repetidos: ${descripcionesRepetidas.join(', ')}`);

  const sinDescripcion = ids.filter((id) => !idsDescripcion.includes(id));
  if (sinDescripcion.length > 0) problemas.push(`servicios sin descripción: ${sinDescripcion.join(', ')}`);

  const huerfanas = idsDescripcion.filter((id) => !ids.includes(id));
  if (huerfanas.length > 0) problemas.push(`descripciones sin servicio: ${huerfanas.join(', ')}`);

  const vacias = listaDescripciones.filter((d) => !d.descripcion?.trim()).map((d) => d.id);
  if (vacias.length > 0) problemas.push(`descripciones vacías: ${vacias.join(', ')}`);

  const tiposInvalidos = servicios.filter((s) => !TIPOS_VALIDOS.includes(s.tipo)).map((s) => s.id);
  if (tiposInvalidos.length > 0) problemas.push(`tipo inválido en servicios: ${tiposInvalidos.join(', ')}`);

  const slugsRepetidos = [...new Set(duplicados(catalogo.map((c) => c.slug)))];
  if (slugsRepetidos.length > 0) problemas.push(`slugs repetidos: ${slugsRepetidos.join(', ')}`);

  const nombresRepetidos = [...new Set(duplicados(servicios.map((s) => s.nombre)))];
  if (nombresRepetidos.length > 0) problemas.push(`nombres de servicio repetidos: ${nombresRepetidos.join(', ')}`);

  const numerosInvalidos = servicios
    .filter((s) => !Number.isInteger(s.precio) || s.precio < 0 || !Number.isInteger(s.duracion) || s.duracion <= 0)
    .map((s) => s.id);
  if (numerosInvalidos.length > 0) problemas.push(`precio o duración inválidos en servicios: ${numerosInvalidos.join(', ')}`);

  const serviciosSinClave = servicios.filter((s) => claveInvalida(s.clave)).map((s) => s.id);
  if (serviciosSinClave.length > 0) problemas.push(`servicios sin clave (vacía o ausente): ${serviciosSinClave.join(', ')}`);

  const clavesServicioRepetidas = [...new Set(duplicados(servicios.filter((s) => !claveInvalida(s.clave)).map((s) => s.clave)))];
  if (clavesServicioRepetidas.length > 0) problemas.push(`claves de servicio repetidas: ${clavesServicioRepetidas.join(', ')}`);

  const categoriasSinClave = catalogo.filter((c) => claveInvalida(c.clave)).map((c) => c.slug);
  if (categoriasSinClave.length > 0) problemas.push(`categorías sin clave (vacía o ausente): ${categoriasSinClave.join(', ')}`);

  const clavesCategoriaRepetidas = [...new Set(duplicados(catalogo.filter((c) => !claveInvalida(c.clave)).map((c) => c.clave)))];
  if (clavesCategoriaRepetidas.length > 0) problemas.push(`claves de categoría repetidas: ${clavesCategoriaRepetidas.join(', ')}`);

  return problemas;
};

const comprobarCatalogo = (catalogo, listaDescripciones) => {
  const problemas = validarCatalogo(catalogo, listaDescripciones);
  if (problemas.length > 0) {
    throw new Error(`Datos de catálogo inválidos: ${problemas.join('; ')}`);
  }
};

// Solo INSERTA lo que falta; nunca modifica, reactiva ni desactiva nada. Lo que el admin edite (precio, nombre,
// activo…) sobrevive a cualquier seed. Las filas se casan por clave_seed (no por nombre), así un servicio que el
// admin renombró no se vuelve a crear; los servicios del admin (clave_seed NULL) no se tocan jamás. Un nombre que
// ya exista (aunque sea de otra fila) también se respeta: ON CONFLICT DO NOTHING.
// El `id` de los archivos de datos solo sirve para casar cada servicio con su descripción.
// Recibe un Pool de pg; los inserts van en una transacción (o se aplican completos o nada).
export const sembrarCatalogo = async (
  pool,
  { catalogo = categoriasYServicios, listaDescripciones = descripciones } = {}
) => {
  comprobarCatalogo(catalogo, listaDescripciones);

  // Antes de insertar: que las filas existentes ya tengan su clave (si no, se duplicarían).
  await aplicarMigracionesCatalogo(pool, { catalogo });

  const descripcionPorId = new Map(listaDescripciones.map((d) => [d.id, d.descripcion]));
  const resultado = {
    categorias: { insertadas: 0, existentes: 0 },
    servicios: { insertados: 0, existentes: 0 },
    omitidos: [],
  };
  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');

    for (const [indice, categoria] of catalogo.entries()) {
      const { rowCount } = await cliente.query(
        `INSERT INTO categorias (nombre, slug, orden, clave_seed)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [categoria.categoria, categoria.slug, indice + 1, categoria.clave]
      );
      if (rowCount === 1) resultado.categorias.insertadas += 1;
      else resultado.categorias.existentes += 1;

      const { rows } = await cliente.query('SELECT id FROM categorias WHERE clave_seed = $1', [categoria.clave]);
      if (rows.length === 0) {
        // El nombre o el slug ya lo usa una categoría del admin: no se pisa y sus servicios no se siembran.
        resultado.omitidos.push(`categoría "${categoria.categoria}" (nombre o slug ocupado por otra categoría)`);
        continue;
      }
      const categoriaId = rows[0].id;

      for (const servicio of categoria.servicios) {
        const { rowCount: insertado } = await cliente.query(
          `INSERT INTO servicios (nombre, duracion_min, precio, categoria_id, tipo, descripcion, activo, clave_seed)
           VALUES ($1, $2, $3, $4, $5, $6, true, $7)
           ON CONFLICT DO NOTHING`,
          [servicio.nombre, servicio.duracion, servicio.precio, categoriaId, servicio.tipo, descripcionPorId.get(servicio.id), servicio.clave]
        );
        if (insertado === 1) resultado.servicios.insertados += 1;
        else resultado.servicios.existentes += 1;
      }
    }

    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }

  // Con el catálogo ya en la base, el apagado del catálogo anterior (paso único) puede registrarse.
  resultado.migraciones = await aplicarMigracionesCatalogo(pool, { catalogo });
  return resultado;
};

// --- Restablecer el catálogo a los datos de los archivos (SOLO desarrollo; ver seed.js) ---------------------------

const CAMPOS_SERVICIO = ['nombre', 'descripcion', 'duracion_min', 'precio', 'tipo', 'activo'];

// Compara la base con el catálogo y devuelve qué se sobrescribiría, sin escribir nada.
// Casa por clave_seed (o, en una base aún sin migrar, por nombre exacto).
export const calcularRestablecimiento = async (db, { catalogo = categoriasYServicios, listaDescripciones = descripciones } = {}) => {
  comprobarCatalogo(catalogo, listaDescripciones);
  const descripcionPorId = new Map(listaDescripciones.map((d) => [d.id, d.descripcion]));
  const cambios = [];
  const faltantes = [];

  for (const [indice, categoria] of catalogo.entries()) {
    const { rows: cats } = await db.query(
      `SELECT id, nombre, orden, activo FROM categorias
       WHERE clave_seed = $1 OR (clave_seed IS NULL AND slug = $2)
       ORDER BY (clave_seed = $1) DESC NULLS LAST LIMIT 1`,
      [categoria.clave, categoria.slug]
    );
    const esperadaCat = { nombre: categoria.categoria, orden: indice + 1, activo: true };
    const actualCat = cats[0];
    if (!actualCat) {
      faltantes.push(`categoría "${categoria.categoria}"`);
    } else {
      const campos = Object.keys(esperadaCat)
        .filter((c) => actualCat[c] !== esperadaCat[c])
        .map((c) => ({ campo: c, actual: actualCat[c], nuevo: esperadaCat[c] }));
      if (campos.length > 0) cambios.push({ tipo: 'categoria', id: actualCat.id, etiqueta: categoria.categoria, campos });
    }

    for (const servicio of categoria.servicios) {
      const esperado = {
        nombre: servicio.nombre,
        descripcion: descripcionPorId.get(servicio.id),
        duracion_min: servicio.duracion,
        precio: servicio.precio,
        tipo: servicio.tipo,
        activo: true,
      };
      const { rows } = await db.query(
        `SELECT id, nombre, descripcion, duracion_min, precio, tipo, activo, categoria_id FROM servicios
         WHERE clave_seed = $1 OR (clave_seed IS NULL AND nombre = $2)
         ORDER BY (clave_seed = $1) DESC NULLS LAST LIMIT 1`,
        [servicio.clave, servicio.nombre]
      );
      const actual = rows[0];
      if (!actual) {
        faltantes.push(`servicio "${servicio.nombre}"`);
        continue;
      }
      const campos = CAMPOS_SERVICIO.filter((c) => actual[c] !== esperado[c]).map((c) => ({
        campo: c,
        actual: actual[c],
        nuevo: esperado[c],
      }));
      if (actualCat && actual.categoria_id !== actualCat.id) {
        campos.push({ campo: 'categoria_id', actual: actual.categoria_id, nuevo: actualCat.id });
      }
      if (campos.length > 0) cambios.push({ tipo: 'servicio', id: actual.id, etiqueta: servicio.nombre, campos });
    }
  }
  return { cambios, faltantes };
};

// Sobrescribe con los datos de los archivos lo que el admin haya editado en filas del catálogo, reactiva lo que
// esté apagado e inserta lo que falte. No toca las filas del admin (sin clave_seed y sin coincidencia).
export const restablecerCatalogo = async (pool, opciones = {}) => {
  const { catalogo = categoriasYServicios, listaDescripciones = descripciones } = opciones;
  comprobarCatalogo(catalogo, listaDescripciones);
  await aplicarMigracionesCatalogo(pool, { catalogo });

  const { cambios } = await calcularRestablecimiento(pool, { catalogo, listaDescripciones });
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    for (const cambio of cambios) {
      const tabla = cambio.tipo === 'categoria' ? 'categorias' : 'servicios';
      const sets = cambio.campos.map((c, i) => `${c.campo} = $${i + 1}`).join(', ');
      await cliente.query(
        `UPDATE ${tabla} SET ${sets} WHERE id = $${cambio.campos.length + 1}`,
        [...cambio.campos.map((c) => c.nuevo), cambio.id]
      );
    }
    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }

  const insertados = await sembrarCatalogo(pool, { catalogo, listaDescripciones });
  return { restablecidos: cambios.length, insertados };
};
