// Pasos de datos del catálogo que se ejecutan UNA sola vez por base de datos. Cada uno deja su registro en
// migraciones_aplicadas (clave + fecha) en la misma transacción que sus cambios, así que repetirlos (cada arranque
// del backend, cada seed) no hace nada, y lo que el admin edite después nunca se vuelve a pisar.
import categoriasYServicios from './data/servicios.js';
import { AREA_ASESORIA, contarCitasAbiertas } from '../utils/areas.js';
import { hoyISO } from '../utils/fechas.js';

// Catálogo anterior al rediseño. Se desactiva (nunca se borra) porque las citas históricas apuntan a estos
// servicios por id.
export const NOMBRES_SERVICIOS_LEGADOS = [
  'Corte de Cabello',
  'Corte de Barba',
  'Combo (Pelo + Barba)',
  'Perfilado de Cejas',
  'Exfoliación Facial',
  'Tintura / Color',
];

export const MIGRACION_CLAVES = 'catalogo-claves-seed-v1';
export const MIGRACION_LEGADO = 'catalogo-legado-desactivado-v1';
export const MIGRACION_PERSONAL_AREA = 'personal-area-asesoria-v1';

const ASESORA_NOMBRE = 'Camila';
const ASESORA_CARGO = 'Asesora de Imagen';

// Un paso lanza esto para abortarse con un motivo claro: se deshace todo, no se registra y se reintenta después.
class PasoAbortado extends Error {}

// Ejecuta `paso` si `clave` aún no está registrada. Si `paso` devuelve `null` significa "todavía no aplica":
// se deshace el registro y se reintentará en la próxima ejecución. Si lanza PasoAbortado se deshace igual y el motivo
// sale en `abortada`. Devuelve `{ aplicada, detalle }` (más `abortada` si se abortó).
const unaVez = async (pool, clave, paso) => {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rowCount } = await cliente.query(
      'INSERT INTO migraciones_aplicadas (clave) VALUES ($1) ON CONFLICT DO NOTHING',
      [clave]
    );
    if (rowCount === 0) {
      await cliente.query('ROLLBACK');
      return { aplicada: false, detalle: null };
    }
    const detalle = await paso(cliente);
    if (detalle === null) {
      await cliente.query('ROLLBACK');
      return { aplicada: false, detalle: null };
    }
    await cliente.query('COMMIT');
    return { aplicada: true, detalle };
  } catch (err) {
    await cliente.query('ROLLBACK');
    if (err instanceof PasoAbortado) return { aplicada: false, detalle: null, abortada: err.message };
    throw err;
  } finally {
    cliente.release();
  }
};

// Asigna clave_seed a los servicios y categorías que ya existían (creados por el seed anterior, que casaba por
// nombre) y que coinciden con el catálogo: servicios por nombre exacto, categorías por slug. Solo toca filas sin
// clave, así que no pisa nada. Las filas que no coinciden (creadas por el admin) siguen con clave_seed NULL.
const asignarClaves = (catalogo) => async (db) => {
  let categorias = 0;
  let servicios = 0;
  for (const categoria of catalogo) {
    const { rowCount: c } = await db.query(
      `UPDATE categorias SET clave_seed = $1
       WHERE slug = $2 AND clave_seed IS NULL
         AND NOT EXISTS (SELECT 1 FROM categorias WHERE clave_seed = $1)`,
      [categoria.clave, categoria.slug]
    );
    categorias += c;
    for (const servicio of categoria.servicios) {
      const { rowCount: s } = await db.query(
        `UPDATE servicios SET clave_seed = $1
         WHERE nombre = $2 AND clave_seed IS NULL
           AND NOT EXISTS (SELECT 1 FROM servicios WHERE clave_seed = $1)`,
        [servicio.clave, servicio.nombre]
      );
      servicios += s;
    }
  }
  return { categorias, servicios };
};

// Apaga (sin borrar) los 6 servicios del catálogo anterior, una sola vez y solo cuando el catálogo nuevo ya está en la
// base (hay servicios con clave_seed); si no, queda pendiente. Si ya estaban inactivos, el paso solo se registra.
// Si el admin reactiva uno después, nada vuelve a apagarlo.
const desactivarLegado = (catalogo) => async (db) => {
  const { rows } = await db.query('SELECT 1 FROM servicios WHERE clave_seed IS NOT NULL LIMIT 1');
  if (rows.length === 0) return null;
  const nombresNuevos = catalogo.flatMap((c) => c.servicios.map((s) => s.nombre));
  const { rowCount } = await db.query(
    `UPDATE servicios SET activo = false
     WHERE clave_seed IS NULL AND activo = true
       AND nombre = ANY($1::varchar[]) AND nombre <> ALL($2::varchar[])`,
    [NOMBRES_SERVICIOS_LEGADOS, nombresNuevos]
  );
  return { desactivados: rowCount };
};

// Marca como asesora a quien ya existía como "Asesora de Imagen" (Camila): barberos.area = 'asesoria'. Una sola vez.
//  - Sin ninguna fila que coincida (otra instalación, o el personal aún no se sembró) queda pendiente: no se registra.
//  - Si la asesora ya está marcada (instalación nueva: el seed la crea con area 'asesoria'), el paso solo se registra.
//  - Si tiene citas abiertas (pendientes, o de hoy en adelante sin cancelar) el paso se ABORTA sin tocar nada y sin
//    registrarse: se reintentará en el próximo arranque, cuando ya no las tenga. Marcarla ahora dejaría citas de
//    corte asignadas a quien ya no atiende cortes. El motivo queda en `abortada` para que quien llame lo muestre.
const marcarPersonalAsesoria = async (db) => {
  const { rows } = await db.query(
    `SELECT id, area FROM barberos WHERE nombre = $1 AND cargo = $2 ORDER BY id`,
    [ASESORA_NOMBRE, ASESORA_CARGO]
  );
  if (rows.length === 0) return null;

  const porMarcar = rows.filter((fila) => fila.area !== AREA_ASESORIA);
  const hoy = hoyISO();
  for (const fila of porMarcar) {
    const abiertas = await contarCitasAbiertas(db, fila.id, hoy);
    if (abiertas > 0) {
      throw new PasoAbortado(
        `No se marcó a "${ASESORA_NOMBRE}" (barbero id ${fila.id}) como asesora: tiene ${abiertas} cita(s) pendientes o futuras. ` +
          'Reasígnalas o ciérralas desde /admin/citas y el paso se aplicará solo en el próximo arranque.'
      );
    }
  }
  if (porMarcar.length > 0) {
    await db.query('UPDATE barberos SET area = $1 WHERE id = ANY($2::int[])', [AREA_ASESORIA, porMarcar.map((f) => f.id)]);
  }
  return { marcados: porMarcar.length };
};

export const aplicarMigracionesCatalogo = async (pool, { catalogo = categoriasYServicios } = {}) => {
  const claves = await unaVez(pool, MIGRACION_CLAVES, asignarClaves(catalogo));
  const legado = await unaVez(pool, MIGRACION_LEGADO, desactivarLegado(catalogo));
  const personal = await unaVez(pool, MIGRACION_PERSONAL_AREA, marcarPersonalAsesoria);
  if (personal.abortada) console.warn(`⚠️ ${personal.abortada}`);
  return { claves, legado, personal };
};
