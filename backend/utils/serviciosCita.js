// Servicios de una cita (de 1 a 3, atendidos seguidos por el mismo barbero como un solo bloque). Una sola fuente de
// verdad para la reserva y la disponibilidad: los límites, la lectura estricta de ids y la carga de los servicios.
// La duración y el precio de la cita SIEMPRE se calculan aquí con lo que hay en la base; jamás con lo que mande el cliente.

export const MAX_SERVICIOS_POR_CITA = 3;
// Tope de duración SOLO para combos (2 o más servicios). Un servicio individual se puede reservar aunque dure más
// (el catálogo admite hasta 600 min): lo limita únicamente el horario de atención.
export const MAX_DURACION_TOTAL_MIN = 240;
const ID_MAXIMO_INT = 2147483647;

// Un error es { status, cuerpo } listo para `res.status(status).json(cuerpo)`.
const falla = (cuerpo) => ({ status: 400, cuerpo });

const errorServiciosNoDisponibles = (ids, total) =>
  falla({
    error:
      total === 1
        ? 'El servicio seleccionado no existe o no está disponible'
        : 'Uno o más servicios seleccionados no existen o no están disponibles',
    codigo: 'SERVICIO_NO_DISPONIBLE',
    servicios_no_disponibles: ids,
  });

// Límites y repetidos de una lista de ids ya numéricos. Devuelve un error o null.
export const validarListaIds = (ids) => {
  if (ids.length < 1 || ids.length > MAX_SERVICIOS_POR_CITA) {
    return falla({
      error: `Debes elegir entre 1 y ${MAX_SERVICIOS_POR_CITA} servicios`,
      codigo: 'LIMITE_SERVICIOS',
      maximo: MAX_SERVICIOS_POR_CITA,
    });
  }
  if (new Set(ids).size !== ids.length) {
    return falla({ error: 'No puedes repetir un servicio en la misma reserva', codigo: 'SERVICIOS_REPETIDOS' });
  }
  return null;
};

const datosInvalidos = (campo, error) => falla({ error, codigo: 'DATOS_INVALIDOS', campo });

// Lee los servicios pedidos en el cuerpo de POST /api/citas.
//  - `servicios_ids`: array de 1 a 3 enteros positivos (number JSON; ni strings ni objetos), sin repetidos.
//  - `servicio_id` (formato anterior): equivale a [servicio_id]. Si llegan los dos campos, 400.
// Devuelve { ids } o { error }.
export const leerServiciosDelCuerpo = ({ servicio_id: servicioId, servicios_ids: serviciosIds }) => {
  if (serviciosIds !== undefined && servicioId !== undefined) {
    return { error: datosInvalidos('servicios_ids', 'Envía servicios_ids o servicio_id, no los dos a la vez') };
  }

  if (serviciosIds !== undefined) {
    if (!Array.isArray(serviciosIds)) {
      return { error: datosInvalidos('servicios_ids', 'servicios_ids debe ser un arreglo de ids') };
    }
    const todosEnteros = serviciosIds.every(
      (id) => typeof id === 'number' && Number.isInteger(id) && id >= 1 && id <= ID_MAXIMO_INT
    );
    if (!todosEnteros) {
      return { error: datosInvalidos('servicios_ids', 'Cada servicio debe ser un id numérico entero positivo') };
    }
    return { ids: serviciosIds, error: validarListaIds(serviciosIds) ?? undefined };
  }

  // Formato anterior: se aceptan número o texto numérico, nada más (ni arreglos ni objetos).
  if (typeof servicioId !== 'number' && typeof servicioId !== 'string') {
    return { error: falla({ error: 'El servicio es obligatorio' }) };
  }
  const numero = Number(servicioId);
  if (!Number.isInteger(numero)) return { error: falla({ error: 'El servicio es obligatorio' }) };
  if (numero < 1 || numero > ID_MAXIMO_INT) return { error: errorServiciosNoDisponibles([numero], 1) };
  return { ids: [numero] };
};

// Lee `servicios=1,2,3` de GET /api/disponibilidad: ids decimales separados por coma, sin espacios ni vacíos.
export const leerServiciosCsv = (texto) => {
  if (typeof texto !== 'string' || !/^\d{1,10}(,\d{1,10})*$/.test(texto)) {
    return { error: datosInvalidos('servicios', 'servicios debe ser una lista de ids numéricos separados por comas') };
  }
  const ids = texto.split(',').map(Number);
  if (ids.some((id) => id < 1 || id > ID_MAXIMO_INT)) {
    return { error: datosInvalidos('servicios', 'servicios debe contener ids numéricos válidos') };
  }
  return { ids, error: validarListaIds(ids) ?? undefined };
};

// Carga los servicios ACTIVOS pedidos (en el orden pedido) con su duración y precio actuales, y calcula los totales.
// Con `bloquear` toma FOR SHARE sobre las filas (ordenadas por id para no provocar deadlocks entre reservas): una baja
// del servicio queda esperando hasta que la reserva termine, así nunca se reserva algo que se desactiva a mitad.
// Devuelve { lista, duracion, precio } o { error }.
export const cargarServicios = async (db, ids, { bloquear = false } = {}) => {
  const { rows } = await db.query(
    `SELECT id, nombre, duracion_min, precio, area
     FROM servicios
     WHERE id = ANY($1::int[]) AND activo = true
     ORDER BY id
     ${bloquear ? 'FOR SHARE' : ''}`,
    [ids]
  );
  const porId = new Map(rows.map((fila) => [fila.id, fila]));

  const faltantes = ids.filter((id) => !porId.has(id));
  if (faltantes.length > 0) return { error: errorServiciosNoDisponibles(faltantes, ids.length) };

  const lista = ids.map((id, indice) => ({ ...porId.get(id), orden: indice + 1 }));
  const duracion = lista.reduce((suma, servicio) => suma + servicio.duracion_min, 0);
  const precio = lista.reduce((suma, servicio) => suma + servicio.precio, 0);

  if (lista.length >= 2 && duracion > MAX_DURACION_TOTAL_MIN) {
    return {
      error: falla({
        error: `La duración total de los servicios (${duracion} min) supera el máximo de ${MAX_DURACION_TOTAL_MIN} min por reserva`,
        codigo: 'DURACION_EXCEDIDA',
        duracion_total_min: duracion,
        maximo_min: MAX_DURACION_TOTAL_MIN,
      }),
    };
  }
  return { lista, duracion, precio };
};
