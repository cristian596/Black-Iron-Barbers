import categoriasYServicios from './data/servicios.js';
import descripciones from './data/descripciones.js';

export const TIPOS_VALIDOS = ['original', 'elite', 'vip'];

// Catálogo anterior al rediseño. Se desactiva (nunca se borra) porque las citas históricas
// apuntan a estos servicios por id.
export const NOMBRES_SERVICIOS_LEGADOS = [
  'Corte de Cabello',
  'Corte de Barba',
  'Combo (Pelo + Barba)',
  'Perfilado de Cejas',
  'Exfoliación Facial',
  'Tintura / Color',
];

const duplicados = (valores) => valores.filter((valor, i) => valores.indexOf(valor) !== i);

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

  return problemas;
};

// Idempotente. El `id` de los archivos de datos solo se usa para casar cada servicio con su
// descripción: el id real lo asigna la secuencia y el upsert se hace por nombre.
// Recibe un Pool de pg; todo ocurre en una transacción (o se aplica completo o nada).
export const sembrarCatalogo = async (
  pool,
  { catalogo = categoriasYServicios, listaDescripciones = descripciones } = {}
) => {
  const problemas = validarCatalogo(catalogo, listaDescripciones);
  if (problemas.length > 0) {
    throw new Error(`Datos de catálogo inválidos: ${problemas.join('; ')}`);
  }

  const descripcionPorId = new Map(listaDescripciones.map((d) => [d.id, d.descripcion]));
  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');

    for (const [indice, categoria] of catalogo.entries()) {
      const { rows } = await cliente.query(
        `INSERT INTO categorias (nombre, slug, orden)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden
         RETURNING id`,
        [categoria.categoria, categoria.slug, indice + 1]
      );
      const categoriaId = rows[0].id;

      for (const servicio of categoria.servicios) {
        await cliente.query(
          `INSERT INTO servicios (nombre, duracion_min, precio, categoria_id, tipo, descripcion, activo)
           VALUES ($1, $2, $3, $4, $5, $6, true)
           ON CONFLICT (nombre) DO UPDATE SET
             duracion_min = EXCLUDED.duracion_min,
             precio = EXCLUDED.precio,
             categoria_id = EXCLUDED.categoria_id,
             tipo = EXCLUDED.tipo,
             descripcion = EXCLUDED.descripcion,
             activo = true`,
          [servicio.nombre, servicio.duracion, servicio.precio, categoriaId, servicio.tipo, descripcionPorId.get(servicio.id)]
        );
      }
    }

    // Los nuevos nombres ya están a salvo arriba; esto solo apaga el catálogo viejo.
    const nombresNuevos = catalogo.flatMap((c) => c.servicios.map((s) => s.nombre));
    const { rowCount: desactivados } = await cliente.query(
      `UPDATE servicios SET activo = false
       WHERE nombre = ANY($1::varchar[]) AND nombre <> ALL($2::varchar[]) AND activo = true`,
      [NOMBRES_SERVICIOS_LEGADOS, nombresNuevos]
    );

    await cliente.query('COMMIT');
    return { categorias: catalogo.length, servicios: nombresNuevos.length, desactivados };
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
};
